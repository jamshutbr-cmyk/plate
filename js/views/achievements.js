import {ACH, tier, tiers} from '../data/achievements.js';
import {DRAW, painters,render} from '../router.js';
import {icon} from '../ui/design.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {$, fmt} from '../util.js';

// Экран достижений + уведомление о новой ступени.
let EXPANDED=null,ACHFILTER='all';
export function drawAch(){const T=tiers(),got=Object.values(T).reduce((s,x)=>s+x,0),total=ACH.reduce((s,a)=>s+a.g.length,0),shown=ACH.filter(a=>ACHFILTER==='all'||(ACHFILTER==='done'?T[a.id]>=a.g.length:T[a.id]<a.g.length));
 $('achC').innerHTML=`<div class="reward-overview"><div><span class="v3-kicker">ТВОЯ ЛИЧНАЯ ДИСТАНЦИЯ</span><h1>Каждый шаг<br><em>оставляет след.</em></h1></div><div class="reward-total"><strong>${got}<small> / ${total}</small></strong><span>ступеней пройдено</span></div></div><div class="reward-filter">${[['all','Все направления'],['progress','В пути'],['done','Завершены']].map(([k,n])=>`<button class="${ACHFILTER===k?'a':''}" data-click="achFilter" data-arg="${k}">${n}</button>`).join('')}</div><div class="reward-paths">${shown.map((a,i)=>{const v=a.v(),t=T[a.id],max=t>=a.g.length,prev=t?a.g[t-1]:0,nx=a.g[Math.min(t,a.g.length-1)],pc=max?100:Math.max(0,(v-prev)/(nx-prev)*100),open=EXPANDED===a.id;return `<section class="reward-path ${open?'open':''} ${max?'complete':''}"><button class="reward-path-heading" data-click="achExpand" data-arg="${a.id}" aria-expanded="${open}"><span class="reward-index">${String(i+1).padStart(2,'0')}</span><span><b>${a.n}</b><small>${max?'Все ступени пройдены':fmt(v)+(a.u||'')+' / '+fmt(nx)+(a.u||'')}</small><i><u style="width:${pc}%"></u></i></span><span class="reward-stages">${t}/${a.g.length}<em>${open?'−':'+'}</em></span></button>${open?`<div class="reward-path-body"><p>${a.d}</p><div class="reward-milestones">${a.g.map((g,j)=>`<span class="${j<t?'passed':''}"><i>${j<t?'✓':j+1}</i><b>${fmt(g)}${a.u||''}</b><small>${j<t?'Пройдено':j===t?'Следующий рубеж':'Впереди'}</small></span>`).join('')}</div></div>`:''}</section>`}).join('')||'<p class="v3-search-empty">В этой категории пока нет достижений.</p>'}</div>`;
}
on({achExpand:a=>{EXPANDED=EXPANDED===a?null:a;render(true)},achFilter:a=>{ACHFILTER=a;render(true)}});
// Следим за ступенями при каждой перерисовке. Первый вызов только запоминает состояние (без баннеров),
// дальше сообщаем только о росте: после сброса прогресса или загрузки данных ничего не всплывает.
let LAST=null;
export function checkAch(){
  const T=tiers(),up=LAST&&ACH.filter(a=>T[a.id]>LAST[a.id]);
  LAST=T;
  if(up&&up.length)setTimeout(()=>banner('Достижение · '+up.map(a=>a.i+' '+a.n).join(', '),up.length==1?'Ступень '+T[up[0].id]+' из '+up[0].g.length:'Новых ступеней: '+up.length),3400)}
painters.push(checkAch);
DRAW.ach=drawAch;
