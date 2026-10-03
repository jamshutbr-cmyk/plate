import {DRAW, render} from '../router.js';
import {rpc} from '../server.js';
import {on} from '../ui/actions.js';
import {$, esc, fmt} from '../util.js';

// Таблица лидеров: рейтинг по самому дорогому номеру. Данные приходят с сервера и кэшируются на 30 секунд.
let TOP=null,AT=0,LOAD=false,ERR=false;
const MEDAL=['🥇','🥈','🥉'];
const row=(r,me)=>`<div class="tr${me?' me':''}"><span class="rk">${MEDAL[r.rk-1]||r.rk}</span><div class="tn"><b>${esc(r.nick||'Игрок')}</b><span class="tl">Уровень ${r.lvl} · номеров: ${fmt(r.total)}</span></div><b class="tpr">${fmt(r.best)} ₽</b></div>`;
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
  h=TOP.top.length?TOP.top.map(r=>row(r,r.me)).join(''):`<p class="tl" style="text-align:center">Пока никого. Сгенерируйте номер!</p>`;
  if(me&&me.rk>50)h+=`<div class="tsep">· · ·</div>`+row(me,true);
 }
 $('topC').innerHTML=h+`<button class="btn" style="width:100%;margin-top:10px" data-click="topRefresh">Обновить</button>`}
DRAW.top=drawTop;
on({topRefresh:()=>{AT=0;render(true)}});
