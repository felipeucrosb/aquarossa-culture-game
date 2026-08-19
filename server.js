const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, "public")));

const CHARACTERS = ["Cris", "Jessi", "Felipe"];
const challenges = [
{type:"Spot the Value",title:"La idea del junior",prompt:"Un gerente propone una idea. Una persona junior propone otra totalmente diferente y los números preliminares muestran que la segunda puede funcionar mejor. ¿Qué debería pasar?",options:["Seguir al gerente por experiencia","Probar la idea que parece mejor, sin importar quién la propuso","Dejar que el gerente decida","Esperar a la próxima reunión"],correct:1,value:"La mejor idea gana",explain:"El cargo no decide. Si una idea sirve mejor a la misión, clientes y objetivos, debe ganar."},
{type:"Culture Court",title:"El proceso de siempre",prompt:"Un proceso lleva años haciéndose igual. Nadie se ha quejado, pero alguien cree que puede reducirse de 8 pasos a 4. ¿Qué harías?",options:["No tocarlo si funciona","Probar la versión de 4 pasos con una muestra pequeña","Cambiarlo para todos desde mañana","Esperar a tener un problema"],correct:1,value:"Siempre es el Día 1",explain:"Día 1 significa cuestionar incluso lo que funciona y aprender rápido, sin cambiar a ciegas."},
{type:"Value vs. Value",title:"Idea loca, pocos datos",prompt:"Alguien propone una idea que podría aumentar ventas 30%, pero nunca la hemos probado y no hay suficientes datos. ¿Cuál es la mejor respuesta?",options:["No hacerla hasta tener certeza","Lanzarla completa","Diseñar un experimento pequeño y medir","Elegir por intuición"],correct:2,value:"Nada es demasiado loco",explain:"Ser audaz no significa apostar a ciegas. Probamos algo audaz y luego dejamos que los datos hablen."},
{type:"Culture Court",title:"La promesa incómoda",prompt:"Prometiste entregar un análisis hoy. A las 4:30 PM te das cuenta de que no llegas. ¿Qué representa mejor nuestra cultura?",options:["Entregar algo incompleto sin decir nada","Avisar de inmediato, asumir responsabilidad y acordar una nueva hora concreta","Esperar a que te pregunten","Pedir a alguien que te cubra"],correct:1,value:"Adueñate de tu palabra",explain:"Adueñarte de tu palabra también significa comunicar temprano cuando un compromiso está en riesgo."},
{type:"Spot the Problem",title:"Opinión vs. evidencia",prompt:"En una reunión hay tres opiniones diferentes sobre por qué bajaron las ventas. ¿Cuál debería ser el siguiente paso?",options:["Votar","Seguir a la persona con más experiencia","Abrir los datos y probar hipótesis","Promediar opiniones"],correct:2,value:"Los datos tienen la última palabra",explain:"Las opiniones pueden iniciar preguntas; los datos deben cerrar la discusión."},
{type:"What Would You Do?",title:"El cliente no es de tu área",prompt:"Te enteras de un problema serio de un cliente, pero pertenece a otro departamento. ¿Qué haces?",options:["Lo reenvías y sigues","Te aseguras de que tenga dueño y haces seguimiento hasta confirmar solución","Le dices al cliente que contacte al área correcta","Esperas a que tu jefe lo vea"],correct:1,value:"Adueñate de tu palabra",explain:"Ownership no es hacer el trabajo de todos; es no permitir que un problema importante quede sin dueño."},
{type:"Spot the Value",title:"Cero ego",prompt:"Tu propuesta favorita pierde frente a otra claramente mejor. ¿Qué comportamiento representa mejor la cultura?",options:["Defenderla una vez más","Apoyar activamente la mejor idea aunque no sea tuya","Dejar de participar","Pedir que quede pendiente"],correct:1,value:"La mejor idea gana",explain:"La mejor idea gana solo funciona si el ego queda en segundo plano después de decidir."},
{type:"Culture Court",title:"Reporte perfecto, tarde",prompt:"Un reporte puede estar 95% listo hoy o 100% perfecto en tres días, pero la decisión debe tomarse mañana. ¿Qué harías?",options:["Esperar perfección","Entregar lo útil hoy, señalando límites y supuestos","No entregar nada","Decidir sin datos"],correct:1,value:"Siempre es el Día 1",explain:"Urgencia con criterio. El objetivo no es perfección; es aprender y decidir mejor, más rápido."},
{type:"Value vs. Value",title:"El experimento no funcionó",prompt:"Probaste una idea audaz y los resultados fueron malos. ¿Cuál es la reacción correcta?",options:["Buscar culpable","Ocultar el experimento","Documentar qué aprendimos y ajustar o matar la idea","Seguir invirtiendo"],correct:2,value:"Los datos tienen la última palabra",explain:"Una idea fallida puede ser valiosa si genera aprendizaje. Los datos deciden si iteramos o paramos."},
{type:"What Would You Do?",title:"La oportunidad rara",prompt:"Aparece una oportunidad nueva que nadie en la industria parece estar haciendo. Tiene riesgo limitado y upside alto. ¿Qué hacemos?",options:["Descartarla","Buscar una prueba barata y rápida","Hacer un plan de 6 meses","Esperar a la competencia"],correct:1,value:"Nada es demasiado loco",explain:"Las mejores ideas a veces empiezan sonando raras. La disciplina está en diseñar el test, no en matar la creatividad."},
{type:"Culture Court",title:"Métrica incómoda",prompt:"Los datos muestran que una iniciativa liderada por ti no está funcionando. ¿Qué haces?",options:["Buscar otra métrica","Seguir por lo ya invertido","Reconocerlo, entender por qué y cambiar","Esperar sin modificar"],correct:2,value:"Los datos tienen la última palabra",explain:"Los datos tienen la última palabra especialmente cuando contradicen nuestra propia opinión."},
{type:"Crazy Idea",title:"La idea que da pena decir",prompt:"Tienes una idea que suena rara pero podría reducir un costo importante. ¿Qué deberías hacer?",options:["Guardarla hasta estar seguro","Compartirla y plantear cómo probarla barato","Decírsela solo a un amigo","Esperar"],correct:1,value:"Nada es demasiado loco",explain:"La cultura debe hacer seguro decir ideas audaces antes de que estén perfectas."}
];

const game = {
  players:{}, characterTaken:{}, phase:"lobby", roundIndex:0, roundIds:[],
  answers:{}, cumulative:{Cris:0,Jessi:0,Felipe:0}, weekWins:{Cris:0,Jessi:0,Felipe:0},
  weeklyScore:{Cris:0,Jessi:0,Felipe:0}
};
function pickRounds(){
  game.roundIds = challenges.map((_,i)=>i).sort(()=>Math.random()-.5).slice(0,3);
  game.roundIndex=0; game.answers={}; game.weeklyScore={Cris:0,Jessi:0,Felipe:0};
}
pickRounds();
function publicState(){
  const r=challenges[game.roundIds[game.roundIndex]];
  return {
    characters:CHARACTERS,
    players:Object.values(game.players).map(p=>({character:p.character})),
    phase:game.phase, roundIndex:game.roundIndex, totalRounds:3,
    round: game.phase==="lobby"?null:{
      type:r.type,title:r.title,prompt:r.prompt,options:r.options,
      value:game.phase==="reveal"?r.value:null,
      explain:game.phase==="reveal"?r.explain:null,
      correct:game.phase==="reveal"?r.correct:null
    },
    submitted:Object.keys(game.answers).length,
    weeklyScore:game.weeklyScore,cumulative:game.cumulative,weekWins:game.weekWins
  };
}
function broadcast(){ io.emit("state", publicState()); }

io.on("connection", socket=>{
  socket.emit("state", publicState());

  socket.on("choose-character", ({character})=>{
    if(!CHARACTERS.includes(character)) return;
    if(game.characterTaken[character] && game.characterTaken[character]!==socket.id)
      return socket.emit("character-error","Ese personaje ya fue elegido.");
    const prev=game.players[socket.id]?.character;
    if(prev) delete game.characterTaken[prev];
    game.players[socket.id]={character}; game.characterTaken[character]=socket.id;
    socket.emit("character-ok",character); broadcast();
  });

  socket.on("start-game", ()=>{
    if(Object.keys(game.characterTaken).length!==3)
      return socket.emit("game-error","Los 3 personajes deben estar conectados.");
    pickRounds(); game.phase="answer"; broadcast();
  });

  socket.on("answer", ({choice})=>{
    const p=game.players[socket.id];
    if(!p || game.phase!=="answer" || game.answers[p.character]!==undefined) return;
    const r=challenges[game.roundIds[game.roundIndex]];
    game.answers[p.character]=choice;
    if(choice===r.correct) game.weeklyScore[p.character]+=1;
    if(Object.keys(game.answers).length===3) game.phase="reveal";
    broadcast();
  });

  socket.on("next-round", ()=>{
    if(game.phase!=="reveal") return;
    if(game.roundIndex<2){
      game.roundIndex++; game.answers={}; game.phase="answer";
    } else {
      const max=Math.max(...Object.values(game.weeklyScore));
      for(const [name,pts] of Object.entries(game.weeklyScore)){
        game.cumulative[name]+=pts;
        if(pts===max) game.weekWins[name]+=1;
      }
      game.phase="finished";
    }
    broadcast();
  });

  socket.on("new-week", ()=>{ pickRounds(); game.phase="lobby"; broadcast(); });

  socket.on("disconnect", ()=>{
    const p=game.players[socket.id];
    if(p){ delete game.characterTaken[p.character]; delete game.players[socket.id]; broadcast(); }
  });
});

server.listen(process.env.PORT||3000, ()=>console.log("Aquarossa Culture Battle ready"));
