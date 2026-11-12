const fs=require('fs'),vm=require('vm'),assert=require('assert');
let connection,now=100000,timers=new Map(),seq=0,events=[];
const express=()=>({use(){}});express.static=()=>{};
class IO{constructor(){}on(name,fn){connection=fn}emit(name,payload){events.push({name,payload})}}
const context={require:n=>n==='express'?express:n==='http'?{createServer:()=>({listen(){}})}:n==='socket.io'?{Server:IO}:n==='fs'?{readFileSync(){throw Error()},writeFileSync(){}}:n==='path'?require('path'):require(require('path').join(__dirname,'..')+'/'+n.replace('./','')),__dirname:require('path').join(__dirname,'..'),process:{env:{}},console,Date:class extends Date{static now(){return now}},setTimeout:(fn,ms)=>{const id=++seq;timers.set(id,{fn,at:now+ms});return id},clearTimeout:id=>timers.delete(id)};
vm.createContext(context);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../server.js'),'utf8'),context);
const run=s=>vm.runInContext(s,context),state=()=>run('state()');
function client(id){let handlers={},sent=[];connection({id,on:(k,f)=>handlers[k]=f,emit:(name,p)=>sent.push({name,p})});return {send:(k,p)=>handlers[k](p),sent}}
function advance(ms){let target=now+ms;while(true){const next=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;now=next[1].at;timers.delete(next[0]);next[1].fn()}now=target}
const a=client('a'),b=client('b'),spectator=client('c');
a.send('start-lobby');assert.equal(Object.keys(state().players).length,0);
a.send('join-game','  Felipe  ');b.send('join-game','felipe');assert.equal(b.sent.at(-1).p,'duplicate');b.send('join-game','Alexia');assert.equal(Object.keys(state().players).length,2);
advance(30100);assert.equal(state().phase,'question');
const answer=(client,choice)=>client.send('answer',{choice,matchId:state().matchId,questionId:state().question.id,tieRound:state().phase==='tiebreak'?state().tieRound:0});
for(let i=0;i<5;i++){let correct=run('game.questions[game.round].correct');answer(spectator,correct);assert.equal(state().answeredIds.length,0);answer(a,correct);answer(b,correct);assert.equal(state().phase,'reveal');assert.equal(state().players.a.score,i+1);advance(6500)}
assert.equal(state().phase,'tie-rules');assert.equal(state().finalResult,null);advance(8000);assert.equal(state().phase,'tie-countdown');assert.equal(state().question,null);advance(5000);assert.equal(state().phase,'tiebreak');assert.equal(state().questionDeadline-now,5000);
let correct=run('game.tieQuestion.correct');answer(spectator,correct);assert.equal(state().phase,'tiebreak');answer(a,(correct+1)%3);answer(a,correct);assert.equal(state().phase,'tiebreak');assert.equal(state().eliminatedIds[0],'a');
advance(5000);assert.equal(state().phase,'tie-retry');advance(3500+5000);assert.equal(state().phase,'tiebreak');assert.equal(state().eliminatedIds.length,0);
correct=run('game.tieQuestion.correct');answer(a,(correct+1)%3);answer(b,(correct+1)%3);assert.equal(state().phase,'tie-retry');advance(8500);correct=run('game.tieQuestion.correct');const late={choice:correct,matchId:state().matchId,questionId:state().question.id,tieRound:state().tieRound};answer(b,correct);a.send('answer',late);assert.equal(state().phase,'finished');assert.deepEqual([...state().finalResult.winners],['Alexia']);assert.equal(run('persistent.people.alexia.wins'),1);assert.equal(run('persistent.people.felipe.wins'),0);assert.equal(state().finalResult.rows[0].id,'b');
a.send('new-match');a.send('start-lobby');advance(30100);assert.equal(state().phase,'waiting');
console.log('PASS: named joins, duplicate rejection, spectators, five scored rounds, live scores, rules/countdown timing, 5s deadline, elimination, timeout retry, all-wrong retry, first-correct winner, single recorded victory, empty lobby.');
// Parse the client script too.
const html=fs.readFileSync(require('path').join(__dirname,'../public/index.html'),'utf8');new vm.Script(html.slice(html.indexOf('<script>')+8,html.indexOf('</script>',html.indexOf('<script>'))));console.log('PASS: client syntax');
