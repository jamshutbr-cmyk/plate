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
 else if(SERR)h='<div class="ps-st"><i>⚠️</i><b>Поиск не сработал</b><span>Проверьте соединение</span><button class="btn" data-click="trFind">Повторить</button></div>';
 else if(SBUSY&&!SR)h='<div class="ps-sk"></div><div class="ps-sk"></div><div class="ps-sk"></div>';
 else if(SR&&!SR.length)h=`<div class="ps-st"><i>🕵️</i><b>Никого не нашли</b><span>По запросу «${esc(q)}» игроков нет. Проверьте написание ника</span></div>`;
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
function trFind(){clearTimeout(ST);const q=$('trQ');if(q)SQ=q.value;doSearch()}
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

export function drawTrades(){
 if(!TLOAD&&Date.now()-TAT>10000)loadTr();
 let h;
 if(!TR)h=`<p class="tl" style="text-align:center">${TERR?'Не удалось загрузить обмены':'Загрузка…'}</p>`;
 else{
  h=(TR.in.length?`<h3 class="tsec">Вам предлагают</h3>`+TR.in.map(t=>`<div class="card"><div class="tl">${esc(t.nick||'Игрок')} предлагает обмен</div><div class="tl" style="margin-top:8px">Вы получите</div>${row(t.give)}<div class="tl">Вы отдадите</div>${row(t.want)}<div class="row" style="margin-top:10px"><button class="btn" data-click="trOk" data-arg="${t.id}">Принять</button><button class="btn red" data-click="trNo" data-arg="${t.id}">Отклонить</button></div></div>`).join(''):'')
  +(TR.out.length?`<h3 class="tsec">Вы предложили</h3>`+TR.out.map(t=>`<div class="card"><div class="tl">Игроку ${esc(t.nick||'Игрок')}</div><div class="tl" style="margin-top:8px">Вы отдаёте</div>${row(t.give)}<div class="tl">Вы получите</div>${row(t.want)}<button class="btn red" style="width:100%;margin-top:10px" data-click="trCancel" data-arg="${t.id}">Отозвать</button></div>`).join(''):'')
  ||`<p class="tl" style="text-align:center">Нет активных обменов.<br>Найдите игрока по нику выше или откройте его профиль в Рейтинге.</p>`;
 }
 if(!$('trR')){$('trC').innerHTML=SHELL;$('trQ').value=SQ}
 $('trL').innerHTML=h+`<button class="btn" style="width:100%;margin-top:10px" data-click="trRefresh">Обновить</button>`;
 drawSearch()}

function trOk(id){sm(`<div class="dlg"><h3>Принять обмен?</h3><div class="tl" style="margin-bottom:14px">Обмен необратим.</div><button class="btn" data-click="trYes" data-arg="${id}">Принять</button><button class="btn" data-click="cm">Отмена</button></div>`)}
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
 const mine=S.col.slice().sort((a,b)=>b.price-a.price),w=TW&&TW.find(p=>p.id==WANT),g=mine.find(p=>p.id==GIVE);
 $('tnC').innerHTML=`<h3 class="tsec">Что хотите получить у ${esc(TNICK)}</h3>`+(TW?(TW.length?TW.map(p=>row(p,'pickWant',p.id==WANT)).join(''):'<p class="tl">У игрока нет номеров для обмена</p>'):'<p class="tl">Загрузка…</p>')
  +`<h3 class="tsec">Что отдадите</h3>`+(mine.length?mine.map(p=>row(p,'pickGive',p.id==GIVE)).join(''):'<p class="tl">В вашей коллекции нет номеров (сейф в обмене не участвует)</p>');
 $('tnBar').innerHTML=`<div style="flex:1;font-size:14px;color:var(--mut)">${w&&g?`Отдаёте ${fmt(g.price)} ₽ · получаете ${fmt(w.price)} ₽`:'Выберите оба номера'}</div><button class="btn" style="flex:none;width:50%" ${w&&g?'':'disabled'} data-click="sendTrade">Предложить</button>`}
async function sendTrade(){
 try{const tid=await rpc('propose_trade',{p_to:TID,p_give:GIVE,p_want:WANT});banner('Обмен','Предложение отправлено');TAT=0;go('trades');
  sb.functions.invoke('notify-trade',{body:{trade_id:tid}}).catch(()=>{})}   // пуш в Telegram получателю; если не получится, не страшно
 catch(e){console.error(e);banner('Ошибка',msg(e))}}

DRAW.trades=drawTrades;
DRAW.tnew=drawTnew;
on({trQ,trFind,trClear,trPick,trOk,trYes,trNo,trCancel,trRefresh:()=>{TAT=0;render(true)},pickWant:a=>{WANT=+a;render(true)},pickGive:a=>{GIVE=+a;render(true)},sendTrade});
