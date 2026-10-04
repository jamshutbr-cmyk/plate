import {CN, TYPES} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {loadAll, rpc} from '../server.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {banner, cm, sm} from '../ui/modal.js';
import {dots, plateHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Обмен номерами 1 на 1. Всё решает сервер (функции propose_trade / respond_trade / cancel_trade в trades.sql):
// клиент только показывает списки и отправляет выбор.
let TR=null,TAT=0,TLOAD=false,TERR=false;     // мои активные обмены (входящие и исходящие)
let TID=null,TNICK='',TW=null,WANT=null,GIVE=null;   // черновик нового обмена

const row=(p,click='',sel=false)=>`<div class="row2 r${p.cls}${sel?' sel':''}"${click?` data-click="${click}" data-arg="${p.id}"`:''}>${plateHTML(p)}<div class="ri"><span>${CN[p.country].n} · ${TYPES.find(t=>t.k==p.type).n}</span>${dots(p.cls)}<b>${fmt(p.price)} ₽</b></div></div>`;
const msg=e=>{const m=(e&&e.message)||'';
 return /too many/.test(m)?'Не больше 10 активных предложений':/duplicate/.test(m)?'Такое предложение уже отправлено':/bad (give|want)/.test(m)?'Один из номеров уже недоступен':'Не получилось, попробуйте ещё раз'};

function badge(){const b=$('tb'),n=TR?TR.in.length:0;if(!b)return;b.textContent=n;b.classList.toggle('on',n>0)}
async function loadTr(){
 TLOAD=true;TERR=false;
 try{TR=await rpc('my_trades')}catch(e){console.error(e);TERR=true}
 TLOAD=false;TAT=Date.now();badge();render(true)}
// Вызывается при входе в игру: красный счётчик на тайле и плашка, если есть входящие предложения
export async function initTrades(){
 try{TR=await rpc('my_trades');TAT=Date.now();badge();
  if(TR.in.length)setTimeout(()=>banner('Обмены','Вам предложили обмен: '+TR.in.length),3200)}
 catch(e){console.warn('trades',e)}}

export function drawTrades(){
 if(!TLOAD&&Date.now()-TAT>10000)loadTr();
 let h;
 if(!TR)h=`<p class="tl" style="text-align:center">${TERR?'Не удалось загрузить обмены':'Загрузка…'}</p>`;
 else{
  h=(TR.in.length?`<h3 class="tsec">Вам предлагают</h3>`+TR.in.map(t=>`<div class="card"><div class="tl">${esc(t.nick||'Игрок')} предлагает обмен</div><div class="tl" style="margin-top:8px">Вы получите</div>${row(t.give)}<div class="tl">Вы отдадите</div>${row(t.want)}<div class="row" style="margin-top:10px"><button class="btn" data-click="trOk" data-arg="${t.id}">Принять</button><button class="btn red" data-click="trNo" data-arg="${t.id}">Отклонить</button></div></div>`).join(''):'')
  +(TR.out.length?`<h3 class="tsec">Вы предложили</h3>`+TR.out.map(t=>`<div class="card"><div class="tl">Игроку ${esc(t.nick||'Игрок')}</div><div class="tl" style="margin-top:8px">Вы отдаёте</div>${row(t.give)}<div class="tl">Вы получите</div>${row(t.want)}<button class="btn red" style="width:100%;margin-top:10px" data-click="trCancel" data-arg="${t.id}">Отозвать</button></div>`).join(''):'')
  ||`<p class="tl" style="text-align:center">Нет активных обменов.<br>Откройте профиль игрока в Рейтинге и нажмите «Предложить обмен».</p>`;
 }
 $('trC').innerHTML=h+`<button class="btn" style="width:100%;margin-top:10px" data-click="trRefresh">Обновить</button>`}

function trOk(id){sm(`<div class="dlg"><h3>Принять обмен?</h3><div class="tl" style="margin-bottom:14px">Обмен необратим.</div><button class="btn" data-click="trYes" data-arg="${id}">Принять</button><button class="btn" data-click="cm">Отмена</button></div>`)}
async function trYes(id){
 cm();
 try{
  const r=await rpc('respond_trade',{p_id:+id,p_accept:true});
  if(r=='accepted')banner('Обмен состоялся','Номера поменялись местами');
  else banner('Обмен недоступен','Номера изменились или предложение устарело');
  await loadAll()}
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
 try{await rpc('propose_trade',{p_to:TID,p_give:GIVE,p_want:WANT});banner('Обмен','Предложение отправлено');TAT=0;go('trades')}
 catch(e){console.error(e);banner('Ошибка',msg(e))}}

DRAW.trades=drawTrades;
DRAW.tnew=drawTnew;
on({trOk,trYes,trNo,trCancel,trRefresh:()=>{TAT=0;render(true)},pickWant:a=>{WANT=+a;render(true)},pickGive:a=>{GIVE=+a;render(true)},sendTrade});
