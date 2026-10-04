import {RAR} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {rpc} from '../server.js';
import {on} from '../ui/actions.js';
import {S} from '../state.js';
import {nickCls, plateHTML, titleHTML} from '../ui/plate.js';
import {pubShowcase} from './showcase.js';
import {startTrade} from './trade.js';
import {$, esc, fmt} from '../util.js';

// Таблица лидеров, два вида: по самому дорогому выбитому номеру ('best') и по монетам на балансе ('coins').
// Данные приходят с сервера (get_leaderboard) и кэшируются на 30 секунд отдельно для каждого вида.
const KINDS=[['best','🏆','Дорогой номер'],['coins','💰','Монеты']];
let KIND='best',TOPS={},ATS={},LOAD=false,ERR=false;   // вид, ответы сервера и время загрузки по видам
let STY={};   // титулы и рамки игроков {id:{title,skin}}: отдельный запрос get_styles, чтобы не трогать get_leaderboard
const titleOf=r=>r.me?S.equip.title:(STY[r.id]||{}).title;
const nickOf=r=>r.me?S.equip.nick:(STY[r.id]||{}).nick;
async function loadStyles(ids){ids=ids.filter(Boolean);if(!ids.length)return;try{Object.assign(STY,await rpc('get_styles',{ids})||{})}catch(e){console.warn('styles',e)}}
const MEDAL=['🥇','🥈','🥉'],MIN=10;   // сколько мест показывать минимум: пустые рисуются заглушками
const row=(r,me)=>`<div class="tr${me?' me':''}" data-click="openPlayer" data-arg="${r.id}"><span class="rk">${MEDAL[r.rk-1]||r.rk}</span><div class="tn"><div class="tnr"><b class="${nickCls(nickOf(r)).trim()}">${esc(r.nick||'Игрок')}</b>${titleHTML(titleOf(r))}</div><span class="tl">Уровень ${r.lvl} · номеров: ${fmt(r.total)}</span></div><b class="tpr">${fmt(r.val)} ₽</b></div>`;
const empty=n=>`<div class="tr emp"><span class="rk">${MEDAL[n-1]||n}</span><div class="tn"><b>Свободно</b></div></div>`;
async function load(){
 const k=KIND;LOAD=true;ERR=false;
 try{let d;
  try{d=await rpc('get_leaderboard',{p_kind:k})}
  catch(e){   // сервер ещё со старой функцией без аргумента (leaderboard.sql не запускали заново): рейтинг по номеру работает как раньше
   if(k!='best')throw e;
   d=await rpc('get_leaderboard');console.warn('get_leaderboard(p_kind) нет на сервере, запустите supabase/leaderboard.sql',e)}
  for(const r of [...d.top,d.me])if(r&&r.val==null)r.val=r.best;
  await loadStyles([...d.top.map(r=>r.id),d.me&&d.me.id]);TOPS[k]=d}catch(e){console.error(e);ERR=true}
 LOAD=false;ATS[k]=Date.now();render(true)}
export function drawTop(){
 const TOP=TOPS[KIND];
 if(!LOAD&&Date.now()-(ATS[KIND]||0)>30000)load();
 let h=`<div class="tt-tabs">${KINDS.map(([k,i,n])=>`<button class="${KIND==k?'a':''}" data-click="topKind" data-arg="${k}"><i>${i}</i>${n}</button>`).join('')}</div>`;
 if(!TOP)h+=ERR?`<p class="tl" style="text-align:center">Не удалось загрузить рейтинг</p>`:`<p class="tl" style="text-align:center">Загрузка…</p>`;
 else{
  const me=TOP.me;
  h+=TOP.top.length?'':`<p class="tl" style="text-align:center">Пока никого. Сгенерируйте номер!</p>`;
  h+=TOP.top.map(r=>row(r,r.me)).join('');
  for(let n=TOP.top.length+1;n<=MIN;n++)h+=empty(n);
  if(me&&me.rk>50)h+=`<div class="tsep">· · ·</div>`+row(me,true);
 }
 $('topC').innerHTML=h+`<button class="btn" style="width:100%;margin-top:10px" data-click="topRefresh">Обновить</button>`}
DRAW.top=drawTop;
on({topRefresh:()=>{ATS[KIND]=0;render(true)},topKind:k=>{if(k==KIND)return;KIND=k;render(true)}});

// Профиль другого игрока (только просмотр): имя, уровень, статистика и самый дорогой номер. Баланс не показываем.
let PUB=null,PERR=false,PID=null,PSC=[];
async function openPlayer(id){
 PID=id;PUB=null;PERR=false;PSC=[];go('pub');
 try{PUB=await rpc('get_player_profile',{pid:id});if(!STY[id])await loadStyles([id])}catch(e){console.error(e)}
 try{PSC=await rpc('get_showcase',{pid:id})||[]}catch(e){console.warn('showcase',e)}
 if(!PUB)PERR=true;
 render(true)}
export function drawPub(){
 if(!PUB){$('pubC').innerHTML=`<p class="tl" style="text-align:center">${PERR?'Не удалось загрузить профиль':'Загрузка…'}</p>`;return}
 const p=PUB,sy=p.me?S.equip:(STY[PID]||{}),st=p.stats,nm=p.nick||'Игрок',need=p.lvl*1250,mx=Math.max(1,...st.cls),
  days=Math.max(1,Math.ceil((Date.now()-new Date(p.since))/864e5));
 $('pubC').innerHTML=`<div class="card"><div class="phd"><div class="pav">${esc([...nm][0].toUpperCase())}</div><div><b class="pn${nickCls(sy.nick)}">${esc(nm)}</b>${titleHTML(sy.title)}<span class="tl">Уровень ${p.lvl} · в игре ${days} дн.</span></div></div>
 <div class="sub" style="font-size:16px;gap:14px;align-items:center"><div class="pb" style="flex:1"><i style="width:${Math.min(100,p.xp/need*100)}%"></i></div><span>${fmt(p.xp)} / ${fmt(need)}</span></div></div>
 ${p.me?'':`<button class="btn" style="width:100%;margin-bottom:10px" data-click="newTrade">Предложить обмен</button>`}
 <div class="st2"><div><b>${fmt(st.n)}</b><span>Выпало номеров</span></div><div><b>${fmt(st.best)} ₽</b><span>Рекорд цены</span></div><div><b>${fmt(p.count)}</b><span>Номеров сейчас</span></div><div><b>${fmt(p.value)} ₽</b><span>Общая стоимость</span></div></div>
 ${p.me?'':pubShowcase(PSC,sy.skin)}
 ${p.top?`<div class="card"><h3>Самый дорогой сейчас<span class="tl">${fmt(p.top.price)} ₽</span></h3><div class="tp">${plateHTML(p.top,'',sy.skin||'')}</div></div>`:''}
 <div class="card"><h3>Редкости</h3><div class="bars" style="margin:6px 0 0">${RAR.map((R,i)=>`<span>${R.n}</span><div class="pb" style="background:${R.c}33"><i style="width:${st.cls[i]/mx*100}%;background:${R.c}"></i></div><span class="tl" style="text-align:right">${st.cls[i]}</span>`).join('')}</div></div>`}
DRAW.pub=drawPub;
on({openPlayer,newTrade:()=>startTrade(PID,(PUB&&PUB.nick)||'Игрок')});
