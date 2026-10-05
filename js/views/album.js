import {CN, TYPES} from '../config.js';
import {BR, RR} from '../data/regions.js';
import {DRAW, render} from '../router.js';
import {S, regKey, seenRegions, typeSeen} from '../state.js';
import {on} from '../ui/actions.js';
import {cm, sm} from '../ui/modal.js';
import {plateHTML, sampleMain} from '../ui/plate.js';
import {$, esc, pct, xf} from '../util.js';

// Альбом регионов: какие коды из справочника уже выпадали (список открытых хранится на сервере в players.seen).
let AC='RU';
const table=c=>c=='RU'?RR:BR,tl=c=>TYPES.filter(t=>t.c.includes(c));
export function drawAlbum(){
  const tb=table(AC),keys=Object.keys(tb).sort((a,b)=>a-b),seen=new Set(S.seen),n=seenRegions(AC);
  $('albumC').innerHTML=`<div class="chips">${Object.keys(CN).map(c=>`<button class="${c==AC?'a':''}" data-click="albumCountry" data-arg="${c}">${CN[c].n} ${seenRegions(c)}/${Object.keys(table(c)).length}</button>`).join('')}</div>
  <div class="sub" style="margin-bottom:8px"><span>Типы номеров ${tl(AC).filter(t=>typeSeen(t.k)).length} из ${tl(AC).length}</span></div>
  <div class="atypes">${tl(AC).map(t=>typeSeen(t.k)?`<div class="at f" data-click="albumType" data-arg="${t.k}">${plateHTML({type:t.k,main:sampleMain(AC,t.k),reg:AC=='RU'?'77':'7',country:AC},'',''  )}<span>${t.n}</span></div>`:`<div class="at" data-click="albumType" data-arg="${t.k}"><i>🔒</i><span>???</span></div>`).join('')}</div>
  <div class="sub" style="margin:16px 0 8px"><span>Открыто ${n} из ${keys.length}</span><span>${Math.round(n/keys.length*100)}%</span></div><div class="pb"><i style="width:${n/keys.length*100}%"></i></div>
  <div class="agrid">${keys.map(k=>`<div class="ac ${seen.has(regKey(AC,k))?'f':''}" data-click="albumOpen" data-arg="${k}"><b>${k}</b><span>${seen.has(regKey(AC,k))?esc(tb[k][0]):'???'}</span></div>`).join('')}</div>`}
export function albumOpen(k){
  const r=table(AC)[k],f=S.seen.includes(regKey(AC,k));
  sm(`<div class="dlg"><h3>${f?esc(r[0]):'Регион '+k}</h3><div class="tl">${CN[AC].n} · код ${k}</div><div class="tl" style="margin:10px 0 16px">${f?'Множитель цены '+xf(r[1]):'Такой номер ещё не выпадал. Продолжайте генерацию.'}</div><button class="btn" data-click="cm">Закрыть</button></div>`)}
export function albumType(k){
  const t=TYPES.find(x=>x.k==k),f=typeSeen(k),tot=tl(AC).reduce((a,b)=>a+b.p,0);
  sm(f?`<div class="dlg"><div class="pw">${plateHTML({type:k,main:sampleMain(AC,k),reg:AC=='RU'?'77':'7',country:AC},'sh','')}</div><h3>${t.n}</h3><div class="tl">${CN[AC].n} · шанс ${pct(t.p/tot*100)}% · цена ${xf(t.m)}</div><button class="btn" style="margin-top:16px" data-click="cm">Закрыть</button></div>`
   :`<div class="dlg"><h3>Тип закрыт</h3><div class="tl" style="margin:10px 0 16px">Такой номер ещё не выпадал. Продолжайте генерацию.</div><button class="btn" data-click="cm">Закрыть</button></div>`)}
DRAW.album=drawAlbum;
on({albumType:a=>albumType(a),albumCountry:a=>{AC=a;render()},albumOpen:a=>albumOpen(a)});
