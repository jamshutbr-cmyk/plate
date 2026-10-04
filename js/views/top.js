import {RAR} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {rpc} from '../server.js';
import {on} from '../ui/actions.js';
import {plateHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Таблица лидеров: рейтинг по самому дорогому номеру. Данные приходят с сервера и кэшируются на 30 секунд.
let TOP=null,AT=0,LOAD=false,ERR=false;
const MEDAL=['🥇','🥈','🥉'],MIN=10;   // сколько мест показывать минимум: пустые рисуются заглушками
const row=(r,me)=>`<div class="tr${me?' me':''}" data-click="openPlayer" data-arg="${r.id}"><span class="rk">${MEDAL[r.rk-1]||r.rk}</span><div class="tn"><b>${esc(r.nick||'Игрок')}</b><span class="tl">Уровень ${r.lvl} · номеров: ${fmt(r.total)}</span></div><b class="tpr">${fmt(r.best)} ₽</b></div>`;
const empty=n=>`<div class="tr emp"><span class="rk">${MEDAL[n-1]||n}</span><div class="tn"><b>Свободно</b></div></div>`;
async function load(){
 LOAD=true;ERR=false;
 try{TOP=await rpc('get_leaderboard')}catch(e){console.error(e);ERR=true}
 LOAD=false;AT=Date.now();render(true)}
export function drawTop(){
 if(!LOAD&&Date.now()-AT>30000)load();
 let h;
 if(!TOP)h=ERR?`<p class="tl" style="text-align:center">Не удалось загрузить рейтинг</p>`:`<p class="tl" style="text-align:center">Загрузка…</p>`;
 else{
  const me=TOP.me;
  h=TOP.top.length?'':`<p class="tl" style="text-align:center">Пока никого. Сгенерируйте номер!</p>`;
  h+=TOP.top.map(r=>row(r,r.me)).join('');
  for(let n=TOP.top.length+1;n<=MIN;n++)h+=empty(n);
  if(me&&me.rk>50)h+=`<div class="tsep">· · ·</div>`+row(me,true);
 }
 $('topC').innerHTML=h+`<button class="btn" style="width:100%;margin-top:10px" data-click="topRefresh">Обновить</button>`}
DRAW.top=drawTop;
on({topRefresh:()=>{AT=0;render(true)}});

// Профиль другого игрока (только просмотр): имя, уровень, статистика и самый дорогой номер. Баланс не показываем.
let PUB=null,PERR=false;
async function openPlayer(id){
 PUB=null;PERR=false;go('pub');
 try{PUB=await rpc('get_player_profile',{pid:id})}catch(e){console.error(e)}
 if(!PUB)PERR=true;
 render(true)}
export function drawPub(){
 if(!PUB){$('pubC').innerHTML=`<p class="tl" style="text-align:center">${PERR?'Не удалось загрузить профиль':'Загрузка…'}</p>`;return}
 const p=PUB,st=p.stats,nm=p.nick||'Игрок',need=p.lvl*1250,mx=Math.max(1,...st.cls),
  days=Math.max(1,Math.ceil((Date.now()-new Date(p.since))/864e5));
 $('pubC').innerHTML=`<div class="card"><div class="phd"><div class="pav">${esc([...nm][0].toUpperCase())}</div><div><b class="pn">${esc(nm)}</b><span class="tl">Уровень ${p.lvl} · в игре ${days} дн.</span></div></div>
 <div class="sub" style="font-size:16px;gap:14px;align-items:center"><div class="pb" style="flex:1"><i style="width:${Math.min(100,p.xp/need*100)}%"></i></div><span>${fmt(p.xp)} / ${fmt(need)}</span></div></div>
 <div class="st2"><div><b>${fmt(st.n)}</b><span>Выпало номеров</span></div><div><b>${fmt(st.best)} ₽</b><span>Рекорд цены</span></div><div><b>${fmt(p.count)}</b><span>Номеров сейчас</span></div><div><b>${fmt(p.value)} ₽</b><span>Общая стоимость</span></div></div>
 ${p.top?`<div class="card"><h3>Самый дорогой сейчас<span class="tl">${fmt(p.top.price)} ₽</span></h3><div class="tp">${plateHTML(p.top)}</div></div>`:''}
 <div class="card"><h3>Редкости</h3><div class="bars" style="margin:6px 0 0">${RAR.map((R,i)=>`<span>${R.n}</span><div class="pb" style="background:${R.c}33"><i style="width:${st.cls[i]/mx*100}%;background:${R.c}"></i></div><span class="tl" style="text-align:right">${st.cls[i]}</span>`).join('')}</div></div>`}
DRAW.pub=drawPub;
on({openPlayer});
