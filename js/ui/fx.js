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

// Фоновая музыка: спокойный генеративный эквалайзер-пэд (аккорды Am–F–C–G + арпеджио), без внешних файлов.
const CH=[[220,261.6,329.6],[174.6,220,261.6],[261.6,329.6,392],[196,246.9,293.7]];
let MG,MT,MS=0;
function mtone(f,d,v,type){const a=ctx(),o=a.createOscillator(),g=a.createGain(),n=a.currentTime;o.type=type;o.frequency.value=f;g.gain.setValueAtTime(.0001,n);g.gain.linearRampToValueAtTime(v,n+Math.min(.4,d/3));g.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(g);g.connect(MG);o.start(n);o.stop(n+d)}
function mtick(){const c=CH[(MS>>3)%4],i=MS%8;
  if(i==0)c.forEach(f=>mtone(f/2,4.6,.05,'sine'));
  mtone(c[i%3]*(i%2?2:1),.9,.035,'triangle');MS++}
export function musicSync(){
  const want=!!S.music&&!S.mute;
  try{
    if(want){if(!MG){MG=ctx().createGain();MG.connect(AC.destination)}
      MG.gain.value=.9*S.vol/100;
      if(!MT){ctx();mtick();MT=setInterval(mtick,550)}}
    else if(MT){clearInterval(MT);MT=null}
  }catch(e){}}
// Браузер разрешает звук только после жеста: при первом касании запускаем музыку, если она включена
addEventListener('pointerdown',()=>{if(S.music&&!MT)musicSync()},{once:false,passive:true});
