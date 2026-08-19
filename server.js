
const express=require("express"), http=require("http");
const {Server}=require("socket.io");
const fs=require("fs"), path=require("path");
const app=express(), server=http.createServer(app), io=new Server(server);
app.use(express.static("public"));
const FILE=path.join(__dirname,"data.json");
const founders=["MR. BEZOS","MR. MUSK","MR. GROVE","MR. JOBS","MR. ZUCKERBERG","MR. BRANSON","MR. THIEL","MR. KALANICK","MR. NEUMANN","MR. DORSEY"];
let saved={used:[],lastCats:[],career:Object.fromEntries(founders.map(x=>[x,{points:0,wins:0,games:0}]))};
try{saved={...saved,...JSON.parse(fs.readFileSync(FILE))}}catch{}
let game={players:{},round:0,questions:[],answers:{},active:false,deadline:0};
const Q=require("./questions.json");
const persist=()=>{try{fs.writeFileSync(FILE,JSON.stringify(saved,null,2))}catch{}};
function pick(){
 let available=Q.filter(q=>!saved.used.includes(q.id)&&!saved.lastCats.includes(q.category));
 if(available.length<5){saved.used=[]; available=Q.filter(q=>!saved.lastCats.includes(q.category))}
 let cats=[...new Set(available.map(q=>q.category))].sort(()=>Math.random()-.5).slice(0,5);
 let picks=cats.map(c=>available.filter(q=>q.category===c).sort(()=>Math.random()-.5)[0]);
 saved.used.push(...picks.map(x=>x.id)); saved.lastCats=picks.map(x=>x.category); persist(); return picks;
}
function publicState(){
 return {players:game.players,round:game.round,active:game.active,deadline:game.deadline,
 question:game.active?game.questions[game.round]:null, answered:Object.keys(game.answers),career:saved.career};
}
function emit(){io.emit("state",publicState())}
function next(){
 game.answers={};
 if(game.round>=4){finish();return}
 game.round++; game.deadline=Date.now()+30000; emit(); setTimeout(()=>{if(game.active&&Date.now()>=game.deadline) reveal()},30100);
}
function reveal(){
 if(!game.active)return;
 let q=game.questions[game.round], result={q,answers:game.answers};
 Object.entries(game.answers).forEach(([id,a])=>{if(a.choice===q.correct){game.players[id].score++; saved.career[game.players[id].founder].points++}});
 io.emit("reveal",result); persist(); setTimeout(next,5000);
}
function finish(){
 game.active=false;
 let ps=Object.values(game.players), max=Math.max(0,...ps.map(p=>p.score));
 ps.forEach(p=>{saved.career[p.founder].games++; if(p.score===max&&max>0)saved.career[p.founder].wins++});
 persist(); io.emit("finished",{players:game.players,career:saved.career}); emit();
}
io.on("connection",s=>{
 s.emit("state",publicState());
 s.on("join",f=>{if(!founders.includes(f)||Object.values(game.players).some(p=>p.founder===f))return;game.players[s.id]={founder:f,score:0};emit()});
 s.on("start",()=>{if(Object.keys(game.players).length<2)return;game.questions=pick();game.round=0;game.answers={};game.active=true;game.deadline=Date.now()+30000;emit();setTimeout(()=>{if(game.active&&Date.now()>=game.deadline)reveal()},30100)});
 s.on("answer",choice=>{if(!game.active||game.answers[s.id])return;game.answers[s.id]={choice};emit();if(Object.keys(game.answers).length===Object.keys(game.players).length)reveal()});
 s.on("disconnect",()=>{delete game.players[s.id];emit()});
});
server.listen(process.env.PORT||3000,()=>console.log("Aquarossa Culture Battle V4 ready"));
