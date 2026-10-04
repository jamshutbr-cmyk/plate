import {api} from '../api.js';
import {CN, RAR, SELL_PCT, TYPES, sellGain} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S, find} from '../state.js';
import {burst} from '../ui/fx.js';
import {banner, cm, sm} from '../ui/modal.js';
import {dots, plateHTML} from '../ui/plate.js';
import {LST, sel} from '../ui/uistate.js';
import {on, ids} from '../ui/actions.js';
import {$, fmt, xf} from '../util.js';

// Коллекция и сейф: список, сортировка, выбор, продажа.
let LPT,LPD=0;
export function lp(id){LPD=0;clearTimeout(LPT);LPT=setTimeout(()=>{LPD=1;sel.has(id)?sel.delete(id):sel.add(id);haptic('light');drawList()},450)}
export function lpc(){clearTimeout(LPT)}
export function tapRow(id){if(LPD){LPD=0;return}if(sel.size){sel.has(id)?sel.delete(id):sel.add(id);drawList()}else openP(id)}
export function drawList(){
  const ft=LST.ft?TYPES[LST.ft-1].k:null,key={date:p=>p.id,price:p=>p.price,rar:p=>p.cls*1e12+p.price}[LST.sk];
  const a=S[LST.ls].filter(p=>!ft||p.type==ft).sort((x,y)=>(key(y)-key(x))*LST.sd);
  $('lt').textContent=LST.ls=='col'?'Коллекция':'Сейф';
  $('cnt').textContent=S[LST.ls].length+' / '+(LST.ls=='col'?S.capC:S.capS);
  $('tot').textContent='Стоимость '+(LST.ls=='col'?'коллекции':'сейфа')+'  '+fmt(S[LST.ls].reduce((s,p)=>s+p.price,0))+' ₽';
  const ar=k=>LST.sk==k?(LST.sd>0?' ▼':' ▲'):'';
  $('chips').innerHTML=`<button class="${LST.ft?'a':''}" data-click="cycleFilter">${LST.ft?TYPES[LST.ft-1].n:'Фильтры'}</button><button class="${LST.sk=='date'?'a':''}" data-click="sortBy" data-arg="date">Дата${ar('date')}</button><button class="${LST.sk=='price'?'a':''}" data-click="sortBy" data-arg="price">Цена${ar('price')}</button><button class="${LST.sk=='rar'?'a':''}" data-click="sortBy" data-arg="rar">Редкость${ar('rar')}</button>`;
  $('rows').innerHTML=a.length?a.map((p,i)=>`<div class="row2 r${p.cls} ${sel.has(p.id)?'sel':''}" style="animation-delay:${Math.min(i,10)*30}ms" data-click="tapRow" data-arg="${p.id}" data-pointerdown="lp" data-pointerup="lpc" data-pointerleave="lpc" data-pointercancel="lpc" data-contextmenu="noMenu">${plateHTML(p)}<div class="ri"><span>${CN[p.country].n} · ${TYPES.find(t=>t.k==p.type).n}</span>${dots(p.cls)}<b>${fmt(p.price)} ₽</b></div></div>`).join(''):'<div class="hint" style="text-align:center;margin-top:60px">Пусто</div>';
  $('lbar').innerHTML=`<button class="btn" data-click="selAll">${sel.size&&sel.size==a.length?'Снять всё':'Выбрать всё'}</button><button class="btn" ${sel.size?'':'disabled'} data-click="moveSel">${LST.ls=='col'?'Поместить в сейф':'Достать из сейфа'}</button><button class="btn red" ${sel.size?'':'disabled'} data-click="sellDlg" data-arg="${[...sel].join(',')}">${LST.ls=='col'?'Быстрая продажа':'Продать'}</button>`}
export function sortBy(k){if(LST.sk==k)LST.sd=-LST.sd;else{LST.sk=k;LST.sd=1}drawList()}
export function selAll(){const ft=LST.ft?TYPES[LST.ft-1].k:null,a=S[LST.ls].filter(p=>!ft||p.type==ft);if(sel.size==a.length)sel.clear();else a.forEach(p=>sel.add(p.id));drawList()}
export async function moveSel(){const to=LST.ls=='col'?'safe':'col',n=await api.movePlates([...sel],to);sel.clear();render();if(!n)banner('Нет места','Расширьте хранилище в улучшениях')}
export function openP(id){
  const p=find(id),R=RAR[p.cls],T=TYPES.find(t=>t.k==p.type),inCol=S.col.some(x=>x.id==id);
  sm(`<div class="t2 r${p.cls}">${plateHTML(p,'sh')}${dots(p.cls)}<div style="font-size:24px;font-weight:700;color:${R.c}">${R.n}</div></div><div class="bd"><h2>${T.n}</h2><div class="tl">${CN[p.country].n} · ${p.reg} · ${p.rn}</div><div class="ln"><span>Базовая стоимость</span><b>100 ₽</b></div><div class="cells">${[['комбо',p.mu[0]],['цифры',p.mu[1]],['регион',p.mu[2]],['код',p.mu[3]]].map(c=>`<div>${c[0]}<b>${xf(c[1])}</b></div>`).join('')}</div><div class="ln big"><span>Цена номера</span><b>${fmt(p.price)} ₽</b></div><div class="row"><button class="btn" data-click="moveOne" data-arg="${id}">${inCol?'В сейф':'Из сейфа'}</button><button class="btn red" data-click="sellDlg" data-arg="${id}">Продать</button></div></div>`)}
export function sellDlg(ids){
  const tot=ids.reduce((s,i)=>s+(find(i)?.price||0),0);
  sm(`<div class="dlg"><h3>Цена — ${fmt(tot)} ₽</h3><button class="btn red" data-click="sell" data-arg="${ids}">Продать (−${100-SELL_PCT}%)<b>${fmt(sellGain(tot))} ₽</b></button></div>`)}
export async function sell(ids){cm();await api.sellPlates(ids);sel.clear();render(true);burst('#f5b82e',12)}
export function cycleFilter(){LST.ft=(LST.ft+1)%4;sel.clear();drawList()}
export function moveOne(id){sel.clear();sel.add(id);moveSel();cm()}
DRAW.list=drawList;
on({lp:a=>lp(+a),lpc,noMenu:()=>false,tapRow:a=>tapRow(+a),sortBy:a=>sortBy(a),selAll,moveSel,moveOne:a=>moveOne(+a),sellDlg:a=>sellDlg(ids(a)),sell:a=>sell(ids(a)),cycleFilter});
