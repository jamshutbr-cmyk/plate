import {api} from '../api.js';
import {CARPARTS, RAR, THREE_SRC, cpPm} from '../config.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {$, esc, fmt} from '../util.js';
import {garageCar} from './garage.js';

// Детали машины: вкладка экрана ивента «Полицейский беспредел» (evshop.js). Цифры, цены и права считает сервер (car_parts.sql, функции cp_*),
// здесь только показ и кнопки. Валюта одна: жетоны ивента. Детали на трассе, из кейса и из магазина попадают сюда же.
// Состояние ивента (жетоны, магазин, экипировка кузова) берём у evshop через bindParts: второй раз его не грузим.
let CP=null,SLOT='engine',BUSY=false,LOADING=false,LOADED=false,FAIL=false,HOST=null;
export const bindParts=h=>{HOST=h};
const EV=()=>HOST?HOST.st():null;
// Иконки слотов и жетона: один набор линейных SVG вместо эмодзи (цвет берётся из currentColor)
const IC={
  engine:'<path d="M6 9h11v10H6z"/><path d="M8.5 9V6h2v3M12.5 9V6h2v3M7 5.5h8M6 12H3.5v4H6M17 11.5h2.5V8H22v9h-2.5v-2H17M9 13.5h5M9 16h5"/>',
  tires:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/><path d="M12 3v6M12 15v6M3 12h6M15 12h6M5.6 5.6l4.2 4.2M14.2 14.2l4.2 4.2M18.4 5.6l-4.2 4.2M9.8 14.2l-4.2 4.2"/>',
  susp:'<path d="M12 2.5v3M12 18.5v3M8 5.5h8l-8 3.2h8l-8 3.2h8l-8 3.2h8"/>',
  brakes:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.2"/><circle cx="12" cy="6.6" r=".9"/><circle cx="12" cy="17.4" r=".9"/><circle cx="6.6" cy="12" r=".9"/><circle cx="17.4" cy="12" r=".9"/><path d="M17 3.8a9 9 0 0 1 3.2 3.2"/>',
  turbo:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="1.8"/><path d="M12 3c3.2 2.2 3.2 6 0 9M12 21c-3.2-2.2-3.2-6 0-9M3 12c2.2-3.2 6-3.2 9 0M21 12c-2.2 3.2-6 3.2-9 0"/>',
  car:'<path d="M3.5 15l1.8-5.5h13.4L20.5 15v3.5h-3V17h-11v1.5h-3zM3.5 15h17M7.5 12.5h9"/>',
  off:'<path d="M3 3l18 18M8.5 16.1a5 5 0 017 0M5 12.6a10 10 0 015-2.7M19 12.6a10 10 0 00-4-2.5M12 20h.01"/>',
  body:'<path d="M12 3l8 3v6c0 4.8-3.4 7.9-8 9-4.6-1.1-8-4.2-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>'};
const svg=(k,c)=>`<svg class="${c||'pt-ic'}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${IC[k]||''}</svg>`;
const SL=CARPARTS.slots,ERR={season:'Сейчас нет активного сезона',tokens:'Не хватает жетонов',owned:'Эта деталь вам не принадлежит',max:'Деталь уже прокачана до максимума',
  car:'Этой машины нет в гараже',item:'Деталь не найдена',time:'Деталь пока недоступна',limit:'Лимит на сезон исчерпан'};
const pct=pm=>(pm?'+':'')+(pm/10).toFixed(1).replace('.',',')+'%';
// Показ «сколько даст при покупке» считается той же формулой, что на сервере (cpPm из config.js, сверяет tests/carparts.test.mjs)
const dlt=pm=>(pm>0?'+':pm<0?'−':'±')+(Math.abs(pm)/10).toFixed(1).replace('.',',')+'%';
const rc=r=>(RAR[r]||RAR[0]).c;
// Жетон ивента: та же монета, что на экране ивента (символ ev-tok из evshop.js), нарисована целиком, потому что тот спрайт живёт только внутри #evC
const tok=()=>'<svg class="pt-tk" viewBox="0 0 24 24" aria-hidden="true"><defs><clipPath id="pt-tokc"><circle cx="12" cy="12" r="10"/></clipPath></defs><circle cx="12" cy="12" r="10.5" fill="#f5b400"/><g clip-path="url(#pt-tokc)" stroke="#15161b" stroke-width="2.6"><path d="M-2 14L14 -2M2 26L26 2M10 28L28 10"/></g><circle cx="12" cy="12" r="10.5" fill="none" stroke="#15161b" stroke-width="1.5"/><circle cx="12" cy="12" r="5.2" fill="#f5b400" stroke="#15161b" stroke-width="1.5"/></svg>';
const slotOf=k=>SL.find(s=>s.k==k)||SL[0];
const car=()=>{const g=garageCar();return g&&g.car||null};
const eqOf=cid=>(CP&&CP.eq&&CP.eq[cid])||{};
const partById=id=>(CP&&CP.parts||[]).find(p=>p.id==id);
const tokens=()=>{const e=EV();return e&&e.wallet?e.wallet.tokens:0};
const dots=l=>'●'.repeat(l)+'○'.repeat(CARPARTS.maxLvl-l);

async function load(){
  if(LOADING)return;LOADING=true;FAIL=false;
  try{CP=await api.cpState();LOADED=true}
  catch(e){console.error(e);FAIL=true}
  finally{LOADING=false}
  HOST&&HOST.paint()}
export function partsReset(){CP=null;LOADED=false;FAIL=false}

const tier=n=>{const m=/«(.+)»/.exec(n||'');return m?m[1]:(n||'')};
const pips=(l,r)=>`<span class="pt-pips" style="--rl:${rc(r)}" aria-label="Уровень ${l} из ${CARPARTS.maxLvl}">${Array.from({length:CARPARTS.maxLvl},(_,i)=>`<i${i<l?' class="f"':''}></i>`).join('')}</span>`;
const tile=(slot,r)=>`<span class="pt-tile" style="--rl:${rc(r)}">${svg(slot,'pt-ic big')}</span>`;

// Бонусы по машине: сумма установленных деталей (считает сервер), по шести характеристикам; полоса показывает долю от потолка
function fxRow(cid){
  const e=eqOf(cid);
  return `<div class="pt-fx">${SL.map(s=>{const p=partById(e[s.k]),pm=p?p.pm:0,w=Math.min(100,Math.round(pm/CARPARTS.cap*100));
    return `<div class="pt-st${pm?' on':''}"><div class="pt-sr"><span>${CARPARTS.stats[s.st]}</span><b>${pm?pct(pm):'—'}</b></div><div class="pt-bar"><i style="width:${w}%;${p?'--rl:'+rc(p.r):''}"></i></div></div>`}).join('')}</div>`}

function slotRow(cid){
  const e=eqOf(cid);
  return `<div class="pt-slots" role="tablist" aria-label="Слоты деталей">${SL.map(s=>{const p=partById(e[s.k]);
    return `<button type="button" role="tab" aria-selected="${s.k==SLOT}" class="${s.k==SLOT?'a':''}${p?' f':''}" style="${p?'--rl:'+rc(p.r):''}" data-click="ptSlot" data-arg="${s.k}"><i>${svg(s.k)}</i><span>${s.n}</span><em>${p?'ур. '+p.lvl:'пусто'}</em></button>`}).join('')}</div>`}

function ownedCard(p,cid){
  const e=eqOf(cid),cur=partById(e[p.slot]),on=cur&&cur.id==p.id,s=slotOf(p.slot),st=CARPARTS.stats[s.st];
  let cmp='';
  if(!on){
    if(cur){const d=p.pm-cur.pm;cmp=`<span class="pt-chip ${d>0?'up':d<0?'dn':''}">${dlt(d)} к «${st}» относительно «${esc(tier(cur.n))}»</span>`}
    else cmp=`<span class="pt-chip up">Даст ${pct(p.pm)} к «${st}»</span>`}
  const up=p.cost==null?'<span class="pt-max">Максимальный уровень</span>':`<button type="button" class="pt-b up" data-click="ptUp" data-arg="${esc(p.id)}"${tokens()<p.cost?' data-short="1"':''}>Улучшить<span class="pt-pr">${tok()}${fmt(p.cost)}</span></button>`;
  return `<article class="pt-it${on?' on':''}" style="--rl:${rc(p.r)}">
    <div class="pt-row">${tile(p.slot,p.r)}
      <div class="pt-main"><div class="pt-ih"><strong>${esc(tier(p.n))}</strong><em>${CARPARTS.rarN[p.r]||''}</em></div>${pips(p.lvl,p.r)}</div>
      <div class="pt-val"><b>${pct(p.pm)}</b>${p.next!=null?`<small>→ ${pct(p.next)}</small>`:'<small>максимум</small>'}</div></div>
    ${on?'<span class="pt-chip on">✓ Установлено на машину</span>':cmp}
    <div class="pt-ac">${on?`<button type="button" class="pt-b ghost" data-click="ptOff" data-arg="${p.slot}">Снять</button>`:`<button type="button" class="pt-b" data-click="ptOn" data-arg="${esc(p.id)}">Поставить</button>`}${up}</div></article>`}

function shopCard(i){
  const short=tokens()<i.p;
  return `<article class="pt-it shop" style="--rl:${rc(i.r)}">
    <div class="pt-row">${tile(i.pl.slot,i.r)}
      <div class="pt-main"><div class="pt-ih"><strong>${esc(tier(i.n))}</strong><em>${CARPARTS.rarN[i.r]||''}</em></div>
        <small class="pt-sub">${pct(cpPm(i.r,1))} → ${pct(cpPm(i.r,CARPARTS.maxLvl))} при полной прокачке</small></div>
      <button type="button" class="pt-buy" data-click="ptBuy" data-arg="${esc(i.id)}"${short?' data-short="1"':''}>${tok()}${fmt(i.p)}</button></div>
    ${short?`<span class="pt-need">Не хватает ${fmt(i.p-tokens())}</span>`:''}</article>`}

// В заездах ивента едет отдельная 3D-машина (не из гаража), у неё своё имя. Если надет скин кузова из магазина, его название идёт мелкой строкой.
const CAR_NAME='Дорожный гонщик';
function skinName(){
  const e=EV(),id=e&&e.wallet&&e.wallet.equip&&e.wallet.equip.car,it=id&&((e.items||[]).find(i=>i.id==id));
  return it?it.n:''}
export const partsTab=()=>`<div class="pt-wrap">${inner()}</div>`;
function inner(){
  const c=car(),E=EV();
  if(!c)return `<div class="pt-state"><span>${svg('car','pt-ic xl')}</span><h3>Нужна машина</h3><p>Детали ставятся на машину из гаража. Откройте кейс, и первая машина появится.</p><button class="pt-b" data-click="go" data-arg="cases">К кейсам</button></div>`;
  if(!LOADED)return FAIL?`<div class="pt-state"><span>${svg('off','pt-ic xl')}</span><h3>Нет связи</h3><p>Не удалось загрузить детали.</p><button class="pt-b" data-click="ptRetry">Повторить</button></div>`:'<div class="pt-load">Загрузка…</div>';
  const s=slotOf(SLOT),mine=(CP.parts||[]).filter(p=>p.slot==SLOT),own=new Set((CP.parts||[]).map(p=>p.id));
  const shop=((E&&E.items)||[]).filter(i=>i.kind=='part'&&i.shop&&i.pl&&i.pl.slot==SLOT&&!own.has(i.id)&&!i.own).sort((a,b)=>a.r-b.r);
  const k=CP.caps||{},run=k.run||CARPARTS.run,day=k.day||CARPARTS.day,today=k.today||0;
  return `<section class="pt-hero"><div class="pt-3d ld" id="ptShow"></div>
      <div class="pt-hd"><div class="pt-car"><strong>${CAR_NAME}</strong><small>${esc(skinName()||'Машина ивента')}</small></div></div>
      <span class="pt-eq">Установлено ${SL.filter(x=>eqOf(c.id)[x.k]).length} из ${SL.length}</span><span class="pt-hint">Крутите машину</span></section>
    <div class="pt-h"><span>Характеристики</span><small>потолок ${pct(CARPARTS.cap)}</small></div>
    ${fxRow(c.id)}
    <div class="pt-h"><span>Слоты</span></div>
    ${slotRow(c.id)}
    <div class="pt-h big"><span class="pt-hs">${svg(s.k,'pt-ic sm')}${s.n}</span><small>${CARPARTS.stats[s.st]} · ${mine.length?'у вас '+mine.length:'нет деталей'}</small></div>
    ${mine.length?mine.map(p=>ownedCard(p,c.id)).join(''):`<div class="pt-empty"><b>Здесь пока пусто</b><span>Деталь можно купить ниже, выбить из кейса ивента или подобрать на трассе.</span></div>`}
    ${shop.length?`<div class="pt-h"><span>Магазин деталей</span><small>${shop.length}</small></div>${shop.map(shopCard).join('')}`:''}
    <div class="pt-info">
      <div><b>${run}</b><span>деталей за заезд</span></div>
      <div><b>${today}/${day}</b><span>за сутки</span></div>
      <div><b>35%</b><span>возврат за дубликат</span></div></div>`}

// Вызывается после каждого paint() экрана ивента: на вкладке «Детали» догружаем данные и показываем 3D, на других вкладках освобождаем WebGL
export function partsSync(active){
  if(!active){killShow();return}
  if(!LOADED&&!LOADING&&!FAIL)load();
  syncShow()}

// 3D-машина из самой игры (js/vendor/roadworks.js, режим showroom): та же, что в магазине ивента. Если WebGL не загрузился, остаётся плоская картинка гаража
let SHOW=null,SHOW_LOAD=null;
const loadScript=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=()=>ok();s.onerror=()=>{s.remove();no(new Error(src))};document.head.appendChild(s)});
function loadRW(){
  return SHOW_LOAD||(SHOW_LOAD=(async()=>{
    if(!window.THREE)for(const u of THREE_SRC){try{await loadScript(u);if(window.THREE)break}catch(e){console.warn('three.js:',e.message)}}
    if(!window.THREE)throw new Error('three');
    if(!window.RoadWorks)await loadScript('js/vendor/roadworks.js');
    if(!window.RoadWorks)throw new Error('roadworks')})().catch(e=>{SHOW_LOAD=null;throw e}))}
function killShow(){if(SHOW){try{SHOW.g.destroy()}catch(e){}SHOW=null}}
function flat(ph){const c=car();ph.classList.remove('ld');if(c)ph.innerHTML=`<img class="pt-flat" src="${c.img}" alt="${esc(c.n)}">`}
async function syncShow(){
  const ph=$('ptShow');
  if(!ph){killShow();return}
  const g0=garageCar(),E=EV(),sk=(E&&E.wallet&&E.wallet.equip&&E.wallet.equip.car)||'';
  if(SHOW){if(SHOW.el.parentNode!==ph)ph.appendChild(SHOW.el);ph.classList.remove('ld');if(SHOW.sk!==sk){SHOW.g.setSkin(sk);SHOW.sk=sk}return}
  try{await loadRW()}catch(x){const q=$('ptShow');if(q)flat(q);return}
  const q=$('ptShow');if(!q||SHOW)return;
  const el=document.createElement('div');el.className='pt-3d-c';q.appendChild(el);
  const pl=g0&&g0.plate;
  try{
    const g=window.RoadWorks.mount(el,{showroom:true,plate:pl?pl.main+' '+pl.reg:'А777АА 77',skin:sk,trail:'',frame:''});
    SHOW={g,el,sk};q.classList.remove('ld')
  }catch(x){console.error(x);el.remove();flat(q)}}

async function act(fn){
  if(BUSY)return;BUSY=true;
  try{const r=await fn();if(r&&r.err)banner('Не вышло',r.err=='tokens'?`Не хватает жетонов, нужно ${fmt(r.need||0)}`:(ERR[r.err]||'Ошибка'));
    LOADING=false;await Promise.all([HOST?HOST.reload():0,load()])}
  catch(e){console.error(e);banner('Нет связи','Повторите позже')}
  finally{BUSY=false;HOST&&HOST.paint()}}

on({
  ptRetry:()=>{LOADED=false;FAIL=false;load();HOST&&HOST.paint()},
  ptSlot:a=>{SLOT=a;HOST&&HOST.paint()},
  ptOn:a=>{const c=car(),p=partById(a);if(c&&p)act(()=>api.cpEquip(c.id,p.slot,a))},
  ptOff:a=>{const c=car();if(c)act(()=>api.cpEquip(c.id,a,''))},
  ptUp:a=>act(()=>api.cpUpgrade(a)),
  ptBuy:a=>act(()=>api.evBuy(a))});
