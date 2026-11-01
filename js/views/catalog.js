import {CD, CN, RAR, TYPES} from '../config.js';
import {BR, RR} from '../data/regions.js';
import {DRAW} from '../router.js';
import {icon} from '../ui/design.js';
import {on} from '../ui/actions.js';
import {cm, sm} from '../ui/modal.js';
import {dots, plateHTML, sampleMain} from '../ui/plate.js';
import {typeSeen as isOpen} from '../state.js';
import {$, fmt} from '../util.js';

// Каталог редкостей.
let CC='RU',CT=0,CR='77',ACTIVE=0;
// Типы выбранной страны; ещё не выпавшие показываем закрытыми.
const tl=()=>TYPES.filter(t=>t.c.includes(CC));
export function catItem(i){
  const tb=CC=='RU'?RR:BR,T=tl()[CT],main=sampleMain(CC,T.k,i);
  if(!main||!isOpen(T.k))return null;
  return {p:{type:T.k,main,reg:CR,country:CC,cls:i},price:Math.round(100*RAR[i].m*tb[CR][1]*T.m)}}
let DD=-1;
export function dd(i,label,cur,opts,fn){return `<div class="dd ${DD==i?'on':''}"><button class="ddb" data-click="ddToggle" data-arg="${i}"><span>${label}</span><i></i></button><div class="ddl">${opts.map(o=>`<div class="ddo ${o[0]==cur?'a':''}" data-click="${fn}" data-arg="${o[0]}">${o[1]}</div>`).join('')}</div></div>`}
export function pickC(v){CC=v;CR=v=='RU'?'77':'7';CT=0;DD=-1;drawCat()}
export function pickT(v){CT=+v;DD=-1;drawCat()}
export function pickR(v){CR=v;DD=-1;drawCat()}
document.addEventListener('click',e=>{if(DD>=0&&!e.target.closest('.dd')){DD=-1;drawCat()}});
export function drawCat(){
  if(!$('v-cat').classList.contains('on'))return;
  const tb=CC=='RU'?RR:BR,o=(v,t,c)=>`<option value="${v}" ${c?'selected':''}>${t}</option>`;
  const cl=k=>`<i class="flag fl-${k}" style="width:1.5em"></i> ${CN[k].n}`;
  $('csel').innerHTML=dd(0,cl(CC),CC,Object.keys(CN).map(k=>[k,cl(k)]),'pickC')+dd(1,isOpen(tl()[CT].k)?tl()[CT].n:'Не открыт',CT,tl().map((t,i)=>[i,isOpen(t.k)?t.n:'Не открыт']),'pickT')+dd(2,tb[CR][0],CR,Object.keys(tb).map(k=>[k,tb[k][0]+' · '+k]),'pickR');
  const ac=document.querySelector('.dd.on .ddo.a');if(ac){const l=ac.parentNode;l.scrollTop=ac.offsetTop-l.clientHeight/2}
  if(!isOpen(tl()[CT].k)){$('ccards').innerHTML='<div class="clock"><b>:pi/safe:</b><span>Тип закрыт</span><small>Он откроется, когда такой номер выпадет в первый раз</small></div>';return}
  const choices=RAR.map((r,i)=>({r,i,it:catItem(i)})).filter(x=>x.it),selected=choices.find(x=>x.i===ACTIVE)||choices[0];if(!selected){$('ccards').innerHTML='<p class="tl">Нет доступных образцов.</p>';return}
  const {r:R,i,it}=selected;
  $('ccards').innerHTML=`${choices.some(x=>x.i===5)?`<button class="v3-text mythic-shortcut" data-click="catSelect" data-arg="5">${icon('dshop')} Где мифический? Открыть шестой класс ${icon('arrow')}</button>`:''}<div class="reference-layout"><nav class="reference-scale" aria-label="Уровни редкости">${choices.map(({r,i})=>`<button class="${i===selected.i?'a':''}" data-click="catSelect" data-arg="${i}"><span>0${i+1}</span><i style="background:${r.c}"></i><b>${r.n}</b><small>${r.ps||String(r.p).replace('.',',')}%</small></button>`).join('')}</nav><section class="reference-sheet">${i===5?`<aside class="mythic-note"><b>Мифический — шестой класс</b><p>Серии-слова вроде ВОР, АМР и МЕР. Базовые 0,005% — отдельный бросок только для российских форматов с тремя буквами, до усилений. В Беларуси этот класс не выпадает. В «Ночи тыкв» действует отдельная событийная шкала.</p></aside>`:''}<div class="reference-number">КЛАСС / 0${i+1}<span>ОБРАЗЕЦ КОМБИНАЦИИ</span></div><div class="reference-plate">${plateHTML(it.p)}</div><h1>${R.n}</h1><p>${CD[i]}</p><div class="reference-facts"><div><span>Шанс выпадения</span><strong>${R.ps||String(R.p).replace('.',',')}<small>%</small></strong></div><div><span>Оценка от</span><strong>${fmt(it.price)}<small> ₽</small></strong></div></div><button class="v3-text" data-click="openCat" data-arg="${i}">Разобрать комбинацию ${icon('plus')}</button></section></div>`;
}
export function openCat(i){
  const R=RAR[i],it=catItem(i);if(!it)return;
  sm(`<div class="t2 r${i}">${plateHTML(it.p,'sh')}${dots(i)}<div style="font-size:24px;font-weight:700;color:${R.c}">${R.n}</div></div><div class="bd"><h2>${R.ps||String(R.p).replace('.',',')}%</h2><div class="tl">шанс выпадения</div><div class="ln"><span>Как выпадает</span><b style="text-align:right;max-width:60%;font-size:15px">${CD[i]}</b></div><div class="ln big"><span>Цена от</span><b>${fmt(it.price)} ₽</b></div><button class="btn" data-click="cm">Закрыть</button></div>`)}
export function ddToggle(i){DD=DD==i?-1:i;drawCat()}
DRAW.cat=drawCat;
on({catSelect:a=>{ACTIVE=+a;drawCat()},pickC,pickT,pickR,ddToggle:a=>ddToggle(+a),openCat:a=>openCat(+a)});
