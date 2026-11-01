import {icon} from '../ui/design.js';
import {DEMO} from '../mode.js';
import {CN, TYPES} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {haptic} from '../platform.js';
import {loadState, rpc, sb, serverDown} from '../server.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {banner, cm, sm} from '../ui/modal.js';
import {dots, plateHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Обмен номерами 1 на 1. Всё решает сервер (функции propose_trade / respond_trade / cancel_trade в trades.sql):
// клиент только показывает списки и отправляет выбор.
let TR=null,TAT=0,TLOAD=false,TERR=false;     // мои активные обмены (входящие и исходящие)
let SQ='',SR=null,SBUSY=false,SERR=false,SSEQ=0,ST=null;   // поиск игрока: запрос, результаты, ошибка, номер запроса (отсекает устаревшие ответы), таймер
let TRADE_VIEW='all',PICK_QUERY='',REVIEW=null,SENDING=false;
let TID=null,TNICK='',TW=null,WANT=null,GIVE=null;   // черновик нового обмена

const row=(p,click='',sel=false)=>`<div class="row2 r${p.cls}${sel?' sel':''}"${click?` data-click="${click}" data-arg="${p.id}"`:''}>${plateHTML(p)}<div class="ri"><span>${CN[p.country].n} · ${TYPES.find(t=>t.k==p.type).n}</span>${dots(p.cls)}<b>${fmt(p.price)} ₽</b></div></div>`;
const msg=e=>{const m=(e&&e.message)||'';
 return /too many/.test(m)?'Не больше 10 активных предложений':/duplicate/.test(m)?'Такое предложение уже отправлено':/bad (give|want)/.test(m)?'Один из номеров уже недоступен':'Не получилось, попробуйте ещё раз'};

// Поиск игрока по нику. Строка поиска живёт отдельно от списков обменов и не перерисовывается при синхронизации, иначе сбивался бы фокус и клавиатура.
const ICO_S='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
const SHELL=`<div class="ps"><label class="ps-f"><i>${ICO_S}</i><input id="trQ" placeholder="Ник игрока" maxlength="20" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" data-input="trQ" data-change="trFind"><button class="ps-x" id="trX" data-click="trClear" aria-label="Очистить" hidden>✕</button></label><div id="trR" class="ps-r"></div></div><div id="trL"></div>`;
const hue=n=>{let h=0;for(const c of n)h=(h*31+c.codePointAt(0))%360;return h};
function drawSearch(){
 const el=$('trR');if(!el)return;const q=SQ.trim();let h='';
 $('trX').hidden=!SQ;
 if(!q)h=`<div class="ps-st"><i>${ICO_S}</i><b>Найдите игрока</b><span>Введите ник, выберите его номер и предложите обмен</span></div>`;
 else if(q.length<2)h='<div class="ps-note">Введите хотя бы 2 символа</div>';
 else if(SERR)h='<div class="ps-st"><i>:pi/alert:</i><b>Поиск не сработал</b><span>Проверьте соединение</span><button class="btn" data-click="trFind">Повторить</button></div>';
 else if(SBUSY&&!SR)h='<div class="ps-sk"></div><div class="ps-sk"></div><div class="ps-sk"></div>';
 else if(SR&&!SR.length)h=`<div class="ps-st"><i>:pi/search:</i><b>Никого не нашли</b><span>По запросу «${esc(q)}» игроков нет. Проверьте написание ника</span></div>`;
 else if(SR)h=`<div class="ps-note">Найдено: ${SR.length}${SR.length>=20?'+':''}</div>`+SR.map((p,i)=>`<div class="ps-i" style="animation-delay:${Math.min(i,8)*35}ms" data-click="trPick" data-arg="${p.id}"><span class="ps-av" style="--h:${hue(p.nick)}">${esc([...p.nick][0].toUpperCase())}</span><div class="ps-n"><b>${hl(p.nick,q)}</b><span>Уровень ${p.lvl}</span></div><em>Обмен<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></em></div>`).join('');
 el.innerHTML=h}
const hl=(n,q)=>{const i=n.toLowerCase().replace(/ё/g,'е').indexOf(q.toLowerCase().replace(/ё/g,'е'));return i<0?esc(n):esc(n.slice(0,i))+'<mark>'+esc(n.slice(i,i+q.length))+'</mark>'+esc(n.slice(i+q.length))};
async function doSearch(){
 const q=SQ.trim(),my=++SSEQ;
 if(q.length<2){SR=null;SBUSY=false;SERR=false;drawSearch();return}
 SBUSY=true;SERR=false;drawSearch();
 try{const r=await rpc('player_search',{p_q:q});if(my!=SSEQ)return;SR=r||[]}
 catch(e){if(my!=SSEQ)return;console.error(e);SERR=true;SR=null}
 SBUSY=false;drawSearch()}
function trQ(_,el){SQ=el.value;clearTimeout(ST);
 if(SQ.trim().length<2){SSEQ++;SR=null;SBUSY=false;SERR=false;drawSearch();return}
 ST=setTimeout(doSearch,280)}
function trClear(){SQ='';SR=null;SBUSY=false;SERR=false;SSEQ++;clearTimeout(ST);const q=$('trQ');if(q){q.value='';q.focus()}drawSearch()}
function trFind(){clearTimeout(ST);const q=$('trQ'),next=q?q.value:SQ;if(next===SQ&&SR&&!SERR&&!SBUSY)return;SQ=next;doSearch()}
const trPick=id=>{const p=(SR||[]).find(x=>x.id==id);if(p)startTrade(p.id,p.nick||'Игрок')};

function badge(){const b=$('tb'),n=TR?TR.in.length:0;if(!b)return;b.textContent=n;b.classList.toggle('on',n>0)}

// Синхронизация обменов с сервером. Вызывается при входе, каждые 40 секунд (10 секунд на экране «Обмены»), когда игра открыта, и при возвращении в приложение.
// Показывает плашки о новых предложениях и о судьбе наших предложений (принято / отклонено) и обновляет коллекцию после обмена.
let KNOWN=null;
const DONE_KEY='trDone';
const doneSeen=()=>{try{return new Set(JSON.parse(localStorage.getItem(DONE_KEY)||'[]'))}catch(_){return new Set()}};
const saveDone=d=>{try{localStorage.setItem(DONE_KEY,JSON.stringify([...d].slice(-100)))}catch(_){}};
async function sync(){
 const r=await rpc('my_trades'),first=!KNOWN;
 const fresh=r.in.filter(t=>first||!KNOWN.has(t.id));
 KNOWN=new Set(r.in.map(t=>t.id));
 TR=r;TAT=Date.now();badge();
 const seen=doneSeen(),nd=(r.done||[]).filter(d=>!seen.has(d.id));
 if(nd.length){nd.forEach(d=>seen.add(d.id));saveDone(seen)}
 if(nd.some(d=>d.status=='accepted'))await loadState();    // номера поменялись: обновляем свою коллекцию
 const q=[];
 if(fresh.length)q.push(['Обмены',fresh.length==1?(fresh[0].nick||'Игрок')+' предлагает обмен':'Новых предложений обмена: '+fresh.length]);
 for(const d of nd)q.push([d.status=='accepted'?'Обмен принят':'Обмен отклонён',d.nick||'Игрок']);
 q.forEach((m,i)=>setTimeout(()=>banner(m[0],m[1]),(first?3200:0)+i*2800));
 if(q.length)haptic('medium');
 if(q.length||$('v-trades').classList.contains('on'))render(true)}
async function loadTr(){
 TLOAD=true;TERR=false;
 try{await sync()}catch(e){console.error(e);TERR=true}
 TLOAD=false;TAT=Date.now();render(true)}
let PT=null,TICK=0;
export function initTrades(){
 // Раз в 10 секунд тикаем всегда, но на сервер ходим: каждый тик, если открыт экран «Обмены», иначе каждый четвёртый (40 с)
 let last=0;const run=()=>{if(document.hidden||serverDown()||Date.now()-last<15000)return;last=Date.now();sync().catch(e=>console.warn('trades',e))};
 const tick=()=>{TICK++;if($('v-trades').classList.contains('on')||TICK%6==0)run()};
 run();clearInterval(PT);PT=setInterval(tick,30000);
 document.addEventListener('visibilitychange',run)}

function exhibit(p,empty,side){return `<div class="trade-exhibit ${side}"><span class="trade-side-label">${side==='receive'?icon('download')+' ТЫ ПОЛУЧАЕШЬ':icon('share')+' ТЫ ОТДАЁШЬ'}</span>${p?`<div class="trade-plate">${plateHTML(p,'','')}</div><strong>${fmt(p.price)} <small>₽</small></strong><span class="trade-rare">${CN[p.country]?.n||p.country} · ${TYPES.find(t=>t.k===p.type)?.n||p.type}</span>`:`<div class="trade-slot">${icon('plus')}<span>${empty}</span></div>`}</div>`}
function pair(receive,give){return `<div class="trade-pair">${exhibit(receive,'Выбери номер игрока','receive')}${exhibit(give,'Выбери свой номер','give')}</div>`}
function proposal(t,incoming){return `<article class="trade-proposal"><header><span>${incoming?'Предложение от':'Предложено игроку'}</span><b>${esc(t.nick||'Игрок')}</b><small>№ ${t.id}</small></header>${pair(incoming?t.give:t.want,incoming?t.want:t.give)}<footer>${incoming?`<button class="v3-primary" data-click="trOk" data-arg="${t.id}">Проверить обмен ${icon('trades')}</button><button class="v3-text" data-click="trNo" data-arg="${t.id}">Отклонить</button>`:`<span>Ожидает решения игрока</span><button class="v3-text" data-click="trCancel" data-arg="${t.id}">Отозвать предложение</button>`}</footer></article>`}
export function drawTrades(){
 if(!TLOAD&&Date.now()-TAT>10000)loadTr();
 if(!$('trR')){$('trC').innerHTML=`<div class="trade-intro"><span class="v3-kicker">PLATE / EXCHANGE DESK</span><h1>Найди то,<br><span>чего не хватает.</span></h1><p>Два коллекционера. Два номера. Одно обоюдное решение.</p></div>${SHELL}`;$('trQ').value=SQ}
 const incoming=TR?.in||[],outgoing=TR?.out||[],done=TR?.done||[];
 const tabs=[['all','Активные',incoming.length+outgoing.length],['in','Входящие',incoming.length],['out','Исходящие',outgoing.length],['history','История',done.length]];
 let h=!TR?`<div class="trade-empty">${icon('refresh')}<h2>${TERR?'Нет связи с сервером':'Загружаем предложения'}</h2></div>`:TRADE_VIEW==='history'?`<div class="trade-history">${done.length?done.map(t=>`<div><span>${icon(t.status==='accepted'?'check':'close')}</span><b>${esc(t.nick||'Игрок')}</b><small>${t.status==='accepted'?'Обмен завершён':'Предложение закрыто'}</small></div>`).join(''):'<p>Сервер пока не вернул завершённых обменов. Здесь не создаётся вымышленная история.</p>'}</div>`:
 `${TRADE_VIEW!=='out'?incoming.map(t=>proposal(t,true)).join(''):''}${TRADE_VIEW!=='in'?outgoing.map(t=>proposal(t,false)).join(''):''}`;
 if(!h)h=`<div class="trade-empty">${icon('trades')}<h2>Начни с разговора.</h2><p>Найди игрока по нику. Слева будет то, что ты получишь, справа — твой номер.</p><button class="v3-text" data-click="go" data-arg="top">Посмотреть коллекционеров ${icon('top')}</button></div>`;
 $('trL').innerHTML=`<nav class="trade-tabs">${tabs.map(([k,n,c])=>`<button class="${TRADE_VIEW===k?'a':''}" data-click="tradeView" data-arg="${k}">${n}<small>${c}</small></button>`).join('')}</nav>${h}<button class="v3-text trade-refresh" data-click="trRefresh">${icon('refresh')} Обновить предложения</button>`;drawSearch()
}

function trOk(id){const t=TR?.in.find(x=>x.id==id);if(!t)return;sm(`<div class="trade-review"><span class="v3-kicker">ПРОВЕРЬ ПЕРЕД ПОДТВЕРЖДЕНИЕМ</span><h2>Обмен с ${esc(t.nick||'игроком')}</h2>${pair(t.give,t.want)}<p>Сервер ещё раз проверит доступность обоих номеров. После успешного обмена отменить его нельзя.</p><button class="v3-primary" data-click="trYes" data-arg="${id}">Подтвердить обмен ${icon('check')}</button><button class="v3-text" data-click="cm">Вернуться</button></div>`)}
async function trYes(id){
 cm();
 try{
  const r=await rpc('respond_trade',{p_id:+id,p_accept:true});
  if(r=='accepted')banner('Обмен состоялся','Номера поменялись местами');
  else banner('Обмен недоступен','Номера изменились или предложение устарело');
  await loadState()}
 catch(e){console.error(e);banner('Ошибка',msg(e))}
 TAT=0;render(true)}
async function trNo(id){
 try{await rpc('respond_trade',{p_id:+id,p_accept:false})}catch(e){console.error(e);banner('Ошибка',msg(e))}
 TAT=0;render(true)}
async function trCancel(id){
 try{await rpc('cancel_trade',{p_id:+id})}catch(e){console.error(e);banner('Ошибка',msg(e))}
 TAT=0;render(true)}

// Новый обмен: выбираем номер игрока и свой номер
export async function startTrade(id,nick){
 TID=id;TNICK=nick;TW=null;WANT=GIVE=null;go('tnew');
 try{TW=await rpc('get_player_plates',{pid:id})}catch(e){console.error(e);TW=[]}
 render(true)}
export function drawTnew(){
 const mine=S.col.filter(p=>!p.bound).slice().sort((a,b)=>b.price-a.price),w=TW&&TW.find(p=>p.id==WANT),g=mine.find(p=>p.id==GIVE);
 $('tnC').innerHTML=`<header class="trade-draft-head"><div><span class="v3-kicker">ЛИЧНОЕ ПРЕДЛОЖЕНИЕ</span><h1>Ты и ${esc(TNICK)}</h1></div><button class="v3-text" data-click="go" data-arg="trades">Все обмены ${icon('trades')}</button></header><div class="trade-composer"><div><button class="trade-pick-target" data-click="tradePicker" data-arg="want">${exhibit(w,'Номер игрока','receive')}<span class="trade-pick-caption">${w?'Изменить выбор':'Выбрать номер'} ${icon(w?'gen':'plus')}</span></button></div><div><button class="trade-pick-target" data-click="tradePicker" data-arg="give">${exhibit(g,'Твоя коллекция','give')}<span class="trade-pick-caption">${g?'Изменить выбор':'Предложить номер'} ${icon(g?'gen':'plus')}</span></button></div></div><section class="trade-terms"><div>${icon('clans')}<span>Только обмен номерами. Без скрытой доплаты.</span></div><div>${icon('safe')}<span>Сейф и привязанные номера не участвуют.</span></div><div>${icon('check')}<span>Перед исполнением сервер проверяет владельцев и доступность.</span></div></section>${w&&g?`<div class="trade-comparison"><span>Разница игровых оценок</span><b>${fmt(Math.abs(w.price-g.price))} ₽</b><small>Это справочное сравнение, не сумма списания и не обещание рыночной цены.</small></div>`:''}`;
 $('tnBar').innerHTML=`<div><b>${w&&g?'Обе стороны выбраны':'Выбери обе стороны'}</b><small>${w&&g?'Предложение можно отозвать до принятия':'Слева получаешь · справа отдаёшь'}</small></div><button class="v3-primary" ${w&&g?'':'disabled'} data-click="tradeReview">Проверить ${icon('arrow')}</button>`
}
function tradePicker(side){PICK_QUERY='';drawPicker(side)}
function drawPicker(side){const list=side==='want'?TW:S.col.filter(p=>!p.bound),q=PICK_QUERY.toLocaleLowerCase('ru'),a=(list||[]).filter(p=>(p.main+' '+p.reg).toLocaleLowerCase('ru').includes(q));sm(`<div class="trade-picker"><span class="v3-kicker">${side==='want'?'ТЫ ПОЛУЧАЕШЬ':'ТЫ ОТДАЁШЬ'}</span><h2>${side==='want'?'Коллекция '+esc(TNICK):'Твоя коллекция'}</h2><label class="trade-picker-search">${icon('search')}<input data-input="tradePickerSearch" data-arg="${side}" value="${esc(PICK_QUERY)}" placeholder="Комбинация или регион" aria-label="Поиск номера"></label><div class="trade-picker-list">${a.length?a.map(p=>`<button class="${p.id===(side==='want'?WANT:GIVE)?'a':''}" data-click="${side==='want'?'pickWant':'pickGive'}" data-arg="${p.id}">${plateHTML(p,'','')}<span>${fmt(p.price)} ₽ ${icon(p.id===(side==='want'?WANT:GIVE)?'check':'plus')}</span></button>`).join(''):`<p>${list?'Подходящих номеров нет.':'Коллекция загружается.'}</p>`}</div></div>`)}
function tradeReview(){const w=TW?.find(p=>p.id===WANT),g=S.col.find(p=>p.id===GIVE);if(!w||!g)return;REVIEW={to:TID,give:GIVE,want:WANT};sm(`<div class="trade-review"><span class="v3-kicker">ПРЕДЛОЖЕНИЕ ИГРОКУ</span><h2>${esc(TNICK)}</h2>${pair(w,g)}<p>Сейчас ты отправишь предложение, а не завершишь обмен. До принятия другим игроком его можно отозвать.</p><button class="v3-primary" data-click="sendTrade">Отправить предложение ${icon('share')}</button><button class="v3-text" data-click="cm">Изменить</button></div>`)}

async function sendTrade(){
 if(SENDING||!REVIEW||REVIEW.to!==TID||REVIEW.give!==GIVE||REVIEW.want!==WANT)return;SENDING=true;cm();
 try{const tid=await rpc('propose_trade',{p_to:TID,p_give:GIVE,p_want:WANT});banner('Обмен',DEMO?'Предложение сохранено локально в демо':'Предложение отправлено');TAT=0;go('trades');
  if(!DEMO)sb.functions.invoke('notify-trade',{body:{trade_id:tid}}).catch(()=>{})}   // пуш в Telegram получателю; если не получится, не страшно
 catch(e){console.error(e);banner('Ошибка',msg(e))}finally{SENDING=false;REVIEW=null}}

DRAW.trades=drawTrades;
DRAW.tnew=drawTnew;
on({tradeView:a=>{TRADE_VIEW=a;render(true)},tradePicker,tradeReview,tradePickerSearch:(a,el)=>{PICK_QUERY=el.value;const pos=el.selectionStart;drawPicker(a);const input=document.querySelector('.trade-picker input');input?.focus();input?.setSelectionRange(pos,pos)},trQ,trFind,trClear,trPick,trOk,trYes,trNo,trCancel,trRefresh:()=>{TAT=0;render(true)},pickWant:a=>{WANT=+a;cm();render(true)},pickGive:a=>{GIVE=+a;cm();render(true)},sendTrade});
