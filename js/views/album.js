import {CN} from '../config.js';
import {BR, RR} from '../data/regions.js';
import {DRAW, render} from '../router.js';
import {S, regKey, seenRegions} from '../state.js';
import {on} from '../ui/actions.js';
import {cm, sm} from '../ui/modal.js';
import {$, esc, xf} from '../util.js';

// Альбом регионов: какие коды из справочника уже выпадали (список открытых хранится на сервере в players.seen).
let AC='RU';
const table=c=>c=='RU'?RR:BR;
export function drawAlbum(){
  const tb=table(AC),keys=Object.keys(tb).sort((a,b)=>a-b),seen=new Set(S.seen),n=seenRegions(AC);
  $('albumC').innerHTML=`<div class="chips">${Object.keys(CN).map(c=>`<button class="${c==AC?'a':''}" data-click="albumCountry" data-arg="${c}">${CN[c].n} ${seenRegions(c)}/${Object.keys(table(c)).length}</button>`).join('')}</div>
  <div class="sub" style="margin-bottom:8px"><span>Открыто ${n} из ${keys.length}</span><span>${Math.round(n/keys.length*100)}%</span></div><div class="pb"><i style="width:${n/keys.length*100}%"></i></div>
  <div class="agrid">${keys.map(k=>`<div class="ac ${seen.has(regKey(AC,k))?'f':''}" data-click="albumOpen" data-arg="${k}"><b>${k}</b><span>${seen.has(regKey(AC,k))?esc(tb[k][0]):'???'}</span></div>`).join('')}</div>`}
export function albumOpen(k){
  const r=table(AC)[k],f=S.seen.includes(regKey(AC,k));
  sm(`<div class="dlg"><h3>${f?esc(r[0]):'Регион '+k}</h3><div class="tl">${CN[AC].n} · код ${k}</div><div class="tl" style="margin:10px 0 16px">${f?'Множитель цены '+xf(r[1]):'Такой номер ещё не выпадал. Продолжайте генерацию.'}</div><button class="btn" data-click="cm">Закрыть</button></div>`)}
DRAW.album=drawAlbum;
on({albumCountry:a=>{AC=a;render()},albumOpen:a=>albumOpen(a)});
