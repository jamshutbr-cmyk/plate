import {api} from '../api.js';
import {AUTO, CCO, CST, RAR, SCO, SELL_PCT, SST, autoMatch, sellGain} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {icon} from '../ui/design.js';
import {banner,sm,cm} from '../ui/modal.js';
import {on} from '../ui/actions.js';
import {$, fmt} from '../util.js';

// Улучшения и автопродажа.
export async function buyAuto(){const r=await api.buyAutosell();if(r.err)banner('Не хватает $','Нужно '+r.need+' $');else render()}
export async function aset(a){const [k,v]=a.split(':');await api.autoSet(k,+v);render()}
export async function autoNow(){const r=await api.autosell();if(r)banner('Автопродажа','Продано '+r.n+' · '+fmt(r.gain)+' ₽');else banner('Автопродажа','Сейчас продавать нечего');render()}
export async function buy(k){const r=await api.buyCapacity(k);if(r.err)banner('Не хватает денег','Нужно '+fmt(r.need)+(k=='c'?' ₽':' $'));else render()}
let SPACE='c';
export function drawUp(){const safe=SPACE==='s',n=safe?S.safe.length:S.col.length,cap=safe?S.capS:S.capC,steps=safe?SST:CST,costs=safe?SCO:CCO,i=steps.indexOf(cap)+1,max=i>=steps.length,price=max?0:costs[i-1];
 $('upC').innerHTML=`<div class="space-intro"><span class="v3-kicker">ROOM FOR MORE</span><h1>Хорошему<br><em>нужно место.</em></h1></div><div class="space-switch"><button class="${!safe?'a':''}" data-click="spaceTab" data-arg="c">${icon('col')}Библиотека</button><button class="${safe?'a':''}" data-click="spaceTab" data-arg="s">${icon('safe')}Приватный сейф</button></div><section class="space-capacity"><span class="v3-kicker">ЗАНЯТО СЕЙЧАС</span><div class="space-numbers"><strong>${n}</strong><span>/ ${cap}<small>${Math.max(0,cap-n)} свободных мест</small></span></div><div class="space-meter"><i style="width:${Math.min(100,n/cap*100)}%"></i></div><p>${safe?'Сейф защищает номер от случайной и автоматической продажи.':'Здесь остаются новые находки. Когда библиотека заполнена, новые номера не поместятся.'}</p></section><div class="space-next"><div><span class="v3-kicker">${max?'МАКСИМАЛЬНЫЙ ОБЪЁМ':'СЛЕДУЮЩЕЕ РАСШИРЕНИЕ'}</span><h2>${max?cap:steps[i]} <span>мест</span></h2><p>${max?'Все доступные улучшения приобретены.':'Ещё '+(steps[i]-cap)+' мест для твоей коллекции.'}</p></div><button class="v3-primary" ${max?'disabled':''} data-click="spaceAsk" data-arg="${SPACE}">${max?'Максимум':fmt(price)+(safe?' $':' ₽')} ${icon('plus')}</button></div><button class="space-autopilot" data-click="go" data-arg="auto"><span>${icon('auto')}</span><div><b>Не только больше. Умнее.</b><small>Автопилот продаст лишнее по твоим правилам.</small></div>:pi/external:</button>`;
}
on({spaceTab:a=>{SPACE=a;render(true)},spaceAsk:k=>{const safe=k==='s',steps=safe?SST:CST,costs=safe?SCO:CCO,i=steps.indexOf(safe?S.capS:S.capC)+1;if(i>=steps.length)return;sm(`<div class="v3-tools"><span class="v3-kicker">РАСШИРЕНИЕ / ${safe?'СЕЙФ':'БИБЛИОТЕКА'}</span><h2>Место для новых историй.</h2><p>Вместимость увеличится до ${steps[i]} мест. Предметы и номера останутся на месте.</p><div class="v3-price-review"><span>Стоимость</span><b>${fmt(costs[i-1])}${safe?' $':' ₽'}</b></div><button class="v3-primary" data-click="spaceBuyConfirm" data-arg="${k}">Подтвердить расширение</button></div>`)},spaceBuyConfirm:k=>{cm();return buy(k)}});
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
 +opt('Какие номера продавать','Продаются номера выбранной редкости и ниже. Эпические, легендарные и мифические автопродажа не продаёт никогда.',seg('cls',rar,A.cls||0))
 +opt('Спецномера','Такси, полиция, военные, дипломатические, транзитные и ретро. Если «Беречь», продаются только обычные гражданские номера.',seg('sp',[[0,'Беречь'],[1,'Продавать']],A.sp?1:0))
 +opt('Потолок цены','Номера дороже этой суммы не продаются, даже если подходят по редкости. Так случайно не уйдёт удачная находка.',seg('ceil',AUTO.ceil.map(v=>[v,v?fmt(v):'Нет']),A.ceil||0))
 +opt('Когда не хватает денег','Если на генерацию не хватает монет, автопродажа сначала продаст подходящие номера и продолжит крутить.',seg('low',OO,A.low?1:0))
 +`</div><div class="card"><div class="tl" style="margin-bottom:6px">Прямо сейчас под правила подходит</div><div class="anow">${hit.length} <small>из ${S.col.length} номеров</small></div><p style="margin:6px 0 0">${hit.length?'Выручка: '+fmt(sellGain(sum,S.perks.sell))+' ₽ ('+top+' и ниже'+(A.sp?'':', без спецномеров')+(A.ceil?', '+ceilL(A.ceil):'')+').':'Ничего не продастся. Измените правила или подождите новых номеров.'}</p>${A.on&&hit.length?`<button class="big2" style="margin-top:14px" data-click="autoNow">Продать сейчас</button>`:''}${A.on?'':'<p style="margin-bottom:0">Автопродажа выключена: номера не продаются сами.</p>'}</div>`}
DRAW.up=drawUp;DRAW.auto=drawAuto;
on({buyAuto,buy,aset,autoNow});
