import {api} from '../api.js';
import {COST, RAR, SELL_PCT, TRIPLE, sellGain} from '../config.js';
import {fake, genCost} from '../engine.js';
import {DRAW, go, painters, render} from '../router.js';
import {S} from '../state.js';
import {haptic} from '../platform.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {plateHTML} from '../ui/plate.js';
import {$, fmt} from '../util.js';

// Тройная прокрутка: пасс на 24 ч (продаётся окнами), пакет из 1–3 номеров, решение по каждому: оставить / в сейф / продать.
// Номера пакета лежат на сервере (pending_rolls), пока игрок не решит; цены и лимиты проверяет сервер (resolve_rolls).
const D={};   // решения по id номера: keep | safe | sell (по умолчанию sell)
const dec=p=>D[p.id]||'sell';
const msk=t=>new Date(t).toLocaleString('ru-RU',{weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'})+' МСК';
export function left(ms){const m=Math.max(0,Math.floor(ms/60000)),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return (d?d+' д ':'')+h+' ч '+(m%60)+' м'}
const passOn=()=>S.pass>Date.now();
const winOn=()=>S.win&&Date.now()>=S.win.a&&Date.now()<S.win.b;
const costN=n=>COST*n+(genCost()-COST);

// Магазин: тонкая плашка со статусом (её тап открывает страницу тройной прокрутки) и сама страница.
// Нет таблиц (миграция не применена) — плашки нет, игра работает как раньше.
export function tripleBanner(on){
  if(!S.win&&!passOn())return '';
  const st=passOn()?'Активна · '+left(S.pass-Date.now()):winOn()?'Окно открыто':'Скоро';
  return `<div class="tban${on?' a':''}${winOn()&&!passOn()?' hot':''}" data-click="shopTab" data-arg="triple"><div><b>Тройная прокрутка</b><span>3 номера за один тап</span></div><em>${st}</em></div>`}
const FAN=[['А777АА',1],['О001ОО',3],['В555ТТ',2]].map(([m,c])=>({type:'civil',main:m,reg:'77',country:'RU',cls:c}));
export function tripleCard(){
  const row=(a,b)=>`<div class="sub"><span>${a}</span><b style="color:var(--tx)">${b}</b></div>`;
  const fan=`<div class="tfan">${FAN.map(p=>plateHTML(p,'tf')).join('')}</div>`;
  let info,btn;
  if(passOn()){
    info=row('Статус','Активна')+row('Действует до',msk(S.pass))+row('Осталось',left(S.pass-Date.now()))+row('Прокрут ×3',fmt(costN(3))+' ₽');
    btn=`<button class="big2" data-click="mGo">Крутить ×3</button>`}
  else if(winOn()){
    const no=S.usd<TRIPLE.usd;
    info=row('Пасс',TRIPLE.hours+' часа')+row('Цена',TRIPLE.usd+' $')+row('Окно закроется через',left(S.win.b-Date.now()))+row('Прокрут ×3',fmt(costN(3))+' ₽');
    btn=`<button class="big2${no?' alt':''}" data-click="mBuy">${no?'Не хватает $ · нужно '+TRIPLE.usd:'Купить · '+TRIPLE.usd+' $'}</button>`}
  else{
    info=row('Пасс',TRIPLE.hours+' часа')+row('Цена',TRIPLE.usd+' $')+row('Следующее окно',msk(S.win.a))+row('Прокрут ×3',fmt(costN(3))+' ₽');
    btn=`<button class="big2 alt" disabled>Окно закрыто</button>`}
  return `<div class="card tcard"><h3>Тройная прокрутка</h3>${fan}<p>Крутите по 3 номера за один тап, шансы обычные. Потом сами решаете по каждому номеру: оставить, в сейф или продать.</p>${info}<div style="height:14px"></div>${btn}</div>`}

// Кнопка рядом с чипом страны: с пассом показывает ×1/×2/×3 (тап переключает), при нерешённом пакете ведёт на его экран
function mxPaint(){
  const e=$('mx');if(!e)return;
  if(S.pend.length){e.style.display='';e.className='chip mxb a';e.dataset.click='go';e.dataset.arg='multi';e.textContent='Пакет · '+S.pend.length;return}
  if(!passOn()){e.style.display='none';return}
  e.style.display='';e.className='chip mxb'+(S.mul>1?' a':'');e.dataset.click='mMul';e.dataset.arg='';e.textContent='×'+S.mul}
painters.push(mxPaint);

export async function multiGen(){
  const n=S.mul;
  if(S.pend.length){go('multi');return}
  if(S.bal<costN(n)){banner('Не хватает денег','Нужно '+fmt(costN(n))+' ₽');return}
  const st=$('stage'),iv=setInterval(()=>{st.innerHTML=`<div class="tl">Генерация ×${n}…</div>`+Array.from({length:n},()=>plateHTML(fake(),'blur mini')).join('')},90);
  const r=await api.multiRoll(n).finally(()=>clearInterval(iv));
  st.innerHTML='';
  if(r.err){banner(({money:'Не хватает денег',pass:'Пасс закончился','no pass':'Пасс закончился',pending:'Есть нерешённый пакет'})[r.err]||'Ошибка',r.err=='pending'?'Сначала решите по номерам':'Попробуйте ещё раз');render();return}
  for(const k in D)delete D[k];go('multi')}

function drawMulti(){
  const P=S.pend;
  if(!P.length){$('multiC').innerHTML=`<div class="card"><p>Нет номеров, ждущих решения.</p><button class="big2" data-click="go" data-arg="main">На главную</button></div>`;return}
  const best=Math.max(...P.map(p=>p.price));
  const keep=P.filter(p=>dec(p)=='keep').length,safe=P.filter(p=>dec(p)=='safe').length,sold=P.filter(p=>dec(p)=='sell');
  const gain=sellGain(sold.reduce((a,p)=>a+p.price,0),S.perks.sell||0);
  const needC=Math.max(0,S.col.length+keep-S.capC),needS=Math.max(0,S.safe.length+safe-S.capS),bad=needC||needS;
  const opt=(p,a,n)=>`<button class="${dec(p)==a?'a '+a:''}" data-click="mDec" data-arg="${p.id}:${a}">${n}</button>`;
  const left24=P[0]&&P[0].ts?P[0].ts+TRIPLE.hours*3600000-Date.now():0;
  $('multiC').innerHTML=`<div class="card mnote"><p style="margin:0">Оставьте, уберите в сейф или продайте. Без выбора номер продаётся.${left24>0?' Решить можно ещё '+left(left24)+', потом игра решит сама.':''}</p></div>`
   +P.map(p=>{const R=RAR[p.cls];return `<div class="card mr${p.price==best&&P.length>1?' best':''}"><div class="mrt"><span style="color:${R.c};font-weight:800">${R.n}</span><b>${fmt(p.price)} ₽</b></div>${plateHTML(p)}<div class="chips seg">${opt(p,'keep','Оставить')}${opt(p,'safe','В сейф')}${opt(p,'sell','Продать')}</div></div>`}).join('')
   +`<div class="card msum"><div class="sub"><span>Продажа (${SELL_PCT+(S.perks.sell||0)}%)</span><b>${fmt(gain)} ₽</b></div><div class="sub"><span>Коллекция</span><b style="color:${needC?'#ff6b6b':'var(--tx)'}">${S.col.length+keep} / ${S.capC}</b></div><div class="sub"><span>Сейф</span><b style="color:${needS?'#ff6b6b':'var(--tx)'}">${S.safe.length+safe} / ${S.capS}</b></div>${bad?`<p class="mwarn">Не хватает места: уберите ${needC?needC+' из «Оставить»':''}${needC&&needS?' и ':''}${needS?needS+' из «В сейф»':''} или продайте.</p>`:''}</div>`
   +`<button class="big2${bad?' alt':''}" ${bad?'disabled':''} data-click="mOk">Подтвердить</button>`}
DRAW.multi=drawMulti;

on({
  mMul:()=>{S.mul=S.mul%TRIPLE.max+1;haptic('tick');render(true)},
  mGo:()=>{S.mul=3;go('main')},
  mDec:a=>{const [id,act]=String(a).split(':');D[id]=act;drawMulti()},
  mBuy:async()=>{
    if(S.usd<TRIPLE.usd){banner('Не хватает $','Нужно '+TRIPLE.usd+' $');return}
    const r=await api.buyPass();
    if(r.err){banner(({window:'Окно продаж закрыто',active:'Пасс уже активен',usd:'Не хватает $'})[r.err]||'Ошибка','Попробуйте ещё раз');return}
    S.mul=3;banner('Пасс куплен','Тройная прокрутка на '+TRIPLE.hours+' ч');render(true)},
  mOk:async()=>{
    const ds=S.pend.map(p=>({id:p.id,act:dec(p)})),r=await api.resolveRolls(ds);
    if(r&&r.err){banner(({full:'Нет места в коллекции',safe_full:'Нет места в сейфе'})[r.err]||'Ошибка','Освободите место или продайте номера');return}
    banner('Пакет закрыт','Оставлено '+(r.kept+r.safe)+' · продано '+r.sold+(r.gain?' · +'+fmt(r.gain)+' ₽':''));go('main')}
});

// При входе: свежий пакет ждёт игрока на своём экране, пакет старше 24 ч сервер решает сам
export async function checkPending(){
  if(S.pend.length&&S.pend[0].ts&&Date.now()-S.pend[0].ts>=TRIPLE.hours*3600000){
    const r=await api.autoResolve();
    if(r){banner('Пакет закрыт автоматически','Оставлено '+(r.kept+r.safe)+' · продано '+r.sold+(r.gain?' · +'+fmt(r.gain)+' ₽':''));render(true)}return}
  if(S.pend.length)go('multi')}
