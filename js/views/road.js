import {api} from '../api.js';
import {THREE_SRC} from '../config.js';
import {TG} from '../platform.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {$, esc, fmt} from '../util.js';
import {garageCar} from './garage.js';

// Дорожные работы 3D: готовая игра на three.js (js/vendor/roadworks.js). Она сама рисует меню, HUD и считает очки.
// Здесь обвязка: загрузка three.js, номер игрока на машине, серверная награда за заезд (road.sql), рекорд, топ суток, кнопка «назад».
// Игра в ивенте «Полицейский беспредел»: заезд открывается в onStart (ev_start), закрывается в onGameOver (ev_finish), награда в ЖЕТОНАХ, клиент присылает только очки, дистанцию и статистику.
// Режим (road | chase) выбирает экран ивента через setRoadMode; надетые косметики (кузов, след, рамка номера) читаются с сервера при каждом запуске.
let G=null,OPENING=false,RUNP=null,BEST=0,SEQ=0,MODE='road';
export const setRoadMode=m=>{MODE=m=='chase'?'chase':'road'};
const loadScript=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=()=>ok();s.onerror=()=>{s.remove();no(new Error(src))};document.head.appendChild(s)});
async function ensure(){
  if(window.RoadWorks)return;
  if(!window.THREE)for(const u of THREE_SRC){try{await loadScript(u);if(window.THREE)break}catch(e){console.warn('three.js:',e.message)}}
  if(!window.THREE)throw new Error('three.js');
  await loadScript('js/vendor/roadworks.js')}

// Номер на машине: выбранный в гараже, иначе самый дорогой из коллекции. Без региона (редкие типы) игра возьмёт случайный.
function myPlate(){
  const g=garageCar(),p=g&&g.plate||S.col.concat(S.safe).sort((a,b)=>b.price-a.price)[0];
  return p&&p.main&&p.reg?p.main+' '+p.reg:null}

const carId=()=>{const g=garageCar();return g&&g.car?g.car.id:null};
const bar=v=>{$('roadBar').style.display=v?'flex':'none'};
function result(html){const e=$('roadRes');e.innerHTML=html;e.classList.toggle('on',!!html)}
function failMsg(){result('<b>Нет связи с сервером</b><span>Награда за этот заезд не начислена</span>')}

// Деталь с трассы: выдаёт сервер по результату заезда (ev_finish), здесь только показ
const partsLine=res=>{const l=(res.parts||[]).map(x=>x.dup?`${esc(x.n)} (дубль, +${fmt(x.refund)} 🚧)`:esc(x.n));return l.length?`<span>🔧 Деталь: ${l.join(', ')}</span>`:res.pk_plan>0&&res.pk_left===0?'<span>🔧 Суточный лимит деталей достигнут</span>':''};
async function onGameOver(r){
  bar(true);
  const my=++SEQ,p=RUNP,mode=MODE;
  let run=null;try{run=p&&await p}catch(e){}
  if(!run){failMsg();return}
  let res;
  try{res=await api.evFinish(run,r.score,r.distance,r.stats)}catch(e){console.error(e);failMsg();return}
  if(my!==SEQ)return;
  if(res.err){result(res.err=='cheat'?'<b>Заезд не засчитан</b><span>Показатели выше возможных</span>':res.err=='season'?'<b>Сезон закончился</b><span>Жетоны за этот заезд не начислены</span>':r.score>=10?'<b>Жетонов нет</b><span>Заезд слишком короткий</span>':'');return}
  const ex=mode=='chase'?` (дистанция +${fmt(res.bonus)})`:'';
  result(`<b>+${fmt(res.tokens)} 🚧${res.boosted?' ×2':''}</b><span>${res.capped?'Суточный лимит жетонов достигнут':'Сегодня '+fmt(res.today)+' из '+fmt(res.cap)}${ex} · очки карты +${fmt(res.pts_gain)} · уровень ${res.level}</span>${partsLine(res)}`);
  render(true)}

async function open(){
  if(G||OPENING)return;
  OPENING=true;const box=$('roadC');
  box.innerHTML='<div class="rd-load">Загрузка…</div>';bar(true);result('');
  try{
    await ensure();
    let st=null;try{st=await api.evState()}catch(e){console.warn('ev_state',e)}
    if(!st||!st.season||!st.season.active){box.innerHTML='<div class="rd-load">Сезон ивента закончился или ещё не начался.<button class="btn" data-click="go" data-arg="evshop">В ивент</button></div>';return}
    BEST=MODE=='chase'?st.best.chase:st.best.road;const eq=st.wallet.equip;
    if(!$('v-road').classList.contains('on'))return;               // успели уйти с экрана, пока грузилось
    box.innerHTML='';
    G=window.RoadWorks.mount(box,{plate:myPlate(),best:BEST,mode:MODE,skin:eq.car,trail:eq.trail,frame:eq.frame,
      onStart:()=>{bar(false);result('');RUNP=api.evStart(MODE,carId()).then(r=>{if(r&&r.run&&G&&G.setRun){try{G.setRun({fx:r.fx||null,pk:r.pk|0})}catch(e){console.error(e)}}return r&&r.run||null}).catch(e=>{console.error(e);return null})},
      onGameOver});
    if(TG){try{TG.disableVerticalSwipes&&TG.disableVerticalSwipes();TG.BackButton&&TG.BackButton.show()}catch(e){}}}
  catch(e){console.error(e);box.innerHTML='<div class="rd-load">Не удалось загрузить 3D-игру.<br>Проверьте интернет и попробуйте ещё раз.<button class="btn" data-click="roadRetry">Повторить</button></div>'}
  finally{OPENING=false}}
function close(){
  if(G){try{G.destroy()}catch(e){console.error(e)}G=null;SEQ++;RUNP=null}
  $('roadC').innerHTML='';result('');
  if(TG){try{TG.enableVerticalSwipes&&TG.enableVerticalSwipes();TG.BackButton&&TG.BackButton.hide()}catch(e){}}}

DRAW.road=open;
// Уход с экрана (через меню, кнопку Telegram или любой go): игру нужно остановить и освободить WebGL
new MutationObserver(()=>{if(!$('v-road').classList.contains('on'))close()}).observe($('v-road'),{attributes:true,attributeFilter:['class']});
if(TG&&TG.BackButton)try{TG.BackButton.onClick(()=>{if($('v-road').classList.contains('on'))go('menu')})}catch(e){}

on({roadTop:()=>go('evshop'),roadRetry:()=>open()});
