import {S} from '../state.js';
import {$, fmt} from '../util.js';

// Эффекты: частицы, счётчик, ripple, звук.
export function burst(c,n){n=Math.round(n*[1,.5,0][S.fx||0]);for(let i=0;i<n;i++){const e=document.createElement('span'),a=Math.random()*6.28,r=120+Math.random()*220;e.className='p';e.style.cssText=`--c:${c};--x:${Math.cos(a)*r}px;--y:${Math.sin(a)*r}px;animation-delay:${Math.random()*.2}s`;document.body.appendChild(e);setTimeout(()=>e.remove(),1600)}}
export function count(el,to,ms=900){if(S.fx>=2){el.textContent=fmt(to)+' ₽';return}const t0=performance.now();(function s(t){const k=Math.min(1,(t-t0)/ms);el.textContent=fmt(to*(1-Math.pow(1-k,3)))+' ₽';if(k<1)requestAnimationFrame(s)})(t0)}
export function ripple(e){if(S.fx>=2)return;const r=document.createElement('span');r.className='ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.appendChild(r);setTimeout(()=>r.remove(),700)}
let AC;
function ctx(){AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state=='suspended')AC.resume();return AC}
export function beep(f,d=.08,t='sine',v=.05,at=0){if(S.mute)return;try{ctx();const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime+at;o.type=t;o.frequency.value=f;g.gain.setValueAtTime(Math.max(.0002,v*S.vol/100),n);g.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(g);g.connect(AC.destination);o.start(n);o.stop(n+d)}catch(e){}}
export function chime(c){[523,659,784,1047,1319,1568].slice(0,c+3).forEach((f,i)=>beep(f,.3,'triangle',.07,i*.09))}

// Звуки выпадения по редкости. Все уважают S.mute и S.vol.
function boom(v=.5,at=0){if(S.mute)return;try{const A=ctx(),t=A.currentTime+at,o=A.createOscillator(),g=A.createGain();
  o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(40,t+.3);
  g.gain.setValueAtTime(v*S.vol/100,t);g.gain.exponentialRampToValueAtTime(.0001,t+.5);
  o.connect(g);g.connect(A.destination);o.start(t);o.stop(t+.55)}catch(e){}}
// Нарастающий свист перед открытием эпического и легендарного номера
export function riser(dur=1.3){if(S.mute)return;try{const A=ctx(),t=A.currentTime,s=A.createBufferSource(),f=A.createBiquadFilter(),g=A.createGain();
  s.buffer=noiseBuf();s.loop=true;f.type='bandpass';f.Q.value=1.2;
  f.frequency.setValueAtTime(200,t);f.frequency.exponentialRampToValueAtTime(7000,t+dur);
  g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(.1*S.vol/100,t+dur*.85);g.gain.exponentialRampToValueAtTime(.0001,t+dur);
  s.connect(f);f.connect(g);g.connect(A.destination);s.start(t);s.stop(t+dur+.05)}catch(e){}}
export function dropSound(c){
  if(c<2){chime(c);return}
  if(c==2){chime(2);[2093,2637].forEach((f,i)=>beep(f,.4,'sine',.04,.45+i*.1));return}
  if(c==3){
    boom(.5);
    [392,494,587,784,988,1175].forEach((f,i)=>beep(f,.35,'triangle',.07,.05+i*.07));
    [784,988,1175,1568].forEach(f=>beep(f,.9,'sine',.05,.5));
    return}
  boom(.8);boom(.5,.18);
  [523,659,784,1047].forEach((f,i)=>{beep(f,.25,'sawtooth',.045,i*.11);beep(f,.25,'triangle',.07,i*.11)});
  [523,659,784,1047,1319].forEach(f=>beep(f,1.6,'sine',.06,.5));
  for(let i=0;i<10;i++)beep(2000+Math.random()*2500,.18,'sine',.025,.6+i*.12);
}

// Фоновая музыка: лоу-фай бит 90 BPM (кик, хэт, клэп, бас, арпеджио, пэд), всё синтезируется в браузере.
// Планировщик с «заглядыванием вперёд» держит ровный темп, в отличие от обычного setInterval.
const BPM=90,STEP=60/BPM/4;
const PROG=[{r:45,c:[57,60,64]},{r:41,c:[53,57,60]},{r:48,c:[55,60,64]},{r:43,c:[55,59,62]}];   // Am F C G
const mf=m=>440*Math.pow(2,(m-69)/12);
let MG,MB,MT,MN=0,MNext=0,NZ;
function noiseBuf(){if(NZ)return NZ;const a=ctx(),b=a.createBuffer(1,a.sampleRate*.5,a.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return NZ=b}
function env(g,t,v,a,d){g.gain.setValueAtTime(.0001,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)}
function tone(t,m,type,v,a,d,cut){const A=ctx(),o=A.createOscillator(),g=A.createGain(),f=A.createBiquadFilter();o.type=type;o.frequency.value=mf(m);f.type='lowpass';f.frequency.value=cut;env(g,t,v,a,d);o.connect(f);f.connect(g);g.connect(MB);o.start(t);o.stop(t+a+d+.05)}
function kick(t){const A=ctx(),o=A.createOscillator(),g=A.createGain();o.frequency.setValueAtTime(130,t);o.frequency.exponentialRampToValueAtTime(42,t+.14);env(g,t,.5,.004,.28);o.connect(g);g.connect(MB);o.start(t);o.stop(t+.35)}
function hit(t,hp,v,d,type='highpass'){const A=ctx(),s=A.createBufferSource(),f=A.createBiquadFilter(),g=A.createGain();s.buffer=noiseBuf();f.type=type;f.frequency.value=hp;env(g,t,v,.002,d);s.connect(f);f.connect(g);g.connect(MB);s.start(t);s.stop(t+d+.05)}
function mstep(t,n){
  const bar=Math.floor(n/16)%4,i=n%16,ch=PROG[bar],loop=Math.floor(n/64);
  if(i==0){ch.c.forEach(m=>tone(t,m,'triangle',.05,.5,STEP*15,900))}                       // пэд на весь такт
  if(i==0||i==8||(i==10&&bar%2))kick(t);
  if(i==4||i==12)hit(t,1400,.16,.12,'bandpass');                                              // клэп
  if(i%4==2)hit(t,7000,.05,.05);else if(i%2==1&&bar==3)hit(t,7000,.025,.03);                  // хэт
  if([0,3,6,8,11,14].includes(i))tone(t,ch.r-(i==14?0:12)+(i==6?12:0),'sawtooth',.11,.01,STEP*1.6,420);   // бас
  // арпеджио: мотив меняется каждые 4 такта, часть нот пропускается — получается «живая» мелодия
  const pat=[[0,1,2,1,3,2,1,2],[2,1,0,1,2,3,2,1]][loop%2];
  if(i%2==0&&!(i==8&&loop%3==1)){const k=pat[i/2],m=ch.c[k%3]+(k>2?24:12);tone(t,m,'square',.028,.005,STEP*2.2,2400)}}
function sched(){const A=ctx();while(MNext<A.currentTime+.35){mstep(MNext,MN);MNext+=STEP;MN++}}
export function musicSync(){
  const want=!!S.music&&!S.mute&&!document.hidden;
  try{
    if(want){
      if(!MG){const A=ctx(),dl=A.createDelay(),fb=A.createGain(),wet=A.createGain();MG=A.createGain();MB=A.createGain();
        dl.delayTime.value=STEP*3;fb.gain.value=.32;wet.gain.value=.35;                       // лёгкое эхо вместо реверба
        MB.connect(MG);MB.connect(dl);dl.connect(fb);fb.connect(dl);dl.connect(wet);wet.connect(MG);MG.connect(A.destination)}
      MG.gain.value=.55*S.vol/100;
      if(!MT){MNext=ctx().currentTime+.1;MN=0;sched();MT=setInterval(sched,100)}}
    else if(MT){clearInterval(MT);MT=null}
  }catch(e){}}
// Браузер разрешает звук только после жеста: при касании запускаем музыку, если она включена; на скрытой вкладке — пауза
addEventListener('pointerdown',()=>{if(S.music&&!MT)musicSync()},{passive:true});
document.addEventListener('visibilitychange',musicSync);
