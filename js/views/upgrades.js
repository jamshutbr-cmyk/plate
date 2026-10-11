import {api} from '../api.js';
import {AUTO, CCO, CST, RAR, SCO, SELL_PCT, SST, autoMatch, sellGain} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {banner} from '../ui/modal.js';
import {on} from '../ui/actions.js';
import {$, fmt} from '../util.js';

// Улучшения и автопродажа.
export async function buyAuto(){const r=await api.buyAutosell();if(r.err)banner('Не хватает $','Нужно '+r.need+' $');else render()}
export async function aset(a){const [k,v]=a.split(':');await api.autoSet(k,+v);render()}
export async function autoNow(){const r=await api.autosell();if(r)banner('Автопродажа','Продано '+r.n+' · '+fmt(r.gain)+' ₽');else banner('Автопродажа','Сейчас продавать нечего');render()}
export async function buy(k){const r=await api.buyCapacity(k);if(r.err)banner('Не хватает денег','Нужно '+fmt(r.need)+(k=='c'?' ₽':' $'));else render()}
export function drawUp(){
 const ci=CST.indexOf(S.capC)+1,si=SST.indexOf(S.capS)+1;
 const blk=(t,n,cap,txt,b)=>`<div class="card"><h3>${t}<span class="tl">${n} / ${cap}</span></h3><div class="pb"><i style="width:${Math.min(100,n/cap*100)}%"></i></div><p>${txt}</p>${b}</div>`;
 $('upC').innerHTML=blk('Коллекция',S.col.length,S.capC,'Здесь хранятся выпавшие номера. Когда место кончится, прокрутить не получится, пока не продашь что-нибудь.',ci>=CST.length?'<button class="big2" disabled>Максимум</button>':`<button class="big2" data-click="buy" data-arg="c">Расширить до ${CST[ci]} · ${fmt(CCO[ci-1])} ₽</button>`)
 +blk('Сейф',S.safe.length,S.capS,'Номера в сейфе нельзя продать ни случайно, ни автопродажей.',si>=SST.length?'<button class="big2" disabled>Максимум</button>':`<button class="big2" data-click="buy" data-arg="s">Расширить до ${SST[si]} · ${SCO[si-1]} $</button>`)
 +`<div class="card" style="cursor:pointer" data-click="go" data-arg="auto"><h3>Автопродажа<span>›</span></h3><span class="tl">${S.as.lvl?(S.as.on?'Включена':'Выключена'):'Не приобретено · '+AUTO.cost+' $'}</span></div>`}
// Автопродажа: один режим. Каждая настройка с пояснением, внизу живой счётчик «что продастся прямо сейчас» по тому же правилу, что и на сервере (autoMatch).
const seg=(k,items,cur)=>`<div class="aseg">${items.map(([v,l])=>`<button class="${cur==v?'a':''}" data-click="aset" data-arg="${k}:${v}">${l}</button>`).join('')}</div>`;
const opt=(t,d,ctl)=>`<div class="aopt"><div class="at">${t}</div><p class="ad">${d}</p>${ctl}</div>`;
const OO=[[1,'Вкл'],[0,'Выкл']];
export function drawAuto(){
 const A=S.as,pct=SELL_PCT+S.perks.sell;
 const intro=`<div class="card"><h3>Автопродажа</h3><p>Сама продаёт лишние номера из коллекции за ${pct}% цены, пока вы жмёте «Генерация». Срабатывает, когда коллекция заполнена${A.lvl?(A.low?' или когда не хватает денег на генерацию':''):''}. Все подходящие номера продаются одним разом. Номера в сейфе она не трогает никогда.</p></div>`;
 if(!A.lvl){$('autoC').innerHTML=intro+`<div class="card"><p style="margin-top:0">Открывается один раз, дальше настройки бесплатные. Вы сами решаете, что можно продавать: редкость, спецномера и потолок цены.</p><button class="big2" data-click="buyAuto">Открыть автопродажу · ${AUTO.cost} $</button></div>`;return}
 const hit=S.col.filter(p=>autoMatch(p,A)),sum=hit.reduce((t,p)=>t+p.price,0);
 const rar=AUTO.cls.map((l,i)=>[i,l]),top=RAR[A.cls||0].n.toLowerCase();
 const ceilL=v=>v?'до '+fmt(v):'без лимита';
 $('autoC').innerHTML=intro
 +`<div class="card"><div class="aopt first"><div class="at">Автопродажа</div>${seg('on',OO,A.on?1:0)}</div>`
 +opt('Какие номера продавать','Продаются номера выбранной редкости и ниже. Эпические и легендарные автопродажа не продаёт никогда.',seg('cls',rar,A.cls||0))
 +opt('Спецномера','Такси, полиция, военные, дипломатические, транзитные и ретро. Если «Беречь», продаются только обычные гражданские номера.',seg('sp',[[0,'Беречь'],[1,'Продавать']],A.sp?1:0))
 +opt('Потолок цены','Номера дороже этой суммы не продаются, даже если подходят по редкости. Так случайно не уйдёт удачная находка.',seg('ceil',AUTO.ceil.map(v=>[v,v?fmt(v):'Нет']),A.ceil||0))
 +opt('Когда не хватает денег','Если на генерацию не хватает монет, автопродажа сначала продаст подходящие номера и продолжит крутить.',seg('low',OO,A.low?1:0))
 +`</div><div class="card"><div class="tl" style="margin-bottom:6px">Прямо сейчас под правила подходит</div><div class="anow">${hit.length} <small>из ${S.col.length} номеров</small></div><p style="margin:6px 0 0">${hit.length?'Выручка: '+fmt(sellGain(sum,S.perks.sell))+' ₽ ('+top+' и ниже'+(A.sp?'':', без спецномеров')+(A.ceil?', '+ceilL(A.ceil):'')+').':'Ничего не продастся. Измените правила или подождите новых номеров.'}</p>${A.on&&hit.length?`<button class="big2" style="margin-top:14px" data-click="autoNow">Продать сейчас</button>`:''}${A.on?'':'<p style="margin-bottom:0">Автопродажа выключена: номера не продаются сами.</p>'}</div>`}
DRAW.up=drawUp;DRAW.auto=drawAuto;
on({buyAuto,buy,aset,autoNow});
