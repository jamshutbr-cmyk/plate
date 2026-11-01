import {api} from '../api.js';
import {BANK, CAR_CLS, RAR, cancelFee, depPayout, dupRefund} from '../config.js';
import {CARS, carById, caseOdds} from '../data/cars.js';
import {haptic} from '../platform.js';
import {beep, burst, chime, dropSound} from '../ui/fx.js';
import {DRAW, render, go} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {icon} from '../ui/design.js';
import {banner, cm, sm} from '../ui/modal.js';
import {titleHTML} from '../ui/plate.js';
import {$, esc, fmt, parseAsk} from '../util.js';

// Банк: обмен ₽ :pi/trades: $, вклады, усиления, кейсы и титулы за $.
// Курсы, проценты, цены и лимиты считает ТОЛЬКО сервер (supabase/bank.sql); BANK в config.js нужен лишь для показа.
// Форма вклада не перерисовывается таймером: он трогает только текст отсчёта и состояние кнопок «Забрать».
let TAB='overview',BS=null,AT=0,LOAD=false,ERR=false;   // вкладка, состояние банка с сервера, время загрузки, идёт ли загрузка, ошибка
let CUR='rub',DAYS=1,TXT='',BUSY=false,XD='buy',FRESH=false;   // FRESH: следующая отрисовка — смена вкладки, нужна плавная анимация           // форма вклада: валюта, срок, введённый текст; BUSY — защита от двойного нажатия
let OFF=0,TM=null;                                // сдвиг часов сервера, таймер отсчёта

const TABS=[['overview','bank','Обзор'],['ex','trades','Обмен'],['dep','up','Вклады'],['up','studio','Бусты'],['cs','cases','Кейсы'],['ti','ach','Титулы'],['history','stat','Журнал']];
let XNUM=1,HIDE=false,BKC='rub',TITLE=0;const HISTORY=[];
const ERRS={usd:'Не хватает долларов',rub:'Не хватает рублей',limit:'Достигнут максимум',many:'Не больше '+BANK.maxDep+' вкладов сразу',ready:'Вклад ещё не созрел',gone:'Вклад уже закрыт',finished:'Срок вклада уже вышел: нажмите «Забрать»',amount:'Недопустимая сумма',owned:'Уже куплено',soldout:'Тираж распродан'};
const fail=r=>{banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');haptic('rigid');return load().then(()=>render(true))};
const pct=x=>(Math.round(x*10)/10).toString().replace('.',',');
const cur=c=>c=='rub'?'₽':'$';
const dn=d=>d+' '+(d==1?'день':'дня');
const win=(c='#22c55e')=>{burst(c,16);chime(1);haptic('success')};   // монетки и звонкий звук при успешной операции
const box=(c,h,k='')=>`<div class="bk-card ${k}"${c?` style="--cc:${c}"`:''}>${h}</div>`;
const head=(ic,t,d,c)=>`<div class="bk-h" style="--cc:${c||'#3b82f6'}"><div class="bk-ic">${ic}</div><div><h3>${t}</h3><div class="tl">${d}</div></div></div>`;
const meter=(v,m,n,c)=>`<div class="bk-meter" style="--cc:${c}">${Array.from({length:n},(_,i)=>`<i class="${i<Math.round(v/m*n)?'f':''}"></i>`).join('')}</div>`;

async function load(){
  LOAD=true;
  try{BS=await api.bankState();OFF=BS.now-Date.now();ERR=false}
  catch(e){console.error(e);ERR=true}
  finally{LOAD=false;AT=Date.now()}}

// ---------- отсчёт ----------
const left=end=>Math.max(0,end-(Date.now()+OFF));
function fmtLeft(ms){
  const s=Math.ceil(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60,z=n=>String(n).padStart(2,'0');
  return (d?d+' д ':'')+z(h)+':'+z(m)+':'+z(x)}
const done=d=>Math.min(100,Math.max(0,(Date.now()+OFF-d.start)/(d.ends-d.start)*100));
function tick(){
  if(!$('v-bank').classList.contains('on')){clearInterval(TM);TM=null;return}
  document.querySelectorAll('#bankC .bk-t').forEach(e=>{const l=left(+e.dataset.end);e.textContent=l?'Осталось '+fmtLeft(l):'Готов к получению'});
  document.querySelectorAll('#bankC .bk-claim').forEach(e=>{const r=left(+e.dataset.end)==0;e.disabled=!r;e.classList.toggle('rdy',r)});
  document.querySelectorAll('#bankC .bk-cancel').forEach(e=>{e.hidden=left(+e.dataset.end)==0});
  document.querySelectorAll('#bankC .bk-ring .v').forEach(e=>{const d=BS.deposits.find(x=>x.id==e.dataset.id);if(d)e.style.strokeDashoffset=119.4*(1-done(d)/100)})}

// ---------- вкладки ----------
const hero=()=>`<section class="capital-hero"><div class="capital-top"><span class="v3-kicker">PLATE CAPITAL / ИГРОВОЙ БАЛАНС</span><button data-click="bkHide" aria-label="${HIDE?'Показать':'Скрыть'} баланс">${HIDE?'Показать':'Скрыть'}</button></div><div class="capital-main"><div><span>${BKC==='rub'?'Рублёвый счёт':'Долларовый счёт'}</span><strong>${HIDE?'••• •••':fmt(BKC==='rub'?S.bal:S.usd)} <small>${cur(BKC)}</small></strong></div><div class="capital-currency"><button class="${BKC==='rub'?'a':''}" data-click="bkAccount" data-arg="rub">₽</button><button class="${BKC==='usd'?'a':''}" data-click="bkAccount" data-arg="usd">$</button></div></div><div class="capital-footer"><span>Второй счёт <b>${HIDE?'•••':fmt(BKC==='rub'?S.usd:S.bal)} ${BKC==='rub'?'$':'₽'}</b></span><span>${BS?BS.deposits.length:0} активных вкладов</span></div></section>`;
function tabOverview(){
 const deposits=BS.deposits||[];
 return `<div class="capital-overview"><div class="capital-actions">${[['ex','trades','Обменять'],['dep','up','Накопить'],['up','studio','Усилить']].map(([k,i,n])=>`<button data-click="bkTab" data-arg="${k}"><i>${icon(i)}</i><span>${n}</span></button>`).join('')}</div><section class="capital-rates"><div><span class="v3-kicker">КУРС В ИГРЕ</span><h2>Один доллар.<br>Два направления.</h2></div><div><button data-click="bkDirection" data-arg="buy"><span>Купить $<small>За рубли</small></span><b>${fmt(BANK.usdBuy)} ₽</b>${icon('arrow')}</button><button data-click="bkDirection" data-arg="sell"><span>Продать $<small>Получить рубли</small></span><b>${fmt(BANK.usdSell)} ₽</b>${icon('trades')}</button></div></section><section class="capital-deposits-preview"><div class="v3-section-heading"><h2>Вклады</h2><button class="v3-text" data-click="bkTab" data-arg="dep">${deposits.length?'Открыть':'Создать'} ${icon('plus')}</button></div>${deposits.length?deposits.map(d=>`<button data-click="bkTab" data-arg="dep"><span class="capital-deposit-mark">${cur(d.cur)}</span><span><b>${fmt(d.amount)} ${cur(d.cur)}</b><small>${left(d.ends)?'Доход к концу срока':'Готов к получению'}</small></span><strong>${fmt(d.payout)} ${cur(d.cur)}</strong></button>`).join(''):`<div class="capital-empty-deposit"><span>01</span><div><h3>Капиталу тоже нужен план.</h3><p>Выбери валюту и срок — результат будет известен до открытия вклада.</p></div></div>`}</section><div class="capital-extras"><button data-click="bkTab" data-arg="cs">${icon('cases')}<span><b>Гараж за доллары</b><small>Кейсы с автомобилями</small></span>:pi/external:</button><button data-click="bkTab" data-arg="ti">${icon('ach')}<span><b>Знак принадлежности</b><small>Лимитированные титулы</small></span>:pi/external:</button></div></div>`;
}
function exchangeValues(){const buy=XD==='buy',n=Math.max(1,Math.min(BANK.exMax,Math.floor(XNUM)||1)),rate=buy?BANK.usdBuy:BANK.usdSell;return {buy,n,rate,ok:buy?S.bal>=n*rate:S.usd>=n}}
function updateExchange(){const{buy,n,rate,ok}=exchangeValues();const out=$('capitalReceive'),button=$('capitalExchange');if(out)out.textContent=fmt(n*rate)+' ₽';if(button)button.disabled=!ok;const hint=$('capitalExchangeHint');if(hint)hint.textContent=ok?'Расчёт до подтверждения. Курс продажи ниже курса покупки.':buy?'На рублёвом счёте недостаточно средств.':'На долларовом счёте недостаточно средств.'}
function tabEx(){const{buy,n,rate,ok}=exchangeValues();return `<section class="capital-converter"><div class="capital-converter-head"><span class="v3-kicker">КОНВЕРТЕР</span><div class="capital-direction"><button class="${buy?'a':''}" data-click="bkXd" data-arg="buy">Покупаю $</button><button class="${buy?'':'a'}" data-click="bkXd" data-arg="sell">Продаю $</button></div></div><label class="capital-amount"><span>${buy?'Покупаю':'Продаю'} долларов</span><div><input id="capitalAmount" inputmode="numeric" type="number" min="1" max="${BANK.exMax}" value="${n}" data-input="bkNumber" aria-label="Количество долларов"><b>$</b></div></label><div class="capital-amount-presets">${[1,5,10,50].map(x=>`<button data-click="bkPreset" data-arg="${x}">${x} $</button>`).join('')}<button data-click="bkPreset" data-arg="max">Максимум</button></div><div class="capital-convert-separator">${icon('trades')}<span>1 $ = ${fmt(rate)} ₽</span></div><div class="capital-receive"><span>${buy?'Спишется со счёта':'Поступит на счёт'}</span><strong id="capitalReceive">${fmt(n*rate)} ₽</strong></div><button class="v3-primary" id="capitalExchange" ${ok?'':'disabled'} data-click="bkConvertAsk">Проверить обмен ${icon('arrow')}</button><p id="capitalExchangeHint">${ok?'Расчёт до подтверждения. Курс продажи ниже курса покупки.':buy?'На рублёвом счёте недостаточно средств.':'На долларовом счёте недостаточно средств.'}</p></section><div class="capital-fine">За одну операцию — до ${fmt(BANK.exMax)} $. Все операции используют игровой баланс.</div>`}
function tabHistory(){return `<section class="capital-journal"><span class="v3-kicker">ОПЕРАЦИИ ЭТОЙ СЕССИИ</span><h2>Прозрачно.<br>До последнего рубля.</h2>${HISTORY.length?HISTORY.slice().reverse().map(h=>`<div><span>${icon('check')}</span><p><b>Операция выполнена</b><small>${new Date(h.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · ${h.note}</small></p></div>`).join(''):'<p class="capital-history-empty">Здесь появятся выполненные в этом сеансе операции банка. Это не полная серверная выписка.</p>'}</section>`}

function depForm(){
  const d=CUR=='rub'?BANK.depRub:BANK.depUsd,n=Math.floor(parseAsk(TXT)),ok=depOk(d,n);
  return box('',head(':pi/bank:','Новый вклад','Заберёте вместе с процентами по окончании срока','#22c55e')
   +`<div class="bk-sw"><button class="${CUR=='rub'?'a':''}" data-click="bkCur" data-arg="rub">Рубли ₽</button><button class="${CUR=='usd'?'a':''}" data-click="bkCur" data-arg="usd">Доллары $</button></div>
   <div class="bk-terms">${[1,3,7].map(x=>`<button class="${DAYS==x?'a':''}" data-click="bkDays" data-arg="${x}"><b>${x}</b><small>${x==1?'день':'дня'}</small><em>+${d.pct[x]}%</em></button>`).join('')}</div>
   <div class="bk-chips">${chips(d).map(([l,v])=>`<button data-click="bkChip" data-arg="${v}">${l}</button>`).join('')}</div>
   <input class="gq" id="bkAmt" inputmode="text" placeholder="Сумма, ${cur(CUR)}" maxlength="16" autocomplete="off" value="${esc(TXT)}" data-input="bkAmtIn">
   <div class="bk-prev${ok?' ok':''}" id="bkPrev">${depPrev(d,n)}</div>
   <button class="btn bk-go" id="bkGo" ${ok?'':'disabled'} data-click="bkOpen">Открыть вклад</button>`)}
const chips=d=>{const mx=Math.min(CUR=='rub'?S.bal:S.usd,d.max),a=CUR=='rub'?[['100к',1e5],['1м',1e6],['10м',1e7],['100м',1e8]]:[['10',10],['50',50],['100',100],['1000',1000]];
  return [...a.filter(([,v])=>v<=d.max),['Макс',Math.floor(mx)]]};
const depOk=(d,n)=>n>=d.min&&n<=d.max&&BS.deposits.length<BANK.maxDep&&depPayout(CUR,n,DAYS)>n;
function depPrev(d,n){
  if(BS.deposits.length>=BANK.maxDep)return 'Уже открыто '+BANK.maxDep+' вклада: заберите один из них';
  if(!TXT.trim())return `От ${fmt(d.min)} до ${fmt(d.max)} ${cur(CUR)}. Можно писать «1.5м», «250к»`;
  if(!(n>=d.min&&n<=d.max))return `Сумма от ${fmt(d.min)} до ${fmt(d.max)} ${cur(CUR)}`;
  const p=depPayout(CUR,n,DAYS);
  if(p<=n)return 'Сумма слишком мала: проценты не дадут и 1 '+cur(CUR)+'. Возьмите больше или другой срок';
  return `Вложите ${fmt(n)} ${cur(CUR)} → получите ${fmt(p)} ${cur(CUR)} (+${fmt(p-n)}) через ${dn(DAYS)}`}

function tabDep(){
  const list=BS.deposits.map(d=>{
    const l=left(d.ends);
    return `<div class="bk-card bk-dep ${d.cur}"><div class="bk-top"><div class="bk-ring" style="--cc:${d.cur=='rub'?'#3b82f6':'#22c55e'}"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="t"/><circle cx="22" cy="22" r="19" class="v" data-id="${d.id}" style="stroke-dashoffset:${119.4*(1-done(d)/100)}"/></svg><b>${cur(d.cur)}</b></div>
     <div class="bk-sum"><small>Вложено</small><b>${fmt(d.amount)} ${cur(d.cur)}</b></div><div class="bk-sum" style="text-align:right"><small>Получите</small><b class="pay">${fmt(d.payout)} ${cur(d.cur)}</b></div></div>
     <div class="bk-t" data-end="${d.ends}">${l?'Осталось '+fmtLeft(l):'Готов к получению'}</div>
     <button class="btn bk-claim${l?'':' rdy'}" data-end="${d.ends}" ${l?'disabled':''} data-click="bkClaim" data-arg="${d.id}">Забрать</button>
     <button class="bk-cancel" data-end="${d.ends}" ${l?'':'hidden'} data-click="bkCancelDlg" data-arg="${d.id}">Закрыть досрочно</button></div>`}).join('');
  return depForm()+`<h3 class="tsec">Ваши вклады · ${BS.deposits.length} из ${BANK.maxDep}</h3>`+(list||`<p class="bk-note">Вкладов пока нет.</p>`)
    +`<p class="bk-note">С процентами вклад выдаётся после окончания срока. Закрыть раньше можно в любой момент: проценты сгорают, первые ${BANK.cancel.graceMin} минут без штрафа, потом штраф ${BANK.cancel.pct}% от вложенного.</p>`}

function tabUp(){
  const L=BANK.luck,M=BANK.lots,mx=BS.extra_lots+M.step>M.max;
  return box('#f5b82e',head(':pi/ach:','Буст удачи',`Ближайшие ${L.rolls} прокрутов: ${L.best} номера на выбор, достаётся самый дорогой`,'#f5b82e')
   +`<div class="bk-row" style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="tl" style="margin:0">Прокрутов с бустом</span><b>${BS.luck} из ${L.cap}</b></div>${meter(BS.luck,L.cap,20,'#f5b82e')}
   <div style="display:flex;gap:8px">${[1,L.bulk].map(k=>{const full=BS.luck+L.rolls*k>L.cap;return `<button class="btn bk-buy" style="flex:1" ${full||S.usd<L.cost*k?'disabled':''} data-click="bkLuck" data-arg="${k}">${full?'Максимум':'+'+L.rolls*k+' прокрутов · '+L.cost*k+' $'}</button>`}).join('')}</div>`)
   +box('#4ade80',head(':pi/shop:','Слоты рынка',`+${M.step} лотов за покупку на рынке игроков`,'#4ade80')
   +`<div class="bk-row" style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="tl" style="margin:0">Дополнительные слоты</span><b>+${BS.extra_lots} из ${M.max}</b></div>${meter(BS.extra_lots,M.max,M.max/M.step,'#4ade80')}
   <button class="btn bk-buy" ${mx||S.usd<M.cost?'disabled':''} data-click="bkLots">${mx?'Куплено всё':'+'+M.step+' лотов · '+M.cost+' $'}</button>`)}

let BCASE='vip',BCPANE='models';
const chosenCase=()=>BANK.cases.find(c=>c.id===BCASE)||BANK.cases[0];
const caseModels=c=>CARS.filter(car=>caseOdds(c.w)[car.r]>0);
function bankCaseModel(id){const c=chosenCase(),car=carById(id);if(!car||!caseModels(c).includes(car))return;const od=caseOdds(c.w),n=CARS.filter(x=>x.r===car.r).length;sm(`<section class="vault-model-sheet"><span class="v3-kicker">СОСТАВ / ${esc(c.n)}</span><img src="${car.img}" alt="${esc(car.n)}"><h2>${esc(car.n)}</h2><p>${CAR_CLS[car.r]} · ${S.cars.includes(car.id)?'Уже в гараже':'Ещё нет в гараже'}</p><div><span>Шанс модели</span><b>${pct(od[car.r]/n)}%</b></div><small>Вес класса делится поровну между ${n} моделями этого класса. Показаны настройки клиента; результат и выплату подтверждает сервер.</small><button class="v3-text" data-click="cm">К коллекции ${icon('arrow')}</button></section>`)}
function tabCs(){
 const c=chosenCase(),od=caseOdds(c.w),models=caseModels(c),cover=models[models.length-1],enough=S.usd>=c.usd;
 const odds=od.map((v,i)=>v>0?`<div class="vault-odds-row"><span><i style="background:${RAR[i].c}"></i>${CAR_CLS[i]}</span><em><i style="width:${v}%;background:${RAR[i].c}"></i></em><b>${pct(v)}%</b></div>`:'').join('');
 const content=BCPANE==='models'?`<div class="vault-models">${models.map(car=>`<button data-click="bankCaseModel" data-arg="${car.id}"><span class="vault-model-class"><i style="background:${RAR[car.r].c}"></i>${CAR_CLS[car.r]}</span><img src="${car.img}" alt="${esc(car.n)}"><b>${esc(car.n)}</b><span class="vault-model-foot"><small>${S.cars.includes(car.id)?'В гараже':'Подробнее'}</small>${icon(S.cars.includes(car.id)?'check':'plus')}</span></button>`).join('')}</div>`:BCPANE==='odds'?`<section class="vault-odds"><h3>Все вероятности.<br>Без мелкого шрифта.</h3>${odds}<p>Шансы классов нормализованы с учётом доступных моделей. Открытие не гарантирует новый автомобиль; возможен повтор.</p></section>`:`<section class="vault-duplicates"><h3>Повтор — не вторая машина.</h3><p>Если автомобиль уже есть в гараже, сервер начисляет компенсацию в рублях. Доллары за открытие не возвращаются.</p>${od.map((v,i)=>v>0?`<div><span>${CAR_CLS[i]}</span><b>+${fmt(dupRefund(i))} ₽</b></div>`:'').join('')}</section>`;
 return `<section class="bank-vault"><header class="vault-heading"><div><span class="v3-kicker">CAPITAL / MOTOR COLLECTIONS</span><h2>Другой ключ<br>к твоему гаражу.</h2></div><span class="vault-account">Доступно <b>${fmt(S.usd)} $</b></span></header><div class="vault-layout"><nav class="vault-collections" aria-label="Банковские кейсы">${BANK.cases.map((x,i)=>`<button class="${x.id===c.id?'a':''}" data-click="bankCaseSelect" data-arg="${x.id}" aria-pressed="${x.id===c.id}"><span>0${i+1}</span><div><b>${esc(x.n)}</b><small>${x.usd} $ / открытие</small></div>${icon(x.id===c.id?'check':'arrow')}</button>`).join('')}</nav><div class="vault-workspace"><article class="vault-stage"><div><span class="v3-kicker">${esc(c.n)} / ${models.length} МОДЕЛЕЙ</span><h3>${c.id==='royal'?'Выше класс.<br>Другой характер.':'Новая глава<br>твоего автопарка.'}</h3><p>Один случайный автомобиль из состава коллекции.</p></div><img src="${cover.img}" alt="Пример возможного автомобиля: ${esc(cover.n)}"><small>Показан пример. Не гарантированный результат.</small></article><section class="vault-purchase"><div><span>Стоимость открытия</span><strong>${c.usd} <small>$</small></strong></div><button class="v3-primary" data-click="bankCaseReview" data-arg="${c.id}" ${enough?'':'disabled'}>Проверить открытие ${icon('cases')}</button>${enough?'':`<p>Не хватает ${fmt(c.usd-S.usd)} $. <button class="v3-text" data-click="bkDirection" data-arg="buy">К обмену ${icon('trades')}</button></p>`}</section><nav class="vault-panes" role="tablist">${[['models','Состав'],['odds','Шансы'],['duplicates','Повторы']].map(([k,n])=>`<button role="tab" aria-selected="${BCPANE===k}" class="${BCPANE===k?'a':''}" data-click="bankCasePane" data-arg="${k}">${n}</button>`).join('')}</nav>${content}</div></div></section>`;
}
function bankCaseReview(id){const c=BANK.cases.find(x=>x.id===id);if(!c||BUSY)return;sm(`<section class="vault-confirm"><span class="v3-kicker">ПРОВЕРЬ ОПЕРАЦИЮ</span><h2>Открытие «${esc(c.n)}»</h2><div><span>Спишется с игрового счёта</span><strong>${c.usd} $</strong></div><div><span>Останется</span><b>${fmt(Math.max(0,S.usd-c.usd))} $</b></div><p>Результат случайный. При повторе автомобиля — компенсация в рублях по его классу. Новый автомобиль и возврат потраченных долларов не гарантируются.</p><button class="v3-primary" data-click="bkCase" data-arg="${c.id}" ${S.usd<c.usd?'disabled':''}>Подтвердить · ${c.usd} $ ${icon('check')}</button><button class="v3-text" data-click="cm">Вернуться к составу</button></section>`)}

// Остаток тиража титула: сколько осталось и сколько всего. Данные о продажах приходят с сервера (BS.items).
const stock=it=>{const sold=Math.min(it.max,((BS.items||{})[it.id]||{}).sold||0);return {sold,left:it.max-sold}};
function tabTi(){
  return BANK.items.map(it=>{
    const own=S.owned.includes(it.id),eq=S.equip.title==it.id,{left}=stock(it),out=left<=0&&!own;
    const btn=own?`<button class="btn" style="width:100%" ${eq?'disabled':''} data-click="bkWear" data-arg="${it.id}">${eq?'Надето':'Надеть'}</button>`
      :out?`<button class="btn" style="width:100%" disabled>Распродано</button>`
      :`<button class="btn" style="width:100%" ${S.usd<it.usd?'disabled':''} data-click="bkItemDlg" data-arg="${it.id}">Купить · ${fmt(it.usd)} $</button>`;
    const lim=`<div class="bk-lim${out?' out':left<=Math.ceil(it.max*.1)?' low':''}"><span>${out?'РАСПРОДАНО':'Осталось '+fmt(left)+' из '+fmt(it.max)}</span>${meter(left,it.max,10,out?'#64748b':it.c)}</div>`;
    return box(it.c,`<span class="bk-ttl">${it.n}</span><div class="bk-who"><b>${esc(S.nick||'Игрок')}</b>${titleHTML(it.id)}</div><div class="bk-price">${own?'КУПЛЕНО':out?'ЛИМИТИРОВАННЫЙ ТИРАЖ':'ЛИМИТ · '+fmt(it.usd)+' $'}</div>${lim}<div class="tl">${it.d}</div>${btn}`,'bk-ti'+(out?' sold':''))}).join('')
   +`<p class="bk-note">Титулы выходят ограниченным тиражом на весь сервер. Когда тираж кончится, купить их будет нельзя, только забрать у владельца. За рубли они не продаются.</p>`}

export function drawBank(){
  if(!LOAD&&Date.now()-AT>10000)load().then(()=>render(true));
  let h=hero()+`<div class="bk-tabs">${TABS.map(([k,i,n])=>`<button class="${TAB==k?'a':''}" data-click="bkTab" data-arg="${k}"><i>${icon(i)}</i>${n}</button>`).join('')}</div>`;
  if(!BS)h+=`<p class="bk-note">${ERR?'Не удалось загрузить банк':'Загрузка…'}</p>`;
  else h+=`<div class="bk-pane${FRESH?' in':''}">`+{overview:tabOverview,ex:tabEx,dep:tabDep,up:tabUp,cs:tabCs,ti:tabTi,history:tabHistory}[TAB]()+'</div>';
  FRESH=false;
  $('bankC').innerHTML=h;
  if(TAB=='dep'&&BS&&!TM)TM=setInterval(tick,1000)}

// ---------- действия ----------
const bkTab=a=>{TAB=a;FRESH=true;render(true)};
const bkXd=a=>{XD=a;FRESH=true;render(true)};
function bkChip(a){
  TXT=String(a);const el=$('bkAmt');el.value=TXT;haptic('light');bkAmtIn(a,el)}
const bkCur=a=>{if(a!=CUR)TXT='';CUR=a;render(true)};   // сумма сбрасывается вместе с валютой: 100 $ не превращаются в 100 ₽
const bkDays=a=>{DAYS=+a;render(true)};
function bkAmtIn(a,el){
  TXT=el.value;
  const d=CUR=='rub'?BANK.depRub:BANK.depUsd,n=Math.floor(parseAsk(TXT));
  const ok=depOk(d,n);
  $('bkPrev').textContent=depPrev(d,n);$('bkPrev').classList.toggle('ok',ok);
  $('bkGo').disabled=!ok}

async function op(f,ok){   // общая обвязка: защита от двойного нажатия, показ ошибки, обновление
  if(BUSY)return;BUSY=true;
  try{
    const before={bal:S.bal,usd:S.usd};const r=await f();
    if(r.err){await fail(r);return}
    ok&&ok(r);HISTORY.push({at:Date.now(),note:[S.bal!==before.bal?(S.bal-before.bal>0?'+':'')+fmt(S.bal-before.bal)+' ₽':'',S.usd!==before.usd?(S.usd-before.usd>0?'+':'')+fmt(S.usd-before.usd)+' $':''].filter(Boolean).join(' · ')||'Игровые активы обновлены'});haptic('success');
    await load();render(true)}
  catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');api.syncPlayer().then(load).then(()=>render(true)).catch(()=>{})}
  finally{BUSY=false}}

const bkEx=a=>{const [d,n]=a.split(':');if(+n<1)return;return op(()=>api.bankExchange(d,+n),()=>{win(d=='buy'?'#22c55e':'#f5b82e');banner(d=='buy'?'Куплено':'Продано',d=='buy'?'+'+n+' $ за '+fmt(n*BANK.usdBuy)+' ₽':'+'+fmt(n*BANK.usdSell)+' ₽ за '+n+' $')})};
const bkOpen=()=>{
  const d=CUR=='rub'?BANK.depRub:BANK.depUsd,n=Math.floor(parseAsk(TXT));
  if(!depOk(d,n))return;
  op(()=>api.bankDepositOpen(CUR,n,DAYS),()=>{TXT='';banner('Вклад открыт',fmt(n)+' '+cur(CUR)+' на '+dn(DAYS))})};
const bkClaim=a=>op(()=>api.bankDepositClaim(+a),r=>{win('#f5b82e');banner('Вклад получен','+'+fmt(r.res.payout)+' '+cur(r.res.cur))});
function bkCancelDlg(a){
  const d=BS.deposits.find(x=>x.id==a);if(!d)return;
  const fee=cancelFee(d.amount,d.start,Date.now()+OFF),back=d.amount-fee,lost=d.payout-d.amount;
  sm(`<div class="dlg adlg"><h3>Закрыть вклад досрочно?</h3>
    <div class="kv"><div><small>Вернётся</small><b>${fmt(back)} ${cur(d.cur)}</b></div><div><small>Штраф</small><b>${fee?'−'+fmt(fee)+' '+cur(d.cur):'нет'}</b></div><div><small>Сгорят проценты</small><b>${fmt(lost)} ${cur(d.cur)}</b></div><div><small>До конца срока</small><b>${fmtLeft(left(d.ends))}</b></div></div>
    <div class="note ${fee?'bad':'ok'}">${fee?`Вклад открыт больше ${BANK.cancel.graceMin} минут назад: удерживается штраф ${BANK.cancel.pct}% от вложенного, проценты не начисляются.`:`Первые ${BANK.cancel.graceMin} минут штрафа нет: вернётся вся вложенная сумма, но без процентов.`}</div>
    <button class="btn red" data-click="bkCancelOk" data-arg="${d.id}">Закрыть вклад</button><button class="btn ghost" data-click="cm">Оставить</button></div>`)}
const bkCancelOk=a=>{cm();op(()=>api.bankDepositCancel(+a),r=>{banner('Вклад закрыт','Возвращено '+fmt(r.res.refund)+' '+cur(r.res.cur)+(r.res.fee?', штраф '+fmt(r.res.fee):''));haptic('medium')})};
const bkLuck=a=>op(()=>api.bankBuyLuck(+a||1),r=>{win('#f5b82e');banner('Буст удачи','Прокрутов с бустом: '+r.res)});
const bkLots=()=>op(()=>api.bankBuyLots(),r=>{win('#4ade80');banner('Слоты рынка','Дополнительно +'+r.res+' лотов')});
async function bkWear(a){try{await api.equipItem('title',a);banner('Титул надет',BANK.items.find(x=>x.id==a).n);render(true)}catch(e){console.error(e);banner('Не получилось','Попробуйте ещё раз')}}

function bkItemDlg(a){
  const it=BANK.items.find(x=>x.id==a);if(!it)return;
  sm(`<div class="dlg"><h3>Купить титул?</h3><div class="bk-res"><span class="bk-ttl" style="--cc:${it.c}">${it.n}</span></div><p class="tl" style="margin:12px 0">${it.d}.<br>Тираж: осталось ${stock(it).left} из ${it.max}. Он будет сразу надет.</p><button class="btn" ${S.usd<it.usd?'disabled':''} data-click="bkItemOk" data-arg="${it.id}">Купить · ${fmt(it.usd)} $</button><button class="btn" data-click="cm">Отмена</button></div>`)}
async function bkItemOk(a){
  cm();
  const it=BANK.items.find(x=>x.id==a);if(!it||BUSY)return;
  BUSY=true;
  try{
    const r=await api.bankBuyItem(a);
    if(r.err&&r.err!='owned'){await fail(r);return}
    await api.equipItem('title',a);
    banner('Титул куплен',it.n);win(it.c);
    await load();render(true)}
  catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');api.syncPlayer().then(load).then(()=>render(true)).catch(()=>{})}
  finally{BUSY=false}}

// Result is shown only after the original server API has returned successfully.
async function reveal(c,car,r){
 const k=car.r;sm(`<section class="vault-result"><span class="v3-kicker">${esc(c.n)} / РЕЗУЛЬТАТ ПОЛУЧЕН</span><div class="vault-result-status">${icon(r.dup?'refresh':'check')}<span>${r.dup?'Знакомый характер':'Пополнение автопарка'}</span></div><div class="vault-result-image"><img src="${car.img}" alt="${esc(car.n)}"></div><span class="vault-result-class"><i style="background:${RAR[k].c}"></i>${CAR_CLS[k]}</span><h2>${esc(car.n)}</h2>${r.dup?`<div class="vault-result-refund"><span>Автомобиль уже есть. Компенсация</span><strong>+${fmt(r.refund)} ₽</strong></div>`:'<p>Автомобиль добавлен в твой гараж. Можно подобрать ему номер.</p>'}<button class="v3-primary" data-click="bankCaseGarage">Открыть гараж ${icon('garage')}</button><button class="v3-text" data-click="cm">К банковским кейсам</button></section>`);dropSound(k);haptic('success');
}
async function bkCase(a){
  const c=BANK.cases.find(x=>x.id==a);if(!c||BUSY)return;
  if(S.usd<c.usd){banner('Не хватает долларов','Нужно '+c.usd+' $');haptic('rigid');return}
  BUSY=true;
  try{
    const r=await api.openCaseUsd(a);
    if(r.err){await fail(r);return}
    const car=carById(r.car_id);
    if(!car)banner('Новая машина','Обновите игру, чтобы увидеть её');
    else await reveal(c,car,r);
    await load();render(true)}
  catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');api.syncPlayer().then(load).then(()=>render(true)).catch(()=>{})}
  finally{BUSY=false}}

DRAW.bank=drawBank;
on({bankCaseSelect:id=>{BCASE=id;render(true)},bankCasePane:p=>{BCPANE=p;render(true)},bankCaseModel,bankCaseReview,bankCaseGarage:()=>{cm();go('garage')},bkHide:()=>{HIDE=!HIDE;render(true)},bkAccount:a=>{BKC=a;render(true)},bkDirection:a=>{TAB='ex';XD=a;render(true)},bkNumber:(a,el)=>{XNUM=el.value;updateExchange()},bkPreset:a=>{XNUM=a==='max'?Math.max(1,Math.min(BANK.exMax,XD==='buy'?Math.floor(S.bal/BANK.usdBuy):S.usd)):+a;const el=$('capitalAmount');if(el)el.value=XNUM;updateExchange()},bkConvertAsk:()=>{const{buy,n,rate,ok}=exchangeValues();if(!ok)return;sm(`<div class="capital-confirm"><span class="v3-kicker">ПРОВЕРЬ ОБМЕН</span><h2>${buy?'Покупка':'Продажа'} ${fmt(n)} $</h2><div><span>${buy?'Спишется':'Поступит'}</span><strong>${fmt(n*rate)} ₽</strong></div><p>1 $ = ${fmt(rate)} ₽. Это операция с игровым балансом.</p><button class="v3-primary" data-click="bkConfirmExchange" data-arg="${XD}:${n}">Подтвердить обмен</button><button class="v3-text" data-click="cm">Вернуться к расчёту</button></div>`)},bkConfirmExchange:a=>{cm();return bkEx(a)},bkTab,bkXd,bkChip,bkCur,bkDays,bkAmtIn,bkEx,bkOpen,bkClaim,bkCancelDlg,bkCancelOk,bkLuck,bkLots,bkWear,bkItemDlg,bkItemOk,bkCase});
