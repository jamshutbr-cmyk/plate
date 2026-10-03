import {S} from '../state.js';
import {$, fmt} from '../util.js';

// Эффекты: частицы, счётчик, ripple, звук.
export function burst(c,n){n=Math.round(n*[1,.5,0][S.fx||0]);for(let i=0;i<n;i++){const e=document.createElement('span'),a=Math.random()*6.28,r=120+Math.random()*220;e.className='p';e.style.cssText=`--c:${c};--x:${Math.cos(a)*r}px;--y:${Math.sin(a)*r}px;animation-delay:${Math.random()*.2}s`;document.body.appendChild(e);setTimeout(()=>e.remove(),1600)}}
export function count(el,to,ms=900){const t0=performance.now();(function s(t){const k=Math.min(1,(t-t0)/ms);el.textContent=fmt(to*(1-Math.pow(1-k,3)))+' ₽';if(k<1)requestAnimationFrame(s)})(t0)}
export function ripple(e){const r=document.createElement('span');r.className='ripple';r.style.left=e.clientX+'px';r.style.top=e.clientY+'px';document.body.appendChild(r);setTimeout(()=>r.remove(),700)}
let AC;
export function beep(f,d=.08,t='sine',v=.05,at=0){if(S.mute)return;try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();const o=AC.createOscillator(),g=AC.createGain(),n=AC.currentTime+at;o.type=t;o.frequency.value=f;g.gain.setValueAtTime(Math.max(.0002,v*S.vol/100),n);g.gain.exponentialRampToValueAtTime(.0001,n+d);o.connect(g);g.connect(AC.destination);o.start(n);o.stop(n+d)}catch(e){}}
export function chime(c){[523,659,784,1047,1319,1568].slice(0,c+3).forEach((f,i)=>beep(f,.3,'triangle',.07,i*.09))}
