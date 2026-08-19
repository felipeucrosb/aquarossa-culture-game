
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
const FOUNDER_NAMES = FOUNDERS.map(f => f.name);
const DATA_FILE = path.join(__dirname, "data.json");

const CATEGORY_EXPLAIN = {
  "La mejor idea gana": "La jerarquía y el ego quedan en segundo plano. Gana la alternativa que mejor sirve a la misión, al cliente y al resultado.",
  "Siempre es el Día 1": "La cultura Día 1 cuestiona la costumbre, aprende rápido y busca mejoras constantes sin caer en burocracia.",
  "Nada es demasiado loco": "Las ideas audaces merecen espacio. La disciplina está en probarlas con riesgo controlado y aprender rápido.",
  "Los datos tienen la última palabra": "Las opiniones abren preguntas; la evidencia ayuda a cerrarlas. Hay que validar el dato y dejar que informe la decisión.",
  "Adueñate de tu palabra": "Cumplir, comunicar riesgos temprano y renegociar compromisos explícitamente construye confianza.",
  "Misión": "Ayudar a las personas a compartir alegría y expresar cariño a través del regalo de flores, mientras apoyamos a comunidades lideradas por mujeres cerca de nuestra finca en Guatemala.",
  "Visión": "Hacer que un servicio de entrega de flores de alta calidad sea accesible para todos, con el tiempo de entrega más rápido y al mejor precio."
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
function chooseWeekQuestions() {
  let unused = QUESTIONS.filter(q => !persistent.usedQuestionIds.includes(q.id));
  if (unused.length < 5) {
    persistent.usedQuestionIds = [];
    persistent.cycle += 1;
    unused = QUESTIONS.slice();
  }

  const cats = [...new Set(QUESTIONS.map(q => q.category))];
  const last = new Set(persistent.lastWeekCategories || []);
  const ranked = cats.map(c => ({ c, r: Math.random() }));
  ranked.sort((a,b) => {
    const aWas = last.has(a.c) ? 1 : 0;
    const bWas = last.has(b.c) ? 1 : 0;
    if (aWas !== bWas) return aWas - bWas;
    const au = persistent.categoryLastUsedWeek[a.c] ?? -999;
    const bu = persistent.categoryLastUsedWeek[b.c] ?? -999;
    if (au !== bu) return au - bu;
    return a.r - b.r;
  });

  const selectedCats = ranked.slice(0,5).map(x => x.c);
  const selected = [];
  for (const cat of selectedCats) {
    let pool = unused.filter(q => q.category === cat && !selected.some(s => s.id === q.id));
    if (!pool.length) pool = QUESTIONS.filter(q => q.category === cat && !selected.some(s => s.id === q.id));
    selected.push(pool[Math.floor(Math.random()*pool.length)]);
  }

  persistent.weekCounter += 1;
  persistent.usedQuestionIds.push(...selected.map(q => q.id));
  persistent.lastWeekCategories = selectedCats;
  for (const c of selectedCats) persistent.categoryLastUsedWeek[c] = persistent.weekCounter;
  persist();
  return selected;
}

const game = {
  phase: "idle",
  hostId: null,
  players: {},
  lobbyDeadline: 0,
  questionDeadline: 0,
  questions: [],
  round: 0,
  answers: {},
  matchId: 0
};
let lobbyTimer = null, questionTimer = null, revealTimer = null;

function activePlayers() { return Object.entries(game.players); }
function founderTaken(founder, exceptId=null) {
  return Object.entries(game.players).some(([id,p]) => id !== exceptId && p.founder === founder);
}
function publicPlayers() {
  const out = {};
  for (const [id,p] of Object.entries(game.players)) {
    out[id] = { name:p.name, founder:p.founder, score:p.score, host:id===game.hostId };
  }
  return out;
}
function allTimeRows() {
  return Object.values(persistent.people)
    .sort((a,b)=>b.points-a.points || b.wins-a.wins || b.correct-a.correct)
    .slice(0,30);
}
function state() {
  const q = (game.phase==="question" || game.phase==="reveal") ? game.questions[game.round] : null;
  return {
    phase: game.phase,
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
  clearTimeout(lobbyTimer); clearTimeout(questionTimer); clearTimeout(revealTimer);
  game.phase = "idle";
  game.hostId = null;
  game.players = {};
  game.lobbyDeadline = 0;
  game.questionDeadline = 0;
  game.questions = [];
  game.round = 0;
  game.answers = {};
}
function startLobbyCountdown() {
  clearTimeout(lobbyTimer);
  game.phase = "lobby";
  game.lobbyDeadline = Date.now() + 60000;
  const token = ++game.matchId;
  lobbyTimer = setTimeout(() => {
    if (game.matchId === token && game.phase === "lobby" && activePlayers().length >= 1) startMatch();
  }, 60100);
  broadcast();
}
function startMatch() {
  if (activePlayers().length < 1 || game.phase !== "lobby") return;
  clearTimeout(lobbyTimer);
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
    results[id] = { name:p.name, founder:p.founder, choice:ans ? ans.choice : null, correct };
  }
  game.phase = "reveal";
  io.emit("reveal", {
    round:game.round,
    correct:q.correct,
    category:q.category,
    explanation:CATEGORY_EXPLAIN[q.category] || "",
    results
  });
  broadcast();

  const token = game.matchId;
  revealTimer = setTimeout(() => {
    if (game.matchId !== token || game.phase !== "reveal") return;
    if (game.round < 4) {
      game.round += 1;
      game.phase = "question";
      startQuestionClock();
      broadcast();
    } else finishMatch();
  }, 6500);
}
function finishMatch() {
  clearTimeout(questionTimer); clearTimeout(revealTimer);
  game.phase = "finished";
  const rows = activePlayers().map(([id,p])=>({ id, name:p.name, founder:p.founder, score:p.score }))
    .sort((a,b)=>b.score-a.score || a.name.localeCompare(b.name));
  const max = rows.length ? rows[0].score : 0;
  const winners = rows.filter(r => r.score === max).map(r=>r.name);

  for (const r of rows) {
    const s = personStats(r.name);
    s.points += r.score;
    s.correct += r.score;
    s.answered += 5;
    s.games += 1;
    if (r.score === max) s.wins += 1;
  }
  persistent.history.push({ at:new Date().toISOString(), week:persistent.weekCounter, cycle:persistent.cycle, winners, players:rows });
  if (persistent.history.length > 100) persistent.history = persistent.history.slice(-100);
  persist();

  io.emit("finished", { rows, winners, allTime:allTimeRows() });
  broadcast();
}
function assignNewHost() {
  game.hostId = activePlayers()[0]?.[0] || null;
}

io.on("connection", socket => {
  socket.emit("bootstrap", { founders:FOUNDERS });
  socket.emit("state", state());

  socket.on("join", payload => {
    if (!payload || typeof payload.name !== "string" || typeof payload.founder !== "string") return;
    if (!FOUNDER_NAMES.includes(payload.founder)) return socket.emit("join-error", "Ese founder no existe.");
    if (game.phase !== "idle" && game.phase !== "lobby") return socket.emit("join-error", "La partida ya empezó. Espera la siguiente.");
    if (activePlayers().length >= 10) return socket.emit("join-error", "La partida ya tiene 10 participantes.");
    if (founderTaken(payload.founder, socket.id)) return socket.emit("join-error", "Ese founder ya fue elegido.");

    const name = payload.name.trim().slice(0,32);
    if (!name) return socket.emit("join-error", "Escribe tu nombre.");

    game.players[socket.id] = { name, founder:payload.founder, score:0 };
    if (!game.hostId) game.hostId = socket.id;
    if (game.phase === "idle") startLobbyCountdown();
    socket.emit("joined", { id:socket.id, host:socket.id===game.hostId });
    broadcast();
  });

  socket.on("change-founder", founder => {
    if (game.phase !== "lobby" || !game.players[socket.id]) return;
    if (!FOUNDER_NAMES.includes(founder) || founderTaken(founder, socket.id)) return;
    game.players[socket.id].founder = founder;
    broadcast();
  });

  socket.on("start-now", () => {
    if (socket.id === game.hostId && game.phase === "lobby" && activePlayers().length >= 1) startMatch();
  });

  socket.on("answer", choice => {
    if (game.phase !== "question" || !game.players[socket.id] || game.answers[socket.id]) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;
    game.answers[socket.id] = { choice };
    broadcast();
    maybeRevealEarly();
  });

  socket.on("new-match", () => {
    if (socket.id !== game.hostId || game.phase !== "finished") return;
    game.matchId += 1;
    for (const [,p] of activePlayers()) p.score = 0;
    startLobbyCountdown();
  });

  socket.on("disconnect", () => {
    if (!game.players[socket.id]) return;
    delete game.players[socket.id];
    if (socket.id === game.hostId) assignNewHost();
    if (activePlayers().length === 0) resetMatch();
    else if (game.phase === "question") maybeRevealEarly();
    broadcast();
  });
});

server.listen(process.env.PORT || 3000, () => console.log("Aquarossa Culture Battle V5 ready"));
