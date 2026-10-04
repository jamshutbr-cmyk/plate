import {api} from '../api.js';
import {CN, MARKET, RAR, TYPES, marketFee} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, go, render} from '../router.js';
import {loadPlayer, rpc} from '../server.js';
import {S, find} from '../state.js';
import {on} from '../ui/actions.js';
import {banner, cm, sm} from '../ui/modal.js';
import {dots, plateHTML} from '../ui/plate.js';
import {$, esc, fmt, parseAsk} from '../util.js';

// Рынок игроков: покупка чужих номеров, свои лоты, выставление номера на продажу.
// Всё решает сервер (market.sql: market_list_plate / market_buy / market_cancel / market_browse / market_mine):
// клиент только показывает списки и отправляет выбор. Номер на время лота уходит из коллекции.
let TAB='buy',CLS=null,SORT='new';          // вкладка, фильтр по редкости (null = все), сортировка
let LOTS=null,MORE=false,MINE=null;          // лента, есть ли ещё страница, мои лоты и продажи
let AT=0,LOAD=false,ERR=false,LT=0;          // время последней загрузки, идёт ли загрузка, ошибка, токен от устаревших ответов
let SEL=null;                                // номер, который сейчас выставляем: {id,p,ask}

const SORTS=[['new','Новые'],['cheap','Дешёвые'],['dear','Дорогие']];
const ERRS={money:'Не хватает денег',full:'Коллекция заполнена: продайте номера или расширьте её',gone:'Лот уже продан или снят',own:'Это ваш лот',price:'Недопустимая цена',lots:'Не больше '+MARKET.lots+' лотов сразу',plate:'Номер недоступен'};

const typeName=t=>TYPES.find(x=>x.k==t).n;
// Строка с номером. skin '' = без рамки (чужие номера), по умолчанию рамка игрока.
const row=(p,click,sub='',skin=S.equip.skin)=>`<div class="row2 r${p.cls}"${click?` data-click="${click}" data-arg="${p.id}"`:''}>${plateHTML(p,'',skin)}<div class="ri"><span>${CN[p.country].n} · ${typeName(p.type)}${sub}</span>${dots(p.cls)}<b>${fmt(p.price)} ₽</b></div></div>`;
// Лот: рядом цена продавца и оценка игры
const lot=(l,mine)=>`<div class="row2 lot r${l.cls}" data-click="${mine?'mCancelDlg':'mBuyDlg'}" data-arg="${l.id}">${plateHTML(l,'',mine?S.equip.skin:'')}<div class="lf"><div class="lm"><span>${mine?'Ваш лот':esc(l.nick)}</span><small>${typeName(l.type)}</small>${dots(l.cls)}</div><div class="lp"><b>${fmt(l.ask)} ₽</b><span class="est">оценка ${fmt(l.price)} ₽</span></div></div></div>`;

// ---------- загрузка ----------
async function loadLots(more=false){
  const tok=++LT,off=more&&LOTS?LOTS.length:0;
  try{
    const r=await rpc('market_browse',{p_cls:CLS,p_sort:SORT,p_off:off});
    if(tok!=LT)return;
    if(more&&LOTS){const have=new Set(LOTS.map(x=>x.id));LOTS=LOTS.concat(r.filter(x=>!have.has(x.id)))}else LOTS=r;
    MORE=r.length>=MARKET.page;ERR=false}
  catch(e){if(tok!=LT)return;console.error(e);ERR=true}}

// Мои лоты и непрочитанные продажи. Зовётся и из экрана рынка, и фоновым опросом (initMarket): одновременные вызовы склеиваются.
let SY=null,FIRST=true;
async function doSync(){
  const r=await rpc('market_mine');
  MINE={lots:r.lots||[],sold:[]};
  const sold=r.sold||[];
  if(sold.length){
    await api.marketAck(Math.max(...sold.map(s=>s.id)));
    await loadPlayer();                                   // баланс вырос
    const base=FIRST?6500:0;                              // на старте не перебиваем плашки обменов
    sold.forEach((s,i)=>setTimeout(()=>banner('Номер продан',s.main+' · +'+fmt(s.ask-s.fee)+' ₽'),base+i*2800));
    haptic('success')}
  FIRST=false;
  if(sold.length||$('v-market').classList.contains('on')||$('v-mnew').classList.contains('on'))render(true)}
const syncMine=()=>SY||(SY=doSync().finally(()=>{SY=null}));

async function refresh(){
  LOAD=true;
  try{await Promise.all([loadLots(),syncMine().catch(e=>{console.error(e);ERR=true})])}
  finally{LOAD=false;AT=Date.now();render(true)}}

let MT=null;
// Раз в 20 секунд (пока игра видна) узнаём, купили ли наши номера
export function initMarket(){
  const run=()=>{if(!document.hidden)syncMine().catch(e=>console.warn('market',e))};
  run();clearInterval(MT);MT=setInterval(run,20000);
  document.addEventListener('visibilitychange',run)}

// ---------- экраны ----------
export function drawMarket(){
  if(!LOAD&&Date.now()-AT>10000)refresh();
  const tabs=`<div class="chips seg"><button class="${TAB=='buy'?'a':''}" data-click="mTab" data-arg="buy">Рынок</button><button class="${TAB=='mine'?'a':''}" data-click="mTab" data-arg="mine">Мои лоты${MINE&&MINE.lots.length?' · '+MINE.lots.length:''}</button></div>`;
  let h=tabs;
  if(TAB=='buy'){
    h+=`<div class="chips"><button class="${CLS==null?'a':''}" data-click="mCls" data-arg="-1">Все</button>${RAR.map((r,i)=>`<button class="${CLS===i?'a':''}" data-click="mCls" data-arg="${i}">${r.n}</button>`).join('')}</div>`
      +`<div class="chips seg srt">${SORTS.map(([k,n])=>`<button class="${SORT==k?'a':''}" data-click="mSort" data-arg="${k}">${n}</button>`).join('')}</div>`;
    if(!LOTS)h+=`<p class="tl" style="text-align:center">${ERR?'Не удалось загрузить рынок':'Загрузка…'}</p>`;
    else{
      h+=LOTS.length?LOTS.map(l=>lot(l,false)).join(''):`<p class="tl" style="text-align:center">Лотов пока нет.<br>Выставите свой номер во вкладке «Мои лоты».</p>`;
      if(MORE)h+=`<button class="btn" style="width:100%;margin-top:6px" data-click="mMore">Показать ещё</button>`}
  }else{
    h+=`<button class="big2" style="margin-bottom:14px" data-click="go" data-arg="mnew">Выставить номер</button>`;
    if(!MINE)h+=`<p class="tl" style="text-align:center">${ERR?'Не удалось загрузить лоты':'Загрузка…'}</p>`;
    else h+=MINE.lots.length?`<h3 class="tsec">На рынке сейчас · ${MINE.lots.length} из ${MARKET.lots}</h3>`+MINE.lots.map(l=>lot(l,true)).join('')+`<p class="tl" style="text-align:center">Нажмите на лот, чтобы снять его с рынка.</p>`
      :`<p class="tl" style="text-align:center">У вас нет лотов.<br>Рынок удерживает ${MARKET.fee}% с каждой продажи.</p>`}
  $('mkC').innerHTML=h+`<button class="btn" style="width:100%;margin-top:10px" data-click="mRefresh">Обновить</button>`}

export function drawMnew(){
  const left=MARKET.lots-(MINE?MINE.lots.length:0),sf=new Set(S.safe.map(x=>x.id));
  const all=[...S.col,...S.safe].sort((a,b)=>b.price-a.price);
  $('mnC').innerHTML=`<p class="tl">Выберите номер для продажи другим игрокам. Пока он на рынке, его нельзя продать, обменять или поместить в сейф: только снять с рынка. Свободных лотов: ${Math.max(left,0)}.</p>`
    +(all.length?all.map(p=>row(p,'mPick',sf.has(p.id)?' · в сейфе':'')).join(''):'<p class="tl" style="text-align:center">У вас нет номеров.</p>')}

// ---------- действия ----------
const mTab=a=>{TAB=a;render(true)};
const mCls=a=>{CLS=+a<0?null:+a;LOTS=null;AT=0;render(true)};
const mSort=a=>{SORT=a;LOTS=null;AT=0;render(true)};
const mMore=async()=>{await loadLots(true);render(true)};
const mRefresh=()=>{AT=0;render(true)};

function mBuyDlg(id){
  const l=LOTS&&LOTS.find(x=>x.id==id);if(!l)return;
  const lack=S.bal<l.ask,full=S.col.length>=S.capC;
  sm(`<div class="dlg"><h3>Купить номер?</h3>${plateHTML(l,'','')}<p class="tl" style="margin:12px 0">${esc(l.main)} · ${esc(l.rn)} · продаёт ${esc(l.nick)}<br>Оценка игры: ${fmt(l.price)} ₽</p>`
    +(lack?`<div class="tl" style="margin-bottom:10px">Не хватает ${fmt(l.ask-S.bal)} ₽</div>`:'')
    +(full?`<div class="tl" style="margin-bottom:10px">Коллекция заполнена: освободите место</div>`:'')
    +`<button class="btn" ${lack||full?'disabled':''} data-click="mBuyOk" data-arg="${l.id}">Купить · ${fmt(l.ask)} ₽</button><button class="btn" data-click="cm">Отмена</button></div>`)}
async function mBuyOk(id){
  cm();
  const r=await api.marketBuy(+id);
  if(r.err)banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');
  else{banner('Номер куплен',r.main+' · '+fmt(r.ask)+' ₽');haptic('success')}
  AT=0;render(true)}

function mCancelDlg(id){
  const l=MINE&&MINE.lots.find(x=>x.id==id);if(!l)return;
  sm(`<div class="dlg"><h3>Снять с рынка?</h3>${plateHTML(l)}<p class="tl" style="margin:12px 0">${esc(l.main)} вернётся в вашу коллекцию.</p><button class="btn red" data-click="mCancelOk" data-arg="${l.id}">Снять</button><button class="btn" data-click="cm">Отмена</button></div>`)}
async function mCancelOk(id){
  cm();
  const r=await api.marketCancel(+id);
  if(r.err)banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');
  else banner('Лот снят','Номер вернулся в коллекцию');
  AT=0;render(true)}

function mPick(id){
  const p=find(+id);if(!p)return;
  SEL={id:p.id,p,ask:0};
  sm(`<div class="dlg"><h3>Выставить номер</h3>${plateHTML(p)}<p class="tl" style="margin:12px 0">Оценка игры: ${fmt(p.price)} ₽. Рынок удерживает ${MARKET.fee}% с продавца.<br>Можно писать «1500000», «1.5м», «250к» или «2млрд».</p>`
    +`<input class="gq" id="mAsk" inputmode="text" placeholder="Цена, ₽" maxlength="16" autocomplete="off" data-input="mAskIn">`
    +`<div class="tl" id="mCalc" style="margin:2px 0 12px;min-height:18px"></div>`
    +`<button class="btn" id="mGo" disabled data-click="mListOk">Выставить</button><button class="btn" data-click="cm">Отмена</button></div>`)}
function mAskIn(a,el){
  if(!SEL)return;
  const n=parseAsk(el.value),ok=n>=MARKET.min&&n<=MARKET.max;
  SEL.ask=ok?n:0;
  $('mCalc').textContent=ok?`Цена ${fmt(n)} ₽ · вы получите ${fmt(n-marketFee(n))} ₽ (комиссия ${fmt(marketFee(n))} ₽)`:(el.value.trim()?`Цена от ${fmt(MARKET.min)} до ${fmt(MARKET.max)} ₽`:'');
  $('mGo').disabled=!ok}
async function mListOk(){
  if(!SEL||!SEL.ask)return;
  const {id,ask,p}=SEL;
  cm();
  const r=await api.marketList(id,ask);
  if(r.err){banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');render(true);return}
  SEL=null;TAB='mine';AT=0;
  banner('Номер выставлен',p.main+' · '+fmt(ask)+' ₽');haptic('success');
  go('market')}

DRAW.market=drawMarket;
DRAW.mnew=drawMnew;
on({mTab,mCls,mSort,mMore,mRefresh,mBuyDlg,mBuyOk,mCancelDlg,mCancelOk,mPick,mAskIn,mListOk});
