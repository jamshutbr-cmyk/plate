import {api} from '../api.js';
import {CAR_CLS, CASES, FXE, RAR, dupRefund} from '../config.js';
import {CARS, carById, carsOfClass, caseOdds} from '../data/cars.js';
import {haptic, hapticDrop} from '../platform.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {beep, burst, count, dropSound, riser} from '../ui/fx.js';
import {banner} from '../ui/modal.js';
import {$, fmt} from '../util.js';

// Кейсы: за рубли открываем кейс, из него выпадает машина для гаража.
// Класс, машину и возврат за дубликат выбирает СЕРВЕР (api.openCase → open_case в cases.sql). Здесь только показ:
// лента с машинами замедляется и останавливается на уже известном результате, затем карточка с эффектами по классу.
const STEP=136,IW=128,N=46,T=38;   // шаг ленты, ширина карточки, длина ленты, индекс карточки с результатом
let busy=false,skip=false;

const crate=(c,w=120)=>`<svg viewBox="0 0 120 80" width="${w}"><ellipse cx="60" cy="74" rx="46" ry="5" fill="${c}" opacity=".28"/><rect x="14" y="28" width="92" height="44" rx="8" fill="#1d2236" stroke="${c}" stroke-width="3"/><rect x="54" y="16" width="12" height="56" fill="${c}" opacity=".45"/><rect x="10" y="16" width="100" height="18" rx="6" fill="${c}" opacity=".9"/><rect x="54" y="16" width="12" height="18" fill="#fff" opacity=".25"/><circle cx="60" cy="48" r="7" fill="#0c1020" stroke="#fff" stroke-opacity=".6" stroke-width="2"/><rect x="58.5" y="46" width="3" height="7" rx="1" fill="#fff" opacity=".8"/></svg>`;
const pct=x=>(Math.round(x*10)/10).toString().replace('.',',');

function oddsRows(c,od){
  return c.w.map((w,r)=>{
    if(!w)return '';
    const has=carsOfClass(r).length>0,col=RAR[r].c;
    return has?`<div class="cso-r"><i style="background:${col}"></i><span>${CAR_CLS[r]}</span><em><u style="width:${Math.max(2,od[r])}%;background:${col}"></u></em><b>${pct(od[r])}%</b></div>`
      :`<div class="cso-r off"><i style="background:${col}"></i><span>${CAR_CLS[r]}</span><em></em><b>скоро</b></div>`}).join('')}
function thumbs(c,od){
  const list=CARS.filter(x=>od[x.r]>0);
  return list.length?`<div class="cs-th">${list.map(x=>`<img class="${S.cars.includes(x.id)?'':'lk'}" style="--c:${RAR[x.r].c}" src="${x.img}" alt="${x.n}" title="${x.n}">`).join('')}</div>`:''}
const card=c=>{
  const od=caseOdds(c.w),can=S.bal>=c.p;
  return `<div class="card cs-card" style="--cc:${c.col}"><div class="cs-art">${crate(c.col,110)}</div><h3>${c.n}<span class="tl">${fmt(c.p)} ₽</span></h3><div class="tl" style="margin-bottom:10px">${c.d}</div>
   <div class="cs-od">${oddsRows(c,od)}</div>${thumbs(c,od)}
   <button class="big2${can?'':' alt'}" data-click="csOpen" data-arg="${c.id}">Открыть · ${fmt(c.p)} ₽</button></div>`};
export function drawCases(){
  const hid=CASES.some(c=>c.w.some((w,r)=>w>0&&!carsOfClass(r).length));
  $('casesC').innerHTML=`<div class="sub" style="margin:0 6px 4px"><span>Баланс</span><b style="color:var(--tx)">${fmt(S.bal)} ₽</b></div>
   <div class="sub" style="margin:0 6px 12px"><span>В гараже машин</span><b style="color:var(--tx)">${CARS.filter(x=>S.cars.includes(x.id)).length} из ${CARS.length}</b></div>
   ${CASES.map(card).join('')}
   <p class="tl" style="text-align:center">Шансы показаны как есть.${hid?' Класс, в котором пока нет машин, не выпадает: его шанс делят остальные классы.':''} Если машина уже есть, вы получаете ${CAR_CLS.map((n,r)=>n.toLowerCase()+' — '+fmt(dupRefund(r))+' ₽').join(', ')}.</p>`}

// ---------- Открытие ----------
async function openCase(id){
  if(busy)return;
  const c=CASES.find(x=>x.id==id);if(!c)return;
  if(S.bal<c.p){banner('Не хватает денег','Нужно '+fmt(c.p)+' ₽');haptic('rigid');return}
  busy=true;
  try{
    let r;
    try{r=await api.openCase(id)}
    catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');api.syncPlayer().then(()=>render(true)).catch(()=>{});return}   // ответ мог потеряться: сверяем кэш
    if(r.err){banner('Не хватает денег','Нужно '+fmt(r.need)+' ₽');render(true);return}
    const car=carById(r.car_id);
    if(!car){banner('Новая машина','Обновите игру, чтобы увидеть её');render(true);return}
    open(c);
    if(S.reel!==false)await rollTape(c,car);
    reveal(c,car,r);
  }finally{busy=false}}

function open(c){
  const o=$('csOv');o.className='cso on';o.style.setProperty('--rc',c.col);
  o.innerHTML=`<div class="cs-gl"></div><div class="cs-fl"></div><div class="cs-in" data-click="csSkip"><div class="cs-ti">${c.n}</div><div class="cs-w" id="csW"><div class="cs-t" id="csT"></div><i class="cs-m"></i></div><div class="tl cs-hs">Нажмите, чтобы пропустить</div></div>`}
// Что мелькает в ленте — только декор; результат уже выдал сервер и стоит на позиции T
function deco(od){
  const cl=od.map((x,r)=>x>0?r:-1).filter(r=>r>=0);let t=Math.random()*od.reduce((a,b)=>a+b,0),r=cl[cl.length-1];
  for(const k of cl){t-=od[k];if(t<0){r=k;break}}
  const l=carsOfClass(r);return l[Math.floor(Math.random()*l.length)]}
const item=x=>`<div class="cs-i" style="--c:${RAR[x.r].c}"><img src="${x.img}" alt=""><span>${x.n}</span></div>`;
function rollTape(c,car){
  return new Promise(done=>{
    const od=caseOdds(c.w),items=[];
    for(let i=0;i<N;i++){let x=i==T?car:deco(od);if(i!=T&&x===items[i-1])x=deco(od);items.push(x)}
    const tr=$('csT'),W=$('csW').clientWidth;tr.innerHTML=items.map(item).join('');
    const end=T*STEP+IW/2-W/2+(Math.random()-.5)*(IW-34),D=S.fx>=2?900:S.fx==1?3200:5200;
    if(car.r>=3){const dur=Math.min(car.r==4?1.8:1.3,D/1000);setTimeout(()=>riser(dur),Math.max(0,D-dur*1000))}   // нарастающий свист перед эпиком и легендаркой
    let last=-1,lt=0;skip=false;const t0=performance.now();
    (function f(t){
      const k=skip?1:Math.min(1,Math.max(0,(t-t0)/D)),pos=end*(1-Math.pow(1-k,4)),idx=Math.floor((pos+W/2)/STEP);
      tr.style.transform=`translateX(${-pos}px)`;
      if(idx!=last){last=idx;if(k<1&&t-lt>45){lt=t;beep(300+idx%6*25,.03,'square',.02);haptic('tick')}}
      if(k<1)requestAnimationFrame(f);
      else{tr.children[T].classList.add('win');setTimeout(done,450)}})(t0)})}

// ---------- Результат и эффекты по классу ----------
function lit(id,cls){const e=$(id);e.classList.remove(cls);void e.offsetWidth;e.classList.add(cls)}
function reveal(c,car,r){
  const R=RAR[car.r],o=$('csOv'),fe=S.equip.drop,E=fe&&FXE[fe],k=car.r,n=r.dup?'Уже есть · возврат <b id="csRf">0 ₽</b>':'Новая машина в гараже';
  document.documentElement.style.setProperty('--rc',R.c);o.style.setProperty('--rc',R.c);o.classList.add('res','r'+k);
  o.innerHTML=`<div class="cs-gl"></div><div class="cs-fl"></div><div class="cs-res"><div class="cs-rl" style="color:${R.c}">${CAR_CLS[k]}</div><img src="${car.img}" alt="${car.n}"><h2>${car.n}</h2><div class="cs-st${r.dup?' dup':''}">${n}</div>
   <div class="cs-b"><button class="big2" data-click="csAgain" data-arg="${c.id}">Ещё раз · ${fmt(c.p)} ₽</button><div class="cs-b2"><button class="btn" data-click="csGarage">В гараж</button><button class="btn" data-click="csClose">Закрыть</button></div></div></div>`;
  if(r.dup)count($('csRf'),r.refund);
  // звук и вибрация: хлам тихо, дальше сильнее (dropSound и hapticDrop уже масштабируются по классу)
  if(k==0){beep(196,.14,'sine',.03);haptic('light')}else{dropSound(k);if(k>=2)hapticDrop(k);else haptic('light')}
  if(r.dup)[988,1319].forEach((f,i)=>beep(f,.12,'triangle',.045,.55+i*.1));
  // свечение и вспышка: как в main.js show(); если #glow/#flash скрыты в теме, рисуем такие же внутри окна кейса
  const hid=id=>getComputedStyle($(id)).display=='none',g=$('glow'),fl=$('flash');
  g.classList.remove('on');void g.offsetWidth;g.classList.add('on');o.classList.add('hot');
  if(k>=3&&S.fx<2){
    fl.style.background=E?E.flash:k==4?'':R.c;if(hid('flash'))lit('csOv','boom');else lit('flash','on');
    }
  if(k==4&&S.fx<2){document.body.classList.remove('shake');void document.body.offsetWidth;document.body.classList.add('shake')}
  const bn=k>=2?k*14:E?8:0;   // купленный эффект выпадения (S.equip.drop): свои частицы; у хлама и обычных лёгкий всплеск
  if(bn)setTimeout(()=>burst(R.c,bn,fe),350)}
function close(){const o=$('csOv');o.className='cso';o.innerHTML='';$('glow').classList.remove('on')}

DRAW.cases=drawCases;
on({csOpen:a=>openCase(a),csAgain:a=>{if(!busy)openCase(a)},csSkip:()=>{skip=true},csClose:()=>{close();render(true)},csGarage:()=>{close();go('garage')}});
