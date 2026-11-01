import {api} from '../api.js';
import {CN, COST, TYPES, regFee} from '../config.js';
import {regList} from '../data/regions.js';
import {genCost, onTypes, regFeeNow} from '../engine.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {icon} from '../ui/design.js';
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
  $('genC').innerHTML=`<div class="configuration-intro"><span class="v3-kicker">НАСТРОЙ СВОЮ НАХОДКУ</span><h1>С чего<br><em>начнём поиск?</em></h1></div><div class="configuration-steps"><button data-click="openCountries"><span class="configuration-step">01</span><div><small>Страна выпуска</small><h2><i class="flag fl-${c}"></i>${CN[c].n}</h2><p>${nr} ${c==='RU'?'регионов':'областей'} в каталоге</p></div><i>${icon('arrow')}</i></button><button data-click="openRegions"><span class="configuration-step">02</span><div><small>География</small><h2>${S.reg||'Без границ'}</h2><p>${S.reg?'Выбранный регион · +'+fmt(regFeeNow())+' ₽':'Случайный регион · без доплаты'}</p></div><i>${icon('album')}</i></button></div><details class="configuration-chances"><summary><span>${icon('cat')}</span><div><b>Что может выпасть</b><small>Все типы и реальные шансы</small></div><em>+</em></summary><div>${on.map(t=>`<div class="configuration-chance"><span>${plateHTML({type:t.k,main:smp[t.k]||smp.civil,reg:rg,country:c})}</span><span><b>${t.n}</b><strong>${pct(t.p/tot*100)}%</strong></span></div>`).join('')}</div></details><div class="configuration-total"><div><small>Одно открытие${S.reg?' · включая регион':''}</small><strong>${fmt(cs)} ₽</strong></div><button class="v3-primary" data-click="go" data-arg="studio">В студию ${icon('studio')}</button></div>`;
}
export function setRegIdx(i){setReg(RL[i].n)}
DRAW.gen=drawGen;
on({setCountry,setReg,setRegIdx:a=>setRegIdx(+a),openCountries,openRegions,fillReg:(a,el)=>fillReg(el.value)});
