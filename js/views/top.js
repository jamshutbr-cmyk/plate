import {RAR} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {rpc} from '../server.js';
import {on} from '../ui/actions.js';
import {S} from '../state.js';
import {nickCls, plateHTML, titleHTML} from '../ui/plate.js';
import {ctagHTML, plate} from './clans.js';
import {styleCls} from './clanext.js';
import {pubShowcase} from './showcase.js';
import {hwMuseumCard} from './hw.js';
import {startTrade} from './trade.js';
import {$, esc, fmt} from '../util.js';

// Таблица лидеров, три вида (выбор в выпадающем списке): по самому дорогому номеру ('best'), по монетам ('coins') и по числу перерождений ('rebirths').
// Данные приходят с сервера (get_leaderboard) и кэшируются на 30 секунд отдельно для каждого вида.
const KINDS=[['best','🏆','Дорогой номер'],['coins','💰','Монеты'],['rebirths','♻️','Перерождения'],['clans','🛡️','Кланы: сезон'],['clanlvl','🏰','Кланы: уровень']];
const CLK=k=>k=='clans'||k=='clanlvl';   // виды рейтинга кланов: данные из clan_leaderboard, строки другие
let KIND='best',OPEN=false,TOPS={},ATS={},LOAD=false,ERR=false;   // вид, ответы сервера и время загрузки по видам
let CT={};   // теги кланов игроков {id:{tag,lvl,medal,fr,fx}} (clan_tags): lvl красит тег как плашку клана, fr и fx рамка и эффект
let STY={};   // титулы и рамки игроков {id:{title,skin}}: отдельный запрос get_styles, чтобы не трогать get_leaderboard
const titleOf=r=>r.me?S.equip.title:(STY[r.id]||{}).title;
const nickOf=r=>r.me?S.equip.nick:(STY[r.id]||{}).nick;
async function loadStyles(ids){ids=ids.filter(Boolean);if(!ids.length)return;try{Object.assign(STY,await rpc('get_styles',{ids})||{})}catch(e){console.warn('styles',e)}
 try{const t=await rpc('clan_tags',{ids})||{};for(const i of ids){delete CT[i];if(t[i])CT[i]=t[i]}}catch(e){console.warn('clan tags',e)}}
const MEDAL=['🥇','🥈','🥉'],MIN=10;   // сколько мест показывать минимум: пустые рисуются заглушками
const row=(r,me)=>`<div class="tr${me?' me':''}" data-click="openPlayer" data-arg="${r.id}"><span class="rk">${MEDAL[r.rk-1]||r.rk}</span><div class="tn"><div class="tnr">${ctagHTML(CT[r.id])}<b class="${nickCls(nickOf(r)).trim()}">${esc(r.nick||'Игрок')}</b>${titleHTML(titleOf(r))}</div><div class="tsb"><span class="tl">${KIND!='rebirths'&&r.rb?`<span class="rbb" title="Перерождений: ${r.rb}">♻ ${r.rb}</span>`:''}Ур. ${r.lvl}</span><b class="tpr">${KIND=='rebirths'?'♻ '+fmt(r.val):fmt(r.val)+' ₽'}</b></div></div></div>`;
const clanRow=r=>`<div class="tr cl${r.mine?' me':''}"><span class="rk">${MEDAL[r.rk-1]||r.rk}</span><div class="tn"><div class="tnr">${plate(r.tag,r.lvl,'cl-md-p'+styleCls(r.fr,r.fx))}${r.medal?`<span>${MEDAL[r.medal-1]}</span>`:''}<b>${esc(r.name)}</b></div><div class="tsb"><span class="tl">${r.n} из ${r.cap} мест</span><b class="cl-ps">${KIND=='clans'?fmt(r.pts)+' очк.':r.lvl+' ур.'}</b></div></div></div>`;
const empty=n=>`<div class="tr emp"><span class="rk">${MEDAL[n-1]||n}</span><div class="tn"><b>Свободно</b></div></div>`;
async function load(){

 const k=KIND;LOAD=true;ERR=false;
 try{let d;
  if(CLK(k)){d=await rpc('clan_leaderboard',{p_kind:k=='clans'?'season':'level'});try{const ids=(d.top||[]).map(r=>r.id),m=ids.length?await rpc('clan_styles',{ids})||{}:{};for(const r of d.top||[])Object.assign(r,m[r.id]||{})}catch(e){console.warn('clan styles',e)}TOPS[k]=d;LOAD=false;ATS[k]=Date.now();render(true);return}
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
 const cur=KINDS.find(x=>x[0]==KIND);
 let h=`<div class="tt-dd${OPEN?' open':''}"><button class="tt-cur" data-click="topMenu" aria-haspopup="listbox" aria-expanded="${OPEN}"><i>${cur[1]}</i><span>${cur[2]}</span><em>▾</em></button>${OPEN?`<div class="tt-menu" role="listbox">${KINDS.map(([k,i,n])=>`<button role="option" aria-selected="${KIND==k}" class="${KIND==k?'a':''}" data-click="topKind" data-arg="${k}"><i>${i}</i>${n}</button>`).join('')}</div>`:''}</div>`;
 if(!TOP)h+=ERR?`<p class="tl" style="text-align:center">Не удалось загрузить рейтинг</p>`:`<p class="tl" style="text-align:center">Загрузка…</p>`;
 else{
  const me=TOP.me;
  h+=TOP.top.length?'':`<p class="tl" style="text-align:center">${KIND=='rebirths'?'Пока никто не переродился.':CLK(KIND)?(KIND=='clans'?'В этом сезоне ещё никто не вносил в казну.':'Кланов пока нет.'):'Пока никого. Сгенерируйте номер!'}</p>`;
  const cl=CLK(KIND),rw=cl?r=>clanRow(r):r=>row(r,r.me);
  if(KIND=='clans'&&TOP.season_end)h+=`<p class="cl-season">Очки: 1 за каждый внесённый в казну миллион. Сезон закончится ${new Date(+TOP.season_end).toLocaleString('ru-RU',{weekday:'short',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</p>`;
  h+=TOP.top.map(rw).join('');
  for(let n=TOP.top.length+1;n<=MIN;n++)h+=empty(n);
  if(me&&me.rk>(cl?30:50))h+=`<div class="tsep">· · ·</div>`+rw(me);
 }
 $('topC').innerHTML=h+`<button class="btn" style="width:100%;margin-top:10px" data-click="topRefresh">Обновить</button>`}
DRAW.top=drawTop;
on({topRefresh:()=>{ATS[KIND]=0;render(true)},topMenu:()=>{OPEN=!OPEN;render(true)},topKind:k=>{OPEN=false;if(k!=KIND)KIND=k;render(true)}});

// Профиль другого игрока (только просмотр): имя, уровень, статистика и самый дорогой номер. Баланс не показываем.
let PUB=null,PERR=false,PID=null,PSC=[],PHW=[];
async function openPlayer(id){
 PID=id;PUB=null;PERR=false;PSC=[];PHW=[];go('pub');
 try{PUB=await rpc('get_player_profile',{pid:id});if(!STY[id])await loadStyles([id])}catch(e){console.error(e)}
 try{PSC=await rpc('get_showcase',{pid:id})||[]}catch(e){console.warn('showcase',e)}
 try{PHW=await rpc('hw_museum_public',{pid:id})||[]}catch(e){console.warn('hw museum',e)}
 if(!PUB)PERR=true;
 render(true)}
export function drawPub(){
 if(!PUB){$('pubC').innerHTML=`<p class="tl" style="text-align:center">${PERR?'Не удалось загрузить профиль':'Загрузка…'}</p>`;return}
 const p=PUB,sy=p.me?S.equip:(STY[PID]||{}),st=p.stats,nm=p.nick||'Игрок',need=p.lvl*1250,mx=Math.max(1,...st.cls),
  days=Math.max(1,Math.ceil((Date.now()-new Date(p.since))/864e5));
 $('pubC').innerHTML=`<div class="card"><div class="phd"><div class="pav">${esc([...nm][0].toUpperCase())}</div><div>${ctagHTML(CT[PID])}<b class="pn${nickCls(sy.nick)}">${esc(nm)}</b>${titleHTML(sy.title)}<span class="tl">Уровень ${p.lvl} · в игре ${days} дн.</span></div></div>
 <div class="sub" style="font-size:16px;gap:14px;align-items:center"><div class="pb" style="flex:1"><i style="width:${Math.min(100,p.xp/need*100)}%"></i></div><span>${fmt(p.xp)} / ${fmt(need)}</span></div></div>
 ${p.me?'':`<button class="btn" style="width:100%;margin-bottom:10px" data-click="newTrade">Предложить обмен</button>`}
 <div class="st2"><div><b>${fmt(st.n)}</b><span>Выпало номеров</span></div><div><b>${fmt(st.best)} ₽</b><span>Рекорд цены</span></div><div><b>${fmt(p.count)}</b><span>Номеров сейчас</span></div><div><b>${fmt(p.value)} ₽</b><span>Общая стоимость</span></div></div>
 ${p.me?'':pubShowcase(PSC,sy.skin)}
 ${hwMuseumCard(PHW)}
 ${p.top?`<div class="card"><h3>Самый дорогой сейчас<span class="tl">${fmt(p.top.price)} ₽</span></h3><div class="tp">${plateHTML(p.top,'',sy.skin||'')}</div></div>`:''}
 <div class="card"><h3>Редкости</h3><div class="bars" style="margin:6px 0 0">${RAR.map((R,i)=>`<span>${R.n}</span><div class="pb" style="background:${R.c}33"><i style="width:${(st.cls[i]||0)/mx*100}%;background:${R.c}"></i></div><span class="tl" style="text-align:right">${st.cls[i]||0}</span>`).join('')}</div></div>`}
DRAW.pub=drawPub;
on({openPlayer,newTrade:()=>startTrade(PID,(PUB&&PUB.nick)||'Игрок')});
