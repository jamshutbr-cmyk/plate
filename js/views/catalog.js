import {CD, CN, RAR, SAMP, TYPES} from '../config.js';
import {BR, RR} from '../data/regions.js';
import {DRAW} from '../router.js';
import {on} from '../ui/actions.js';
import {cm, sm} from '../ui/modal.js';
import {dots, plateHTML} from '../ui/plate.js';
import {$, fmt} from '../util.js';

// Каталог редкостей.
let CC='RU',CT=0,CR='77';
export function catItem(i){
  const tb=CC=='RU'?RR:BR,T=TYPES[CT],l=CC=='RU'?(SAMP.RU[T.k=='taxi'?'taxi':'civil']):SAMP.BY,main=l[i];
  if(!main)return null;
  return {p:{type:T.k,main,reg:CR,country:CC,cls:i},price:Math.round(100*RAR[i].m*tb[CR][1]*T.m)}}
let DD=-1;
export function dd(i,label,cur,opts,fn){return `<div class="dd ${DD==i?'on':''}"><button class="ddb" data-click="ddToggle" data-arg="${i}"><span>${label}</span><i></i></button><div class="ddl">${opts.map(o=>`<div class="ddo ${o[0]==cur?'a':''}" data-click="${fn}" data-arg="${o[0]}">${o[1]}</div>`).join('')}</div></div>`}
export function pickC(v){CC=v;CR=v=='RU'?'77':'7';DD=-1;drawCat()}
export function pickT(v){CT=+v;DD=-1;drawCat()}
export function pickR(v){CR=v;DD=-1;drawCat()}
document.addEventListener('click',e=>{if(DD>=0&&!e.target.closest('.dd')){DD=-1;drawCat()}});
export function drawCat(){
  if(!$('v-cat').classList.contains('on'))return;
  const tb=CC=='RU'?RR:BR,o=(v,t,c)=>`<option value="${v}" ${c?'selected':''}>${t}</option>`;
  const cl=k=>`<i class="flag fl-${k}" style="width:1.5em"></i> ${CN[k].n}`;
  $('csel').innerHTML=dd(0,cl(CC),CC,Object.keys(CN).map(k=>[k,cl(k)]),'pickC')+dd(1,TYPES[CT].n,CT,TYPES.map((t,i)=>[i,t.n]),'pickT')+dd(2,tb[CR][0],CR,Object.keys(tb).map(k=>[k,tb[k][0]+' · '+k]),'pickR');
  const ac=document.querySelector('.dd.on .ddo.a');if(ac){const l=ac.parentNode;l.scrollTop=ac.offsetTop-l.clientHeight/2}
  $('ccards').innerHTML=RAR.map((R,i)=>{const it=catItem(i);return it?`<div class="cc r${i}" style="animation-delay:${i*70}ms" data-click="openCat" data-arg="${i}"><div class="pw">${plateHTML(it.p)}</div><div class="cf"><div style="color:${R.c}">${R.n}${dots(i)}</div><b>${String(R.p).replace('.',',')}%</b><span>${fmt(it.price)} ₽+</span></div></div>`:''}).join('')}
export function openCat(i){
  const R=RAR[i],it=catItem(i);
  sm(`<div class="t2 r${i}">${plateHTML(it.p,'sh')}${dots(i)}<div style="font-size:24px;font-weight:700;color:${R.c}">${R.n}</div></div><div class="bd"><h2>${String(R.p).replace('.',',')}%</h2><div class="tl">шанс выпадения</div><div class="ln"><span>Как выпадает</span><b style="text-align:right;max-width:60%;font-size:15px">${CD[i]}</b></div><div class="ln big"><span>Цена от</span><b>${fmt(it.price)} ₽</b></div><button class="btn" data-click="cm">Закрыть</button></div>`)}
export function ddToggle(i){DD=DD==i?-1:i;drawCat()}
DRAW.cat=drawCat;
on({pickC,pickT,pickR,ddToggle:a=>ddToggle(+a),openCat:a=>openCat(+a)});
