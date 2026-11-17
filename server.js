
const express = require("express");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const QUESTIONS = require("./questions.json");
const FOUNDERS = require("./founders.json");
const DATA_FILE = path.join(__dirname, "data.json");

const CATEGORY_EXPLAIN = {
  "La mejor idea gana": { es:"No importa el cargo ni quién propuso la idea: gana la alternativa que mejor sirve al objetivo.", en:"Title and hierarchy do not decide: the idea that best serves the goal wins." },
  "Siempre es el Día 1": { es:"Seguimos con hambre, curiosidad y disposición a mejorar aunque la empresa crezca.", en:"We stay hungry, curious, and willing to improve no matter how much the company grows." },
  "Nada es demasiado loco": { es:"Las ideas audaces merecen espacio; no se descartan solo porque nunca se han hecho.", en:"Bold ideas deserve room; we do not reject them simply because they have never been done." },
  "Los datos tienen la última palabra": { es:"Las opiniones abren la conversación; cuando la evidencia es clara, seguimos los datos.", en:"Opinions open the conversation; when the evidence is clear, we follow the data." },
  "Adueñate de tu palabra": { es:"Cumplimos lo que prometemos y comunicamos riesgos temprano.", en:"We deliver on our commitments and communicate risks early." },
  "Hazlo simple": {"es": "Buscamos siempre el camino más simple para llegar a la meta. Evitamos procesos, reportes y fórmulas más complicados de lo necesario: si algo se puede hacer en menos pasos, lo hacemos en menos pasos.", "en": "We always look for the simplest path to the goal. We avoid processes, reports, and formulas that are more complicated than necessary: if something can be done in fewer steps, we do it in fewer steps."},
  "Misión": { es:"Ayudar a las personas a compartir alegría y expresar cariño a través del regalo de flores, mientras apoyamos a comunidades lideradas por mujeres cerca de nuestra finca en Guatemala.", en:"Help people share joy and express care through the gift of flowers, while supporting women-led communities near our farm in Guatemala." },
  "Visión": { es:"Hacer que un servicio de entrega de flores de alta calidad sea accesible para todos, con el tiempo de entrega más rápido y al mejor precio.", en:"Make a high-quality flower delivery service accessible to everyone, with the fastest delivery time and at the best price." },
  "Valores": { es:"Nuestros seis valores definen cómo pensamos, decidimos y cumplimos en Aquarossa.", en:"Our six values define how we think, decide, and deliver at Aquarossa." }
};

function defaultPersistent() {
  return {
    usedQuestionIds: [],
    lastWeekCategories: [],
    categoryLastUsedWeek: {},
    weekCounter: 0,
    cycle: 1,
    people: {},
    history: []
  };
}
let persistent = defaultPersistent();
try {
  persistent = { ...defaultPersistent(), ...JSON.parse(fs.readFileSync(DATA_FILE, "utf8")) };
} catch {}

function persist() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(persistent, null, 2)); } catch {}
}
function keyName(name) { return name.trim().toLowerCase().replace(/\s+/g, " "); }
function personStats(name) {
  const key = keyName(name);
  if (!persistent.people[key]) {
    persistent.people[key] = { name: name.trim(), points: 0, wins: 0, games: 0, correct: 0, answered: 0 };
  }
  return persistent.people[key];
}

// 7 categories + 5 rounds means at least 3 categories must overlap between
// consecutive weeks. This scheduler enforces five distinct categories per match
// and minimizes overlap to that theoretical minimum while favoring least-recently-used categories.
function shuffleArray(arr) {
  const a = arr.slice();
  for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function prepareQuestion(q, correctPosition) {
  const options = shuffleArray(q.options.filter((_, idx) => idx !== q.correct));
  options.splice(correctPosition, 0, q.options[q.correct]);
  return { ...q, options, correct: correctPosition };
}
function prepareMatchQuestions(questions) {
  // Each letter appears once or twice in a five-round match. Randomize both
  // the extra letters and their round positions; all players share this order.
  const letters = shuffleArray([0, 1, 2]);
  const positions = shuffleArray(questions.map((_, i) => letters[i % letters.length]));
  return questions.map((q, i) => prepareQuestion(q, positions[i]));
}
function chooseWeekQuestions() {
  let unused = QUESTIONS.filter(q => !persistent.usedQuestionIds.includes(q.id));
  if (unused.length < 5) {
    persistent.usedQuestionIds = [];
    persistent.cycle += 1;
    unused = QUESTIONS.slice();
  }
  const selected = prepareMatchQuestions(shuffleArray(unused).slice(0,5));
  persistent.weekCounter += 1;
  persistent.usedQuestionIds.push(...selected.map(q => q.id));
  persistent.lastWeekCategories = selected.map(q=>q.category);
  persist();
  return selected;
}

const connected = {};

const game = {
  phase: "waiting",
  hostId: null,
  players: {},
  lobbyDeadline: 0,
  questionDeadline: 0,
  questions: [],
  round: 0,
  answers: {},
  matchId: 0
};
let lobbyTimer = null, questionTimer = null, revealTimer = null, tieTimer = null;

function activePlayers() { return Object.entries(game.players); }
function publicPlayers() {
  const out = {};
  for (const [id,p] of Object.entries(game.players)) {
    out[id] = { name:p.name, score:p.score, language:p.language || "es", host:id===game.hostId };
  }
  return out;
}
function allTimeRows() {
  return Object.values(persistent.people)
    .sort((a,b)=>b.points-a.points || b.wins-a.wins || b.correct-a.correct)
    .slice(0,30);
}
function state() {
  const q = game.phase === "tiebreak" ? game.tieQuestion : (game.phase==="question" || game.phase==="reveal") ? game.questions[game.round] : null;
  return {
    phase: game.phase,
    matchId: game.matchId,
    phaseDeadline: game.phaseDeadline || 0,
    tieIds: game.tieIds || [],
    eliminatedIds: game.eliminatedIds || [],
    tieRound: game.tieRound || 0,
    reveal: game.reveal || null,
    finalResult: game.finalResult || null,
    hostId: game.hostId,
    players: publicPlayers(),
    lobbyDeadline: game.lobbyDeadline,
    questionDeadline: game.questionDeadline,
    round: game.round,
    totalRounds: 5,
    question: q ? { id:q.id, category:q.category, prompt:q.prompt, options:q.options } : null,
    answeredIds: Object.keys(game.answers),
    allTime: allTimeRows(),
    weekCounter: persistent.weekCounter,
    cycle: persistent.cycle
  };
}
function broadcast() { io.emit("state", state()); }

function resetMatch() {
  clearTimeout(lobbyTimer); clearTimeout(questionTimer); clearTimeout(revealTimer); clearTimeout(tieTimer);
  game.phase = "idle";
  game.hostId = null;
  game.players = {};
  game.lobbyDeadline = 0;
  game.questionDeadline = 0;
  game.questions = [];
  game.round = 0;
  game.answers = {};
}
function openLobbyWaiting() {
  clearTimeout(lobbyTimer);
  game.phase = "waiting";
  game.lobbyDeadline = 0;
  game.matchId += 1;
  broadcast();
}
function startLobbyCountdown() {
  if (game.phase !== "waiting") return;
  clearTimeout(lobbyTimer);
  game.phase = "lobby";
  game.lobbyDeadline = Date.now() + 30000;
  const token = game.matchId;
  lobbyTimer = setTimeout(() => {
    if (game.matchId === token && game.phase === "lobby") {
      if (activePlayers().length) startMatch();
      else { game.phase = "waiting"; game.lobbyDeadline = 0; broadcast(); }
    }
  }, 30100);
  broadcast();
}
function startMatch() {
  if (activePlayers().length < 1 || game.phase !== "lobby") return;
  clearTimeout(lobbyTimer);
  game.tieIds = []; game.eliminatedIds = []; game.tieRound = 0;
  game.finalResult = null; game.reveal = null;
  game.questions = chooseWeekQuestions();
  game.round = 0;
  game.answers = {};
  for (const [,p] of activePlayers()) p.score = 0;
  game.phase = "question";
  startQuestionClock();
  broadcast();
}
function startQuestionClock() {
  clearTimeout(questionTimer);
  game.answers = {};
  game.reveal = null;
  game.questionDeadline = Date.now() + 30000;
  const token = game.matchId;
  questionTimer = setTimeout(() => {
    if (game.matchId === token && game.phase === "question") revealRound();
  }, 30100);
}
function maybeRevealEarly() {
  const ids = activePlayers().map(([id])=>id);
  if (ids.length && ids.every(id => game.answers[id])) revealRound();
}
function revealRound() {
  if (game.phase !== "question") return;
  clearTimeout(questionTimer);
  const q = game.questions[game.round];
  const results = {};
  for (const [id,p] of activePlayers()) {
    const ans = game.answers[id] || null;
    const correct = !!ans && ans.choice === q.correct;
    if (correct) p.score += 1;
    results[id] = { name:p.name, choice:ans ? ans.choice : null, correct };
  }
  game.phase = "reveal";
  game.reveal = {
    round:game.round,
    correct:q.correct,
    category:q.category,
    explanation:CATEGORY_EXPLAIN[q.category] || "",
    results
  };
  io.emit("reveal", game.reveal);
  broadcast();

  const token = game.matchId;
  revealTimer = setTimeout(() => {
    if (game.matchId !== token || game.phase !== "reveal") return;
    if (game.round < 4) {
      game.round += 1;
      game.phase = "question";
      startQuestionClock();
      broadcast();
    } else resolveMatch();
  }, 6500);
}
function resolveMatch() {
  const rows = activePlayers();
  const max = Math.max(...rows.map(([,p]) => p.score));
  game.tieIds = rows.filter(([,p]) => p.score === max).map(([id]) => id);
  if (game.tieIds.length <= 1) return finishMatch(game.tieIds[0]);
  game.tieRound = 0;
  game.tieUsedIds = game.questions.map(q => q.id);
  game.phase = "tie-rules";
  game.phaseDeadline = Date.now() + 8000;
  broadcast();
  tieTimer = setTimeout(beginTieCountdown, 8000);
}
function beginTieCountdown() {
  if (!checkTiePlayers()) return;
  game.phase = "tie-countdown";
  game.phaseDeadline = Date.now() + 5000;
  game.answers = {}; game.eliminatedIds = []; game.reveal = null;
  broadcast();
  tieTimer = setTimeout(startTieQuestion, 5000);
}
function checkTiePlayers() {
  game.tieIds = game.tieIds.filter(id => game.players[id]);
  if (game.tieIds.length === 0) {
    finishMatch(null);
    return false;
  }
  return true;
}
function startTieQuestion() {
  if (!checkTiePlayers()) return;
  let pool = QUESTIONS.filter(q => !game.tieUsedIds.includes(q.id));
  if (!pool.length) { game.tieUsedIds = []; pool = QUESTIONS; }
  const source = shuffleArray(pool)[0];
  game.tieUsedIds.push(source.id);
  game.tieQuestion = prepareQuestion(source, Math.floor(Math.random()*3));
  game.tieRound += 1;
  game.phase = "tiebreak";
  game.answers = {}; game.eliminatedIds = [];
  game.questionDeadline = Date.now() + 5000;
  broadcast();
  tieTimer = setTimeout(retryTie, 5000);
}
function retryTie() {
  if (game.phase !== "tiebreak") return;
  clearTimeout(tieTimer);
  game.phase = "tie-retry";
  game.phaseDeadline = Date.now() + 3500;
  broadcast();
  tieTimer = setTimeout(beginTieCountdown, 3500);
}
function finishMatch(winnerId) {
  clearTimeout(questionTimer); clearTimeout(revealTimer); clearTimeout(tieTimer);
  game.phase = "finished";
  const rows = activePlayers().map(([id,p])=>({ id, name:p.name, score:p.score }))
    .sort((a,b)=>b.score-a.score || Number(b.id===winnerId)-Number(a.id===winnerId) || a.name.localeCompare(b.name));
  const max = rows.length ? rows[0].score : 0;
  const winners = rows.filter(r => r.id === winnerId).map(r=>r.name);

  for (const r of rows) {
    const s = personStats(r.name);
    s.points += r.score;
    s.correct += r.score;
    s.answered += 5;
    s.games += 1;
    if (r.id === winnerId) s.wins += 1;
  }
  persistent.history.push({ at:new Date().toISOString(), week:persistent.weekCounter, cycle:persistent.cycle, winners, players:rows });
  if (persistent.history.length > 100) persistent.history = persistent.history.slice(-100);
  persist();

  game.finalResult = { rows, winners, winnerId: winnerId || null, tiebreak:game.tieRound > 0, allTime:allTimeRows() };
  io.emit("finished", game.finalResult);
  broadcast();
}
function assignNewHost() {
  game.hostId = Object.keys(connected)[0] || null;
}

io.on("connection", socket => {
  // A browser first connects as a waiting client, NOT as a player.
  // Each tab/device has its own socket id and local language preference.
  connected[socket.id] = { language:"es" };
  if (!game.hostId && ["waiting","idle"].includes(game.phase)) game.hostId = socket.id;

  socket.emit("bootstrap", {});
  socket.emit("joined", { id:socket.id, host:socket.id===game.hostId });
  socket.emit("state", state());
  broadcast();

  socket.on("start-lobby", () => {
    if (socket.id !== game.hostId || !["waiting","idle"].includes(game.phase)) return;
    game.players = {};
    game.phase = "waiting";
    startLobbyCountdown();
  });

  socket.on("join-game", rawName => {
    if (game.phase !== "lobby" || Date.now() >= game.lobbyDeadline) return socket.emit("join-error", "closed");
    if (typeof rawName !== "string") return socket.emit("join-error", "name");
    const name = rawName.replace(/[\x00-\x1f\x7f]/g, "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 30) return socket.emit("join-error", "name");
    if (Object.entries(game.players).some(([id,p]) => id !== socket.id && keyName(p.name) === keyName(name))) return socket.emit("join-error", "duplicate");
    if (!game.players[socket.id] && activePlayers().length >= 50) return socket.emit("join-error", "full");
    game.players[socket.id] = { name, language:connected[socket.id].language, score:0 };
    broadcast();
  });

  socket.on("set-language", language => {
    if (!["en","es"].includes(language)) return;
    if (connected[socket.id]) connected[socket.id].language = language;
    if (game.players[socket.id]) game.players[socket.id].language = language;
    broadcast();
  });

  socket.on("answer", payload => {
    // Reject answers from an earlier question, including delayed network packets.
    if (!payload || payload.matchId !== game.matchId || payload.questionId !== (game.phase === "tiebreak" ? game.tieQuestion?.id : game.questions[game.round]?.id) || payload.tieRound !== (game.phase === "tiebreak" ? game.tieRound : 0)) return;
    const choice = payload.choice;
    if (!Number.isInteger(choice) || choice < 0 || choice > 2) return;
    if (Date.now() >= game.questionDeadline) return;
    if (game.phase === "tiebreak") {
      if (!game.tieIds.includes(socket.id) || game.answers[socket.id] || !game.players[socket.id]) return;
      game.answers[socket.id] = { choice };
      if (choice === game.tieQuestion.correct) return finishMatch(socket.id);
      game.eliminatedIds.push(socket.id);
      broadcast();
      if (game.tieIds.every(id => game.answers[id])) retryTie();
      return;
    }
    if (game.phase !== "question" || !game.players[socket.id] || game.answers[socket.id]) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 2) return;
    game.answers[socket.id] = { choice };
    broadcast();
    maybeRevealEarly();
  });

  socket.on("new-match", () => {
    if (socket.id !== game.hostId || game.phase !== "finished") return;
    game.matchId += 1;
    clearTimeout(lobbyTimer); clearTimeout(questionTimer); clearTimeout(revealTimer); clearTimeout(tieTimer);
    game.phase = "waiting";
    game.players = {};
    game.lobbyDeadline = 0;
    game.questionDeadline = 0;
    game.questions = [];
    game.round = 0;
    game.answers = {};
    broadcast();
  });

  socket.on("disconnect", () => {
    delete connected[socket.id];
    const wasPlayer = !!game.players[socket.id];
    if (wasPlayer) delete game.players[socket.id];
    if (socket.id === game.hostId) assignNewHost();
    if (game.phase === "question" && wasPlayer) maybeRevealEarly();
    if (game.phase.startsWith("tie") && wasPlayer) {
      if (checkTiePlayers() && game.phase === "tiebreak" && game.tieIds.every(id => game.answers[id])) retryTie();
    }
    // Do not reset the shared game merely because one browser leaves.
    if (Object.keys(connected).length === 0 && ["waiting","idle","lobby"].includes(game.phase)) resetMatch();
    broadcast();
  });
});

server.listen(process.env.PORT || 3000, () => console.log("Aquarossa Culture Battle V7 ready"));
