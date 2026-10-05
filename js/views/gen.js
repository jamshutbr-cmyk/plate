import {api} from '../api.js';
import {CN, COST, TYPES, regFee} from '../config.js';
import {regList} from '../data/regions.js';
import {genCost, onTypes, regFeeNow} from '../engine.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {cm, sm} from '../ui/modal.js';
import {plateHTML} from '../ui/plate.js';
import {$, fmt, pct} from '../util.js';

// Настройка генерации: страна, регион, шансы типов.
export async function setCountry(c){cm();await api.setGenPrefs(c,'');render(true)}
export async function setReg(n){cm();await api.setGenPrefs(S.country,n);render(true)}
export function openCountries(){sm(`<div class="bd"><h2>Выбор страны</h2><div class="gl">${Object.keys(CN).map(c=>{const n=regList(c).length;return `<div class="gopt ${S.country==c?'a':''}" data-click="setCountry" data-arg="${c}"><i class="flag fl-${c}"></i><div><b>${CN[c].n}</b><span>${n} ${c=='RU'?'регионов':'областей'}</span></div>${S.country==c?'<i class="ck">✓</i>':''}</div>`}).join('')}</div><button class="btn" data-click="cm">Закрыть</button></div>`)}
let RL=[];
export function fillReg(q){q=(q||'').trim().toLowerCase();const a=RL.filter(r=>!q||r.n.toLowerCase().includes(q)||r.ks.some(k=>k.startsWith(q)));
  $('rl').innerHTML=(q?'':`<div class="gopt ${S.reg?'':'a'}" data-click="setReg" data-arg=""><div><b>Все регионы</b><span>Случайный регион · без доплаты</span></div>${S.reg?'':'<i class="ck">✓</i>'}</div>`)+(a.length?a.map(r=>`<div class="gopt ${S.reg==r.n?'a':''}" data-click="setRegIdx" data-arg="${RL.indexOf(r)}"><div><b>${r.n}</b><span>${r.ks.join(', ')} · +${fmt(regFee(r.m))} ₽ к прокруту</span></div>${S.reg==r.n?'<i class="ck">✓</i>':''}</div>`).join(''):'<div class="gnone">Ничего не найдено</div>')}
export function openRegions(){RL=regList(S.country);sm(`<div class="bd"><h2>Регион</h2><div class="tl">${RL.length} ${S.country=='RU'?'регионов':'областей'}</div><div class="tl" style="margin:6px 0 10px">Выбранный регион платный: доплата к каждому прокруту, чем престижнее регион, тем она больше. «Все регионы» бесплатно.</div><input class="gq" id="rq" type="search" placeholder="Поиск по названию или коду" data-input="fillReg" autocomplete="off"><div class="gl" id="rl"></div><button class="btn" data-click="cm">Закрыть</button></div>`);fillReg('')}
export const PIN='<svg viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.2A7 7 0 0 1 19 9.8C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.6"/></svg>';
export function drawGen(){
  const c=S.country,on=onTypes(),tot=on.reduce((a,b)=>a+b.p,0),smp=c=='RU'?{civil:'А001АА',taxi:'АА 001',police:'А 0001',transit:'А001АА',military:'0001 АА',diplomat:'001 CD 01',retro:'00-01 ААА'}:Object.fromEntries(TYPES.map(t=>[t.k,'0001 AA-'])),rg=c=='RU'?'01':'1',cs=genCost(),TC={civil:'#9aa3b8',taxi:'#f0b800',police:'#4a7ee8'},nr=regList(c).length,rsel=S.reg?regList(c).find(r=>r.n==S.reg):null;
  $('genC').innerHTML=`<div class="gcard"><button class="grow" data-click="openCountries"><span class="ic"><i class="flag fl-${c}"></i></span><span class="tx"><b>${CN[c].n}</b><span>Страна · ${nr} ${c=='RU'?'регионов':'областей'}</span></span><span class="go">›</span></button><button class="grow" data-click="openRegions"><span class="ic">${PIN}</span><span class="tx"><b>${S.reg||'Все регионы'}</b><span>${rsel?'Регион · коды '+rsel.ks.join(', ')+' · +'+fmt(regFeeNow())+' ₽':'Регион · случайный, бесплатно'}</span></span><span class="go">›</span></button></div>
  <div class="gh">Шансы типов номеров</div>
  <div class="gcard">${on.map(t=>`<div class="grow row2 st">${plateHTML({type:t.k,main:smp[t.k],reg:rg,country:c})}<div class="rt"><div class="tx"><b>${t.n}</b><span>${pct(t.p/tot*100)}%</span></div></div></div>`).join('')}</div>
  <div class="gfoot"><div class="cs"><small>Стоимость генерации${S.reg?' · '+fmt(COST)+' + регион':''}</small><b>${fmt(cs)} ₽</b></div><button class="btn" data-click="go" data-arg="main">Готово</button></div>`}
export function setRegIdx(i){setReg(RL[i].n)}
DRAW.gen=drawGen;
on({setCountry,setReg,setRegIdx:a=>setRegIdx(+a),openCountries,openRegions,fillReg:(a,el)=>fillReg(el.value)});
