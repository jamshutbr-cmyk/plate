import {api} from '../api.js';
import {AUCTION, CN, RAR, TYPES, auctionFee, auctionNext} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, go, render} from '../router.js';
import {loadPlates, loadPlayer, rpc} from '../server.js';
import {S, find} from '../state.js';
import {on} from '../ui/actions.js';
import {banner, cm, sm} from '../ui/modal.js';
import {dots, plateHTML} from '../ui/plate.js';
import {$, esc, fmt, parseAsk, setHTML} from '../util.js';

// Аукцион: продавец задаёт старт и срок, игроки делают ставки. Всё решает сервер (auction.sql):
// ставка замораживается на балансе, прежнему лидеру возвращается сразу, в конце номер и деньги переходят одной транзакцией.
// Клиент показывает списки и таймеры. Время считаем по часам сервера (поправка OFF), чтобы не зависеть от часов телефона.
let TAB='buy',CLS=null,SORT='end';
let LOTS=null,MORE=false,MINE=null,AT=0,LOAD=false,ERR=false,LT=0;
let OFF=0;                                   // серверное время минус локальное, мс
let SEL=null;                                // выставляемый номер {id,p,hours,start}
let BID=null;                                // лот, на который делаем ставку {l,amount}

const SORTS=[['end','Скоро конец'],['new','Новые'],['cheap','Дешёвые'],['dear','Дорогие']];
const ERRS={money:'Не хватает денег',full:'Коллекция заполнена: освободите место',gone:'Торги уже закончились',own:'Это ваш лот',price:'Недопустимая цена',lots:'Одновременно не больше '+AUCTION.lots+' аукционов',plate:'Номер недоступен',low:'Ставку уже перебили: обновите цену',top:'Ваша ставка уже лидирует',ended:'Торги закончились',bids:'Лот со ставками снять нельзя',duration:'Недопустимый срок'};
const typeName=t=>TYPES.find(x=>x.k==t).n;
const now=()=>Date.now()+OFF;
const sync=t=>{if(t)OFF=t*1000-Date.now()};

// 1:23:45 / 12:05 / 0:09
function left(ends){
  let s=Math.max(0,Math.ceil(ends-now()/1000));
  const h=Math.floor(s/3600),m=Math.floor(s%3600/60),c=s%60,p=n=>String(n).padStart(2,'0');
  return h?`${h}:${p(m)}:${p(c)}`:`${m}:${p(c)}`}
const timer=ends=>`<span class="atm${ends-now()/1000<AUCTION.snipe?' hot':''}" data-end="${ends}">${left(ends)}</span>`;

const lot=(l,kind)=>{   // kind: 'buy' | 'mine' | 'bid'
  const click=kind=='mine'?'aMineDlg':'aBidDlg',sub=kind=='mine'?'Ваш лот':kind=='bid'?'Ваша ставка':esc(l.nick||'Игрок');
  const lead=kind=='bid'||l.me;
  return `<div class="row2 lot r${l.cls}" data-click="${click}" data-arg="${l.id}">${plateHTML(l,'',kind=='mine'?S.equip.skin:'')}
  <div class="ac-top"><span class="chip-t">⏱ ${timer(l.ends)}</span><span class="chip-n">${l.bids?l.bids+' '+plural(l.bids,'ставка','ставки','ставок'):'без ставок'}</span>${lead?'<span class="chip-me">Вы лидируете</span>':''}</div>
  <div class="ac-bot"><div class="ac-who"><b>${sub}</b><span>${typeName(l.type)}</span>${dots(l.cls)}</div>
  <div class="ac-pr"><small>${l.bids?'Ставка':'Старт'}</small><b>${fmt(l.cur)} ₽</b><em>оценка ${fmt(l.price)} ₽</em></div></div></div>`};
const nb=n=>fmt(n).replace(/ /g,'\u00a0');                       // число без переноса посреди разряда
const up100=n=>Math.ceil(n/100)*100;                              // круглые быстрые ставки
const plural=(n,a,b,c)=>{const m=n%100,d=n%10;return m>10&&m<20?c:d==1?a:d>1&&d<5?b:c};

// ---------- загрузка ----------
async function loadLots(more=false){
  const tok=++LT,off=more&&LOTS?LOTS.length:0;
  try{
    const r=await rpc('auction_browse',{p_cls:CLS,p_sort:SORT,p_off:off});
    if(tok!=LT)return;
    sync(r.t);
    if(more&&LOTS){const have=new Set(LOTS.map(x=>x.id));LOTS=LOTS.concat(r.lots.filter(x=>!have.has(x.id)))}else LOTS=r.lots;
    MORE=r.lots.length>=AUCTION.page;ERR=false}
  catch(e){if(tok!=LT)return;console.error(e);ERR=true}}

const EV={
  sold:e=>['Аукцион: номер продан',e.main+' · +'+fmt(e.amount-e.fee)+' ₽'],
  unsold:e=>['Аукцион: ставок не было',e.main+' вернулся в коллекцию'],
  won:e=>['Вы выиграли аукцион',e.main+' · '+fmt(e.amount)+' ₽'],
  outbid:e=>['Вашу ставку перебили',e.main+' · '+fmt(e.amount)+' ₽ возвращены']};
let SY=null,FIRST=true;
async function doSync(){
  const r=await rpc('auction_mine');
  sync(r.t);
  MINE={lots:r.lots||[],bids:r.bids||[]};
  const ev=r.events||[];
  if(ev.length){
    await api.auctionAck(Math.max(...ev.map(e=>e.id)));
    await Promise.all([loadPlayer(),loadPlates()]);                  // баланс и коллекция изменились
    const base=FIRST?9000:0;
    ev.forEach((e,i)=>{const [t,m]=EV[e.kind](e);setTimeout(()=>banner(t,m),base+i*2800)});
    haptic('success')}
  FIRST=false;
  if(ev.length||$('v-auction').classList.contains('on')||$('v-anew').classList.contains('on'))render(true)}
const syncMine=()=>SY||(SY=doSync().finally(()=>{SY=null}));

async function refresh(){
  LOAD=true;
  try{await Promise.all([loadLots(),syncMine().catch(e=>{console.error(e);ERR=true})])}
  finally{LOAD=false;AT=Date.now();render(true)}}

let MT=null,TT=null,EXP=0;
export function initAuction(){
  const run=()=>{if(!document.hidden)syncMine().catch(e=>console.warn('auction',e))};
  run();clearInterval(MT);MT=setInterval(run,20000);
  document.addEventListener('visibilitychange',run);
  // Раз в секунду обновляем таймеры; когда лот истёк, один раз просим сервер закрыть его и обновляем список
  clearInterval(TT);
  TT=setInterval(()=>{
    document.querySelectorAll('[data-end]').forEach(el=>{
      const e=+el.dataset.end;el.textContent=left(e);el.classList.toggle('hot',e-now()/1000<AUCTION.snipe);
      if(e<=now()/1000&&Date.now()-EXP>4000&&$('v-auction').classList.contains('on')){EXP=Date.now();AT=0;refresh()}})},1000)}

// ---------- экраны ----------
export function drawAuction(){
  if(!LOAD&&Date.now()-AT>10000)refresh();
  const nb=MINE?MINE.bids.length:0,nl=MINE?MINE.lots.length:0;
  let h=`<div class="chips seg"><button class="${TAB=='buy'?'a':''}" data-click="aTab" data-arg="buy">Торги</button><button class="${TAB=='mine'?'a':''}" data-click="aTab" data-arg="mine">Мои${nl+nb?' · '+(nl+nb):''}</button></div>`;
  if(TAB=='buy'){
    h+=`<div class="chips"><button class="${CLS==null?'a':''}" data-click="aCls" data-arg="-1">Все</button>${RAR.map((r,i)=>`<button class="${CLS===i?'a':''}" data-click="aCls" data-arg="${i}">${r.n}</button>`).join('')}</div>`
      +`<div class="chips seg srt">${SORTS.map(([k,n])=>`<button class="${SORT==k?'a':''}" data-click="aSort" data-arg="${k}">${n}</button>`).join('')}</div>`;
    if(!LOTS)h+=`<p class="tl" style="text-align:center">${ERR?'Не удалось загрузить аукцион':'Загрузка…'}</p>`;
    else{
      h+=LOTS.length?LOTS.map(l=>lot(l,'buy')).join(''):`<p class="tl" style="text-align:center">Торгов пока нет.<br>Выставьте свой номер во вкладке «Мои».</p>`;
      if(MORE)h+=`<button class="btn" style="width:100%;margin-top:6px" data-click="aMore">Показать ещё</button>`}
  }else{
    h+=`<button class="big2" style="margin-bottom:14px" data-click="go" data-arg="anew">Выставить на аукцион</button>`;
    if(!MINE)h+=`<p class="tl" style="text-align:center">${ERR?'Не удалось загрузить':'Загрузка…'}</p>`;
    else{
      if(MINE.bids.length)h+=`<h3 class="tsec">Мои ставки · ${MINE.bids.length}</h3>`+MINE.bids.map(l=>lot(l,'bid')).join('')+`<p class="tl" style="text-align:center">Сумма ставки заморожена до конца торгов. Если вас перебьют, деньги вернутся сразу.</p>`;
      if(MINE.lots.length)h+=`<h3 class="tsec">Мои аукционы · ${MINE.lots.length} из ${AUCTION.lots}</h3>`+MINE.lots.map(l=>lot(l,'mine')).join('');
      if(!MINE.bids.length&&!MINE.lots.length)h+=`<p class="tl" style="text-align:center">Нет ставок и лотов.<br>Аукцион удерживает ${AUCTION.fee}% с каждой продажи.</p>`}}
  setHTML($('auC'),h+`<button class="btn" style="width:100%;margin-top:10px" data-click="aRefresh">Обновить</button>`)}

export function drawAnew(){
  const left=AUCTION.lots-(MINE?MINE.lots.length:0),sf=new Set(S.safe.map(x=>x.id));
  const all=[...S.col,...S.safe].sort((a,b)=>b.price-a.price);
  setHTML($('anC'),`<p class="tl">Выберите номер для аукциона. Пока идут торги, его нельзя продать, обменять или выставить на рынок. Снять лот можно, пока нет ставок. Свободных аукционов: ${Math.max(left,0)}.</p>`
    +(all.length?all.map(p=>`<div class="row2 r${p.cls}" data-click="aPick" data-arg="${p.id}">${plateHTML(p,'',S.equip.skin)}<div class="ri"><span>${CN[p.country].n} · ${typeName(p.type)}${sf.has(p.id)?' · в сейфе':''}</span>${dots(p.cls)}<b>${fmt(p.price)} ₽</b></div></div>`).join(''):'<p class="tl" style="text-align:center">У вас нет номеров.</p>'));}

// ---------- действия ----------
const aTab=a=>{TAB=a;render(true)};
const aCls=a=>{CLS=+a<0?null:+a;LOTS=null;AT=0;render(true)};
const aSort=a=>{SORT=a;LOTS=null;AT=0;render(true)};
const aMore=async()=>{await loadLots(true);render(true)};
const aRefresh=()=>{AT=0;render(true)};

function aBidDlg(id){
  const l=(LOTS&&LOTS.find(x=>x.id==id))||(MINE&&MINE.bids.find(x=>x.id==id));if(!l)return;
  const nx=l.nx||auctionNext(l.cur,l.bids>0),lack=S.bal<nx,full=S.col.length>=S.capC;
  BID={l,amount:lack||full?0:nx,nx};
  const q=[['Минимум',nx],['+10%',up100(l.cur*1.1)],['+25%',up100(l.cur*1.25)]].filter(x=>x[1]>=nx).map(([n,v])=>`<button data-click="aQuick" data-arg="${v}">${n}<small>${fmt(v)}</small></button>`).join('');
  sm(`<div class="dlg adlg"><h3>${l.me?'Вы лидируете':'Ставка на номер'}</h3>${plateHTML(l,'','')}
    <div class="kv"><div><small>${l.bids?'Текущая ставка':'Стартовая цена'}</small><b>${fmt(l.cur)} ₽</b></div><div><small>До конца</small><b>${timer(l.ends)}</b></div><div><small>Оценка игры</small><b>${fmt(l.price)} ₽</b></div><div><small>${l.nick?'Продавец':'Ставок'}</small><b>${l.nick?esc(l.nick):l.bids}</b></div></div>`
    +(l.me?`<div class="note ok">Ваша ставка лидирует. Перебивать себя не нужно: если вас перебьют, деньги вернутся сразу.</div>`:
      `<div class="qb">${q}</div><div class="inp"><input class="gq" id="aAmt" inputmode="text" value="${BID.amount||nx}" maxlength="16" autocomplete="off" data-input="aAmtIn"><i>₽</i></div><div class="calc" id="aCalc">Ставка заморозится на балансе и вернётся, если вас перебьют</div>`
      +(lack?`<div class="note bad">Не хватает ${fmt(nx-S.bal)} ₽ до минимальной ставки</div>`:'')
      +(full?`<div class="note bad">Коллекция заполнена: освободите место, чтобы получить номер</div>`:''))
    +(l.me?'':`<button class="btn" id="aGo" ${lack||full?'disabled':''} data-click="aBidOk" data-arg="${l.id}">Сделать ставку</button>`)+`<button class="btn ghost" data-click="cm">${l.me?'Закрыть':'Отмена'}</button></div>`)}
const aQuick=a=>{const el=$('aAmt');if(!el||!BID)return;el.value=a;aAmtIn(a,el)};
function aAmtIn(a,el){
  if(!BID)return;
  const n=parseAsk(el.value),nx=BID.nx,ok=n>=nx&&n<=AUCTION.max&&n<=S.bal;
  BID.amount=ok?n:0;
  $('aCalc').textContent=ok?`Заморозится ${nb(n)}\u00a0₽, останется ${nb(S.bal-n)}\u00a0₽`:(el.value.trim()?(n>S.bal?'Не хватает денег':`Минимум ${fmt(nx)} ₽`):'');
  $('aGo').disabled=!ok||S.col.length>=S.capC}
async function aBidOk(id){
  if(!BID||!BID.amount)return;
  const amount=BID.amount;cm();
  const r=await api.auctionBid(+id,amount);
  if(r.err)banner('Ставка не принята',ERRS[r.err]||'Попробуйте ещё раз');
  else{banner('Ставка принята',fmt(r.bid)+' ₽'+(r.extended?' · время продлено':''));haptic('success')}
  BID=null;AT=0;syncMine().catch(()=>{});render(true)}

function aMineDlg(id){
  const l=MINE&&MINE.lots.find(x=>x.id==id);if(!l)return;
  sm(`<div class="dlg adlg"><h3>${l.bids?'Идут торги':'Ваш аукцион'}</h3>${plateHTML(l)}
    <div class="kv"><div><small>${l.bids?'Текущая ставка':'Старт'}</small><b>${fmt(l.cur)} ₽</b></div><div><small>До конца</small><b>${timer(l.ends)}</b></div><div><small>Ставок</small><b>${l.bids}</b></div><div><small>Получите</small><b>${fmt(l.cur-auctionFee(l.cur))} ₽</b></div></div>`
    +(l.bids?`<div class="note">Лот со ставками снять нельзя. Когда время выйдет, номер уйдёт лидеру, а деньги придут вам.</div>`:`<div class="note">Ставок пока нет: лот можно снять, номер вернётся в коллекцию.</div><button class="btn red" data-click="aCancelOk" data-arg="${l.id}">Снять с аукциона</button>`)
    +`<button class="btn ghost" data-click="cm">Закрыть</button></div>`)}
async function aCancelOk(id){
  cm();
  const r=await api.auctionCancel(+id);
  if(r.err)banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');
  else banner('Лот снят','Номер вернулся в коллекцию');
  AT=0;syncMine().catch(()=>{});render(true)}

function aPick(id){
  const p=find(+id);if(!p)return;
  SEL={id:p.id,p,hours:24,start:0};
  sm(`<div class="dlg adlg"><h3>Выставить на аукцион</h3>${plateHTML(p)}
    <div class="kv one"><div><small>Оценка игры</small><b>${fmt(p.price)} ₽</b></div></div>
    <div class="lbl2">Длительность</div><div class="chips seg">${AUCTION.hours.map(h=>`<button class="${h==24?'a':''}" data-click="aHours" data-arg="${h}">${h} ч</button>`).join('')}</div>
    <div class="lbl2">Стартовая цена</div><div class="inp"><input class="gq" id="aStart" inputmode="text" placeholder="например 250к или 1.5м" maxlength="16" autocomplete="off" data-input="aStartIn"><i>₽</i></div>
    <div class="calc" id="aSCalc"></div>
    <ul class="hints"><li>Ставка в последние ${AUCTION.snipe/60} мин продлевает торги</li><li>Комиссия ${AUCTION.fee}% только с проданного лота</li><li>Со ставками лот снять нельзя</li></ul>
    <button class="btn" id="aSGo" disabled data-click="aListOk">Выставить</button><button class="btn ghost" data-click="cm">Отмена</button></div>`)}
function aHours(a,el){
  if(!SEL)return;SEL.hours=+a;
  el.parentNode.querySelectorAll('button').forEach(b=>b.classList.toggle('a',b===el))}
function aStartIn(a,el){
  if(!SEL)return;
  const n=parseAsk(el.value),ok=n>=AUCTION.min&&n<=AUCTION.max;
  SEL.start=ok?n:0;
  $('aSCalc').textContent=ok?`Если продастся по старту, вы получите ${nb(n-auctionFee(n))}\u00a0₽`:(el.value.trim()?`Цена от ${nb(AUCTION.min)} до ${nb(AUCTION.max)}\u00a0₽`:'');
  $('aSGo').disabled=!ok}
async function aListOk(){
  if(!SEL||!SEL.start)return;
  const {id,start,hours,p}=SEL;cm();
  const r=await api.auctionCreate(id,start,hours);
  if(r.err){banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');render(true);return}
  SEL=null;TAB='mine';AT=0;
  banner('Аукцион начался',p.main+' · старт '+fmt(start)+' ₽');haptic('success');
  syncMine().catch(()=>{});go('auction')}

DRAW.auction=drawAuction;
DRAW.anew=drawAnew;
on({aQuick,aTab,aCls,aSort,aMore,aRefresh,aBidDlg,aAmtIn,aBidOk,aMineDlg,aCancelOk,aPick,aHours,aStartIn,aListOk});
