import {ACH, tier, tiers} from '../data/achievements.js';
import {DRAW, painters} from '../router.js';
import {banner} from '../ui/modal.js';
import {$, fmt} from '../util.js';

// Экран достижений + уведомление о новой ступени.
export function drawAch(){
  const T=tiers(),got=Object.values(T).reduce((s,x)=>s+x,0),all=ACH.reduce((s,a)=>s+a.g.length,0);
  $('achC').innerHTML=`<div class="card"><h3><span>Получено ступеней</span><span>${got} / ${all}</span></h3><div class="pb"><i style="width:${got/all*100}%"></i></div></div>`+
  ACH.map(a=>{const v=a.v(),t=T[a.id],max=t>=a.g.length,prev=t?a.g[t-1]:0,nx=a.g[Math.min(t,a.g.length-1)],pc=max?100:Math.max(0,(v-prev)/(nx-prev)*100),u=a.u||'';
    return `<div class="card ach ${max?'max':''}"><h3><span>${a.i} ${a.n}</span><span class="stars">${a.g.map((_,i)=>i<t?'★':'☆').join('')}</span></h3><div class="tl">${a.d}</div><div class="pb" style="margin:10px 0 6px"><i class="${max?'max':''}" style="width:${pc}%"></i></div><div class="sub"><span>${fmt(v)}${u}${max?'':' / '+fmt(nx)+u}</span><span>${max?'Максимум ✓':'Ступень '+(t+1)+' из '+a.g.length}</span></div></div>`}).join('')}
// Следим за ступенями при каждой перерисовке. Первый вызов только запоминает состояние (без баннеров),
// дальше сообщаем только о росте: после сброса прогресса или загрузки данных ничего не всплывает.
let LAST=null;
export function checkAch(){
  const T=tiers(),up=LAST&&ACH.filter(a=>T[a.id]>LAST[a.id]);
  LAST=T;
  if(up&&up.length)setTimeout(()=>banner('Достижение · '+up.map(a=>a.i+' '+a.n).join(', '),up.length==1?'Ступень '+T[up[0].id]+' из '+up[0].g.length:'Новых ступеней: '+up.length),3400)}
painters.push(checkAch);
DRAW.ach=drawAch;
