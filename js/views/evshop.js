import {api} from '../api.js';
import {EVENT, FXE, RAR, THREE_SRC, itemOf} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, go} from '../router.js';
import {rpc} from '../server.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {plateHTML, titleHTML} from '../ui/plate.js';
import {S} from '../state.js';
import {$, esc, fmt} from '../util.js';
import {bindParts, partsReset, partsSync, partsTab} from './parts.js';
import {setRoadMode} from './road.js';

// Экран ивента «Полицейский беспредел»: игра, магазин за жетоны, карта сезона, задания, кейс, лидерборд.
// Каталог, цены, лимиты, шансы и прогресс приходят одним ответом ev_state; покупки и награды делают ev_* функции (event.sql), клиент только рисует.
// Вёрстка: css/event.css (блок «Экран ивента»). Все классы с префиксом ev-, чтобы не пересекаться с остальной игрой.
let ST=null,TAB='play',SHOP_KIND='title',TOP_KIND='pts',TOP=null,STY={},TRY={},BUSY=false,LOADING=false,LAST=null;
const ERR={season:'Сейчас нет активного сезона',tokens:'Не хватает жетонов',owned:'Уже куплено',limit:'Лимит на сезон исчерпан',day_limit:'Лимит на сегодня исчерпан',time:'Сейчас недоступно',
  full:'Нет места под номер: освободите коллекцию или сейф',sold_out:'Блат-номера закончились: все выпущены на весь проект',item:'Товар недоступен',progress:'Задание ещё не выполнено',claimed:'Уже получено',pts:'Не хватает очков карты',level:'Нет такого уровня'};
const TABS={play:'Играть',shop:'Магазин',parts:'Детали',pass:'Карта',quests:'Задания',case:'Кейс',top:'Топ'};
const PERIODS={season:'Сезон',week:'Неделя',day:'Сегодня'};
let PERIOD='season';
const TOPS={pts:'Очки карты',score:'Работы',chase:'Погоня'};
const SLOT_OF={title:'title',frame:'frame',drop:'drop',bg:'bg',car:'car',trail:'trail'};
const rar=r=>RAR[r]||RAR[0];
const rc=r=>rar(r).c;
const plr=(n,a)=>{n=Math.abs(n)%100;const k=n%10;return n>10&&n<20?a[2]:k>1&&k<5?a[1]:k==1?a[0]:a[2]};
const left=ms=>{const m=Math.max(0,Math.floor(ms/60000)),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return d?`${d} д ${h} ч`:`${h} ч ${m%60} мин`};
const tt=iso=>new Date(iso).getTime();
const day=iso=>new Date(iso).toLocaleDateString('ru-RU');
const item=id=>ST.items.find(i=>i.id==id);
// Блат-номер в награде карты: конкретный номер выдаётся при получении (занятый сервер заменяет свободным), поэтому на карте показываем только тип
const rwName=i=>i.kind=='plate'&&i.pl&&i.pl.type=='blat'?'Блат-номер':i.n;
// Реально выданный номер из ответа сервера (ev_grant: main, alt), регион берём из описания приза
const gotPlate=x=>{const i=item(x.id);return x&&x.kind=='plate'&&x.main?'Блат-номер '+x.main+(i&&i.pl&&i.pl.reg?' '+i.pl.reg:''):null};
const rewardText=rw=>[rw.tokens?fmt(rw.tokens)+' '+plr(rw.tokens,['жетон','жетона','жетонов']):'',...(rw.items||[]).map(id=>{const i=item(id);return i?rwName(i):id})].filter(Boolean).join(' + ');

// ---------- Иконки (одна линия 1.8, сетка 24) ----------
const P={
  play:'M6 3v18M6 4.5h11l-2.5 4 2.5 4H6',
  shop:'M6 8h12l-1 12H7L6 8zM9 8V6.5a3 3 0 016 0V8',
  pass:'M6 20.5a2 2 0 100-4 2 2 0 000 4zM18 7.5a2 2 0 100-4 2 2 0 000 4zM8 18.5h6.5a3 3 0 000-6h-5a3 3 0 010-6H16',
  quests:'M9 4h6v3H9zM7 5.5H5.5v15h13v-15H17M9.5 14l2 2 3.5-4',
  parts:'M12 2.8l7.4 4.3v8.6L12 20l-7.4-4.3V7.1L12 2.8zM12 9a3 3 0 100 6 3 3 0 000-6z',
  case:'M3.5 8L12 3.5 20.5 8v8L12 20.5 3.5 16V8zM3.5 8L12 12.5 20.5 8M12 12.5v8',
  top:'M8 4h8v5a4 4 0 01-8 0V4zM8 6H4.5v1a3 3 0 003 3M16 6h3.5v1a3 3 0 01-3 3M12 13v4M8.5 20h7',
  title:'M12 3l7.5 3v5.5c0 4.2-3.2 7.4-7.5 9-4.3-1.6-7.5-4.8-7.5-9V6L12 3z',
  frame:'M4 5.5h16v13H4zM8.5 10h7v4h-7z',
  drop:'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM18.5 16l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z',
  bg:'M3.5 5.5h17v13h-17zM3.5 15.5l5-5 4 4 3-3 5 5',
  car:'M4 15l1.8-5.5h12.4L20 15v3.5h-3V17H7v1.5H4zM4 15h16',
  trail:'M3 17c3 0 3-4.5 6-4.5s3 4.5 6 4.5 3-4.5 6-4.5',
  plate:'M3 7.5h18v9H3zM6.5 12h4M13.5 12h4',
  rub:'M9 20V5h5a3.5 3.5 0 010 7H7M7 16h8',
  boost:'M13 2.5L5.5 13.5h5.5l-1 8 7.5-11h-5.5z',
  tokens:'M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zM12 8v8M8 12h8',
  eye:'M2.500 12S6 5.500 12 5.500 21.500 12 21.500 12 18 18.500 12 18.500 2.500 12 2.500 12zM12 14.800a2.800 2.800 0 100-5.600 2.800 2.800 0 000 5.600z',
  playb:'M8 5.500v13L19 12z',
  lock:'M6.5 11h11v8.5h-11zM8.5 11V8a3.5 3.5 0 017 0v3',
  check:'M5 12.5l4.5 4.5L19 7.5',
  def:'M12 3l8 4.5v9L12 21l-8-4.5v-9z'};
const ic=(k,c='')=>`<svg class="ev-i ${c}" viewBox="0 0 24 24" aria-hidden="true"><path d="${P[k]||P.def}"/></svg>`;
const tok=c=>`<svg class="ev-tk ${c||''}" viewBox="0 0 24 24" aria-hidden="true"><use href="#ev-tok"/></svg>`;
const STAR='<svg class="ev-star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z"/></svg>';
// Общие определения: жетон (монета с дорожной разметкой), полосатая лента для крышки кейса
const SPRITE=`<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
  <clipPath id="ev-tokc"><circle cx="12" cy="12" r="10"/></clipPath>
  <symbol id="ev-tok" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10.5" fill="#f5b400"/><g clip-path="url(#ev-tokc)" stroke="#15161b" stroke-width="2.6"><path d="M-2 14L14 -2M2 26L26 2M10 28L28 10"/></g><circle cx="12" cy="12" r="10.5" fill="none" stroke="#15161b" stroke-width="1.5"/><circle cx="12" cy="12" r="5.2" fill="#f5b400" stroke="#15161b" stroke-width="1.5"/></symbol>
  <pattern id="ev-haz" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="12" fill="#15161b"/></pattern></defs></svg>`;
const ART_ROAD='<svg class="ev-art" viewBox="0 0 72 72" aria-hidden="true"><rect x="14" y="14" width="44" height="44" rx="7" transform="rotate(45 36 36)" fill="#f5b400" stroke="#0e0f13" stroke-width="3"/><path d="M36 20l9 26H27z" fill="#ef6a1a"/><path d="M32.6 30h6.8l1.4 4.2H31.2z" fill="#fff"/><rect x="22" y="46" width="28" height="5" rx="1.5" fill="#0e0f13"/></svg>';
const ART_CHASE='<svg class="ev-art" viewBox="0 0 72 72" aria-hidden="true"><path d="M12 40a12 12 0 0 1 24 0z" fill="#e5484d"/><path d="M36 40a12 12 0 0 1 24 0z" fill="#2f6bff"/><rect x="8" y="40" width="56" height="10" rx="3" fill="#3a3e4b"/><rect x="8" y="50" width="56" height="3" rx="1.5" fill="#0e0f13"/><path d="M24 22v-6M12 27l-4-4M60 27l4-4M48 22v-6" stroke="#ffffff66" stroke-width="2.5" stroke-linecap="round"/></svg>';
const ART_CRATE='<svg class="ev-crate" viewBox="0 0 96 84" aria-hidden="true"><rect x="12" y="30" width="72" height="46" rx="6" fill="#23262e" stroke="#0e0f13" stroke-width="3"/><rect x="7" y="16" width="82" height="16" rx="5" fill="#f5b400" stroke="#0e0f13" stroke-width="3"/><rect x="7" y="16" width="82" height="16" rx="5" fill="url(#ev-haz)" opacity=".9"/><rect x="42" y="28" width="12" height="15" rx="2.5" fill="#f5b400" stroke="#0e0f13" stroke-width="2.5"/><text x="48" y="66" text-anchor="middle" font-size="24" font-weight="800" fill="#f5b400" font-family="inherit">?</text></svg>';

let BLAT=null;   // {left, cap}: остаток блат-номеров на весь проект
const isBlat=i=>i.kind=='plate'&&i.pl&&i.pl.type=='blat';
const blatOut=i=>isBlat(i)&&BLAT&&BLAT.left<=0;
const blatLine=i=>isBlat(i)&&BLAT?`<small class="ev-blat${BLAT.left<=0?' out':''}">${BLAT.left>0?'Осталось '+BLAT.left+' из '+BLAT.cap+' на весь проект':'Все '+BLAT.cap+' блат-номеров разобраны'}</small>`:'';
async function load(){
  LOADING=true;if(!ST)paint();
  try{ST=await api.evState()}catch(e){console.error(e);ST=null}
  try{BLAT=await api.evBlat()}catch(e){BLAT=null}   // нет функции на сервере или нет связи: просто не показываем остаток
  if(TAB=='top'&&ST)await loadTop();
  LOADING=false;paint()}
async function loadTop(){
  try{TOP=await api.evTop(TOP_KIND,PERIOD);const ids=(TOP.rows||[]).map(r=>r.id);if(ids.length)Object.assign(STY,await rpc('get_styles',{ids})||{})}catch(e){console.warn('ev_top',e);TOP={rows:[],me:null}}}

// Сколько наград уже можно забрать: карта и задания (показываем на вкладках и на главной)
function claimable(){
  const pts=ST.wallet.pts;
  return {p:ST.pass.filter(z=>pts>=z.need&&!z.got).length,q:ST.quests.filter(q=>q.progress>=q.target&&!q.got).length}}

// ---------- Шапка: жетоны, время сезона, лимит за сутки ----------
function head(){
  const w=ST.wallet,s=ST.season,l=ST.limits,end=tt(s.ends)-tt(s.now),ge=tt(s.grace_end)-tt(s.now);
  const pct=l.day_cap?Math.min(100,Math.round(l.today/l.day_cap*100)):0;
  const time=s.active?`<span class="ev-time">До конца сезона ${left(end)}</span>`:`<span class="ev-time off">Сезон окончен. Жетоны сгорят через ${left(ge)}</span>`;
  return `<div class="evh"><div class="ev-hrow"><div><span class="ev-lbl">Ваши жетоны</span><b>${tok()}${fmt(w.tokens)}</b></div>${time}</div>
   <div class="ev-day"><div class="ev-day-t"><span>Заработано сегодня</span><span>${fmt(l.today)} из ${fmt(l.day_cap)}</span></div><div class="ev-bar"><i style="width:${pct}%"></i></div></div>
   ${w.boost_runs?`<div class="ev-boost">${ic('boost')}Двойные жетоны: ещё ${w.boost_runs} ${plr(w.boost_runs,['заезд','заезда','заездов'])}</div>`:''}</div>`}

// ---------- Играть ----------
function tabPlay(){
  const b=ST.best,E=EVENT,on=ST.season.active,dis=on?'':' disabled';
  const c=claimable(),n=c.p+c.q,pts=ST.wallet.pts,next=ST.pass.find(z=>z.need>pts),prev=[...ST.pass].reverse().find(z=>z.need<=pts);
  let goal;
  if(n)goal=`<button class="ev-goal hot" data-click="evTab" data-arg="${c.p?'pass':'quests'}"><strong>${n} ${plr(n,['награда ждёт','награды ждут','наград ждут'])} вас</strong><small>${[c.p?`Карта: ${c.p}`:'',c.q?`Задания: ${c.q}`:''].filter(Boolean).join(', ')}. Откройте и заберите.</small></button>`;
  else if(next){const from=prev?prev.need:0,pr=Math.min(100,Math.round((pts-from)/(next.need-from)*100));
    goal=`<button class="ev-goal" data-click="evTab" data-arg="pass"><strong>До уровня ${next.l} на карте ещё ${fmt(next.need-pts)} очков</strong><div class="ev-bar sm"><i style="width:${pr}%"></i></div><small>Награда: ${esc(rewardText(next.rw))}</small></button>`}
  else goal=`<div class="ev-goal"><strong>Все уровни карты открыты</strong><small>Заезды по-прежнему приносят жетоны и очки в топ.</small></div>`;
  return `<button class="ev-mode road" data-click="evPlay" data-arg="road"${dis}>${ART_ROAD}
     <span class="ev-mt"><strong>Дорожные работы</strong><small>Проезжайте между конусами, не задевая препятствия. ${E.scoreDiv} очков = 1 жетон.</small></span>
     <span class="ev-ms"><i>Лучший заезд</i><b>${fmt(b.road)}</b></span>
     <span class="ev-go">${on?'Начать заезд':'Сезон окончен'}</span></button>
   <button class="ev-mode chase" data-click="evPlay" data-arg="chase"${dis}>${ART_CHASE}
     <span class="ev-mt"><strong>Уйти от полиции</strong><small>Финиша нет. Каждые ${fmt(E.chase.starM)} м растёт розыск, и жетоны за каждые ${E.chase.perM} м умножаются на число звёзд.</small></span>
     <span class="ev-ms"><i>Самая длинная погоня</i><b>${fmt(b.chase)} м</b><span class="ev-stars">${STAR.repeat(E.chase.maxStars)}</span></span>
     <span class="ev-go">${on?'Начать погоню':'Сезон окончен'}</span></button>
   ${goal}
   <p class="ev-note">Рубли ивент не платит. Их можно купить в магазине за жетоны.</p>`}

// ---------- Магазин ----------
const SAMPLE={type:'civil',main:'А777АА',reg:'77',country:'RU',cls:1};
const COSM=['title','frame','drop','bg','car','trail'];
const TRYABLE=['title','frame','bg','car','trail'];
const SHOW_KINDS=['car','trail'];
const VIS=['frame','bg','drop','car','trail'];
const SLOT_N={title:'Титул',frame:'Рамка',drop:'Эффект',bg:'Фон',car:'Кузов',trail:'След'};
const KNOTE={title:'Подпись рядом с ником в профиле и рейтинге',frame:'Кромка вокруг вашего номера везде в игре',drop:'Анимация при выпадении номера и открытии кейсов',bg:'Фон главного экрана и гаража',car:'Цвет вашей машины в заездах',trail:'Шлейф за машиной в заездах',rub:'Обмен жетонов на рубли',boost:'Бонус к жетонам за заезды'};
const nameOf=id=>{const i=item(id)||itemOf(id);return i&&i.n||id};
function carSVG(c,gloss){
  const k=esc(c||'#8b93a3');
  return `<svg class="ev-car" viewBox="0 0 120 72" aria-hidden="true">
   <rect x="17" y="60" width="16" height="9" rx="2.5" fill="#101115"/><rect x="87" y="60" width="16" height="9" rx="2.5" fill="#101115"/>
   <path d="M29 31l7-17c1.500-3 3.500-4.500 7-4.500h34c3.500 0 5.500 1.500 7 4.500l7 17z" fill="${k}"/>
   <path d="M29 31l7-17c1.500-3 3.500-4.500 7-4.500h34c3.500 0 5.500 1.500 7 4.500l7 17z" fill="#000" opacity=".28"/>
   <path d="M38 29l5-13c.7-1.500 1.500-2 3-2h28c1.500 0 2.300.5 3 2l5 13z" fill="#0e0f13" opacity=".88"/>
   ${gloss?'<path d="M46 28l6-13h8l-6 13z" fill="#fff" opacity=".16"/>':''}
   <path d="M11 38c0-6 3-9 9-9h80c6 0 9 3 9 9v17c0 3-2 5-5 5H16c-3 0-5-2-5-5z" fill="${k}"/>
   <path d="M11 44h98v11c0 3-2 5-5 5H16c-3 0-5-2-5-5z" fill="#000" opacity=".22"/>
   <path d="M14 34.500h92" stroke="#fff" stroke-opacity="${gloss?.55:.25}" stroke-width="1.600" stroke-linecap="round"/>
   <rect x="14" y="35" width="25" height="8" rx="3.500" fill="#d9363e"/><rect x="81" y="35" width="25" height="8" rx="3.500" fill="#d9363e"/>
   <rect x="16" y="36" width="21" height="2.500" rx="1.200" fill="#ff8a8f" opacity=".7"/><rect x="83" y="36" width="21" height="2.500" rx="1.200" fill="#ff8a8f" opacity=".7"/>
   <rect x="46" y="44" width="28" height="10" rx="1.800" fill="#f4f4f6" stroke="#0e0f13" stroke-width="1.200"/><rect x="49" y="47" width="22" height="1.800" rx=".9" fill="#14141a" opacity=".55"/><rect x="49" y="50.200" width="14" height="1.800" rx=".9" fill="#14141a" opacity=".35"/>
   ${gloss?`<rect x="33" y="27.500" width="54" height="3" rx="1.500" fill="${k}"/><rect x="33" y="27.500" width="54" height="3" rx="1.500" fill="#000" opacity=".35"/>`:''}
   <rect x="9" y="57" width="102" height="5" rx="2.500" fill="#0e0f13" opacity=".6"/></svg>`}
// Шлейф: точки убывают от машины назад; «Следы шин» рисуем линиями, «Ленту» квадратами
function trailDots(it){
  if(!it||!it.pl||!it.pl.c)return '';
  const a=it.pl.c,b=it.pl.c2||a;let h='';
  for(let n=0;n<10;n++){
    const s=it.id=='ev_tr_skid'?0:Math.round(11-n*.8),col=n%2?b:a,o=(1-n/11).toFixed(2),x=84-n*9;
    if(it.id=='ev_tr_skid')h+=`<i class="ln" style="right:${n*9+6}px;background:#7b7f8a;color:#7b7f8a;opacity:${o}"></i>`;
    else h+=`<i class="${it.id=='ev_tr_tape'?'sq':''}" style="right:${n*9+4}px;width:${s}px;height:${s}px;background:${esc(col)};opacity:${o};bottom:${6+(n%3)*3}px"></i>`}
  return `<span class="ev-tr" aria-hidden="true">${h}</span>`}
// Статичный «залп» эффекта выпадения для карточки; живой показывает кнопка «Показать» (fxTest)
function fxDots(id){
  const E=FXE[id];if(!E)return '';
  let h='';
  for(let n=0;n<18;n++){
    const g=n/18*6.283+Math.sin(n*7.1)*.25,r=(14+((n*37)%24))*(E.rad?Math.min(1.5,E.rad+.35):1),sz=E.big?15+(n%3)*3:E.star?11+(n%2)*3:5+(n%3)*2;
    const dy=Math.sin(g)*r*.62,y=E.dir=='up'?-Math.abs(dy)-6:E.dir=='down'?Math.abs(dy)+6:dy;
    h+=`<i class="${E.star?'st':''}${E.sq?' sq':''}" style="left:calc(50% + ${(Math.cos(g)*r*2).toFixed(1)}px);top:calc(50% + ${y.toFixed(1)}px);background:${E.pal[n%E.pal.length]};width:${sz}px;height:${sz}px;animation-delay:${(n%6)*.18}s"></i>`}
  return h}
function equipped(i){const e=ST.wallet.equip;return SLOT_OF[i.kind]&&e[SLOT_OF[i.kind]]==i.id}
function pills(i){
  const t=[];
  if(i.until)t.push('до '+day(i.until));
  if(i.from&&tt(i.from)>tt(ST.season.now))t.push('с '+day(i.from));
  if(i.lim)t.push(`на сезон ${i.bought} из ${i.lim}`);
  if(i.day)t.push(`сегодня ${i.today} из ${i.day}`);
  return t.map(x=>`<span class="ev-pill">${esc(x)}</span>`).join('')}
// «Мой образ»: надетое (или примеряемое) собрано в одну сцену
function look(){
  const e={...ST.wallet.equip,...TRY},tr=Object.keys(TRY).length;
  const chips=COSM.map(k=>`<button type="button" class="ev-slot${k==SHOP_KIND?' a':''}${TRY[k]?' try':''}" data-click="evKind" data-arg="${k}"><span class="ev-slot-i">${ic(k)}</span><span class="ev-slot-t"><small>${SLOT_N[k]}${TRY[k]?' (примерка)':''}</small><span>${e[k]?esc(nameOf(e[k])):'Не надето'}</span></span></button>`).join('');
  const badge=tr?'<span class="ev-try">Примерка</span>':'';
  const scene=SHOW_KINDS.includes(SHOP_KIND)
    ?`<div class="ev-scene ev-show${SHOW_BAD?'':' ld'}" id="evShow">${SHOW_BAD?`<div class="ev-fb">${carSVG(e.car&&item(e.car)&&item(e.car).pl&&item(e.car).pl.c)}</div>`:'<span class="ev-hint">Крутите машину пальцем</span>'}${badge}</div>`
    :`<div class="ev-scene ${e.bg?'scn-'+esc(e.bg):''}"><div class="ev-lp">${plateHTML(SAMPLE,'',e.frame||'')}</div>${badge}</div>`;
  return `<div class="ev-look">${scene}
   <div class="ev-who"><span class="ev-nick">${esc(S.nick||'Ваш ник')}</span>${e.title?titleHTML(e.title):''}${tr?'<button type="button" class="ev-x" data-click="evTryReset">Сбросить</button>':''}</div>
   <div class="ev-slots">${chips}</div></div>`}
function shopBtns(i){
  const w=ST.wallet,own=i.own&&SLOT_OF[i.kind],eq=equipped(i),soon=i.from&&tt(i.from)>tt(ST.season.now),short=w.tokens<i.p;
  const main=blatOut(i)?`<button type="button" class="ev-btn" disabled>Распродано</button>`:soon&&!own?`<button type="button" class="ev-btn" disabled>С ${day(i.from)}</button>`:own?`<button type="button" class="ev-btn ghost" data-click="evEquip" data-arg="${i.kind}|${eq?'':i.id}">${eq?'Снять':'Надеть'}</button>`
    :`<button type="button" class="ev-btn${short?' short':''}" data-click="evBuy" data-arg="${i.id}">${tok()}${fmt(i.p)}</button>`;
  const side=i.kind=='drop'?`<button type="button" class="ev-eye txt" data-click="fxTest" data-arg="${i.id}" aria-label="Показать эффект">${ic('playb')}</button>`
    :TRYABLE.includes(i.kind)?`<button type="button" class="ev-eye${TRY[i.kind]==i.id?' on':''}" data-click="evTry" data-arg="${i.kind}|${i.id}" aria-label="Примерить">${ic('eye')}</button>`:'';
  return {main,side,need:!own&&!soon&&short?`<span class="ev-need">нужно ещё ${fmt(i.p-w.tokens)}</span>`:'',own,eq}}
function tag(b){return b.eq?'<em class="ev-tag on">Надето</em>':b.own?'<em class="ev-tag">Куплено</em>':''}
function vcard(i){
  const b=shopBtns(i);let pv;
  if(i.kind=='frame')pv=`<div class="ev-pv"><div class="ev-pvp">${plateHTML(SAMPLE,'',i.id)}</div></div>`;
  else if(i.kind=='bg')pv=`<div class="ev-pv bgp scn-${esc(i.id)}"><div class="ev-pvp sm">${plateHTML(SAMPLE,'','')}</div></div>`;
  else if(i.kind=='drop')pv=`<div class="ev-pv ev-fxd">${fxDots(i.id)}</div>`;
  else if(i.kind=='car')pv=`<div class="ev-pv">${carSVG(i.pl&&i.pl.c,i.r>=3)}</div>`;
  else pv=`<div class="ev-pv ev-pvtr">${trailDots(i)}</div>`;
  return `<div class="ev-vc" style="--rl:${rc(i.r)}">${pv}<div class="ev-vc-b"><strong>${esc(i.n)}</strong><div class="ev-meta"><span class="ev-rar">${rar(i.r).n}</span>${tag(b)}</div>${i.d?`<small>${esc(i.d)}</small>`:''}<div class="ev-pills">${pills(i)}</div></div>
    <div class="ev-vc-a">${b.side}${b.main}</div>${b.need}</div>`}
function icard(i){
  const b=shopBtns(i);
  return `<div class="ev-it" style="--rl:${rc(i.r)}"><span class="ev-ico">${ic(i.kind)}</span>
    <div class="ev-it-b"><strong class="ev-name">${i.kind=='title'?titleHTML(i.id):esc(i.n)}</strong>
    <div class="ev-meta"><span class="ev-rar">${rar(i.r).n}</span>${tag(b)}</div>${i.d?`<small>${esc(i.d)}</small>`:''}${blatLine(i)}<div class="ev-pills">${pills(i)}</div></div>
    <div class="ev-it-a">${b.side?`<div class="ev-row2">${b.side}${b.main}</div>`:b.main}${b.need}</div></div>`}
function tabShop(){
  const kinds=Object.keys(EVENT.kinds).filter(k=>ST.items.some(i=>i.kind==k&&(i.shop||i.own)));
  if(kinds.length&&!kinds.includes(SHOP_KIND))SHOP_KIND=kinds[0];
  const cnt=k=>{const l=ST.items.filter(i=>i.kind==k&&(i.shop||i.own));return `${l.filter(i=>i.own).length}/${l.length}`};
  const seg=`<div class="ev-seg" role="tablist">${kinds.map(k=>`<button type="button" class="${k==SHOP_KIND?'a':''}" data-click="evKind" data-arg="${k}">${EVENT.kinds[k]}${COSM.includes(k)?`<em>${cnt(k)}</em>`:''}</button>`).join('')}</div>`;
  const list=ST.items.filter(i=>i.kind==SHOP_KIND&&(i.shop||i.own));
  const body=VIS.includes(SHOP_KIND)?`<div class="ev-grid">${list.map(vcard).join('')}</div>`:list.map(icard).join('');
  return (COSM.includes(SHOP_KIND)?look():'')+seg+(KNOTE[SHOP_KIND]?`<p class="ev-note">${KNOTE[SHOP_KIND]}</p>`:'')+(body||'<div class="ev-empty">В этом разделе пока ничего нет</div>')}

// ---------- Карта сезона ----------
const rewardHTML=rw=>[rw.tokens?`<span class="ev-r">${tok()}${fmt(rw.tokens)}</span>`:'',...(rw.items||[]).map(id=>{const i=item(id);return `<span class="ev-r item">${esc(i?rwName(i):id)}</span>`})].filter(Boolean).join('');
function tabPass(){
  const pts=ST.wallet.pts,p=ST.pass,next=p.find(z=>z.need>pts),prev=[...p].reverse().find(z=>z.need<=pts),last=p[p.length-1];
  const from=prev?prev.need:0,pr=next?Math.min(100,Math.round((pts-from)/(next.need-from)*100)):100;
  return `<div class="ev-card"><div class="ev-sum"><div><span class="ev-lbl">Очки карты за сезон</span><b>${fmt(pts)}</b></div><span class="ev-sum-r">${next?`До уровня ${next.l}: ${fmt(next.need-pts)}`:'Все уровни открыты'}</span></div>
   <div class="ev-bar"><i style="width:${pr}%"></i></div>
   <p class="ev-note l">Очки дают заезды обоих режимов, не больше ${fmt(ST.limits.pts_cap)} в сутки. Сегодня набрано ${fmt(ST.limits.pts_today)}.${p.some(z=>(z.rw.items||[]).some(id=>{const i=item(id);return i&&isBlat(i)}))?' Блат-номер выдаётся свободный на момент получения.':''}</p></div>
   <div class="ev-rail">`+p.map(z=>{
    const ok=pts>=z.need,st=z.got?'got':ok?'rdy':'lock';
    return `<div class="lv ev-lv ${st}"><span class="ev-node">${z.got?ic('check'):z.l}</span>
     <div class="ev-lv-b"><div class="ev-lv-t"><strong>Уровень ${z.l}</strong>${z===last?'<em class="ev-tag gold">Эксклюзив</em>':''}</div><div class="ev-rw">${rewardHTML(z.rw)}</div><small>${fmt(z.need)} очков</small></div>
     <button type="button" class="ev-btn" data-click="evPass" data-arg="${z.l}"${ok&&!z.got?'':' disabled'}${!ok?' aria-label="Закрыто"':''}>${z.got?'Получено':ok?'Забрать':ic('lock')}</button></div>`}).join('')+'</div>'}

// ---------- Задания ----------
function tabQuests(){
  const sec=(per,t)=>{
    const qs=ST.quests.filter(q=>q.period==per);if(!qs.length)return '';
    const done=qs.filter(q=>q.got).length;
    return `<div class="ev-sec"><h3>${t}</h3><span>${done} из ${qs.length}</span></div>`+qs.map(q=>{
      const pr=Math.min(100,Math.round(q.progress/q.target*100)),ok=q.progress>=q.target;
      return `<div class="lv ev-q ${q.got?'got':ok?'rdy':''}"><div class="ev-q-b"><strong>${esc(q.title)}</strong><div class="ev-bar sm"><i style="width:${pr}%"></i></div><small>${fmt(Math.min(q.progress,q.target))} из ${fmt(q.target)}</small></div>
       <div class="ev-q-a"><span class="ev-r">${tok()}${fmt(q.reward)}</span><button type="button" class="ev-btn" data-click="evQuest" data-arg="${q.id}"${ok&&!q.got?'':' disabled'}>${q.got?'Готово':ok?'Забрать':'В процессе'}</button></div></div>`}).join('')};
  return sec('day','Задания на сегодня')+sec('week','Задания недели')+'<p class="ev-note">Сутки и неделя считаются по московскому времени. Прогресс берётся из засчитанных заездов.</p>'}

// ---------- Кейс ----------
function tabCase(){
  const c=ST.case,w=ST.wallet,pool=c.pool.map(item).filter(Boolean).sort((a,b)=>b.r-a.r),short=w.tokens<c.price;
  const pr=Math.min(100,Math.round(c.pity/c.pity_at*100));
  const reveal=LAST?`<div class="ev-reveal" style="--rl:${rc(LAST.it.r)}"><span class="ev-lbl">${LAST.forced?'Сработала гарантия':'Выпало из кейса'}</span><strong>${esc(LAST.it.n)}</strong><span class="ev-rar">${rar(LAST.it.r).n}</span>${LAST.it.dup?`<small>Дубликат: вернули ${fmt(LAST.it.refund)} ${plr(LAST.it.refund,['жетон','жетона','жетонов'])}</small>`:''}</div>`:'';
  return reveal+`<div class="ev-case">${ART_CRATE}<div class="ev-case-b"><strong>Дорожный кейс</strong><small>Случайная косметика ивента</small></div>
    <button type="button" class="ev-btn big${short?' short':''}" data-click="evCase">Открыть за ${tok()}${fmt(c.price)}</button>${short?`<span class="ev-need c">нужно ещё ${fmt(c.price-w.tokens)}</span>`:''}</div>
   <div class="ev-card"><div class="ev-sec n"><h3>Шансы</h3></div>
    <div class="ev-odds" role="img" aria-label="Шансы выпадения по редкости">${c.odds.map(o=>`<i style="flex:${o.w};background:${rc(o.r)}"></i>`).join('')}</div>
    <div class="ev-leg">${c.odds.map(o=>`<span><i style="background:${rc(o.r)}"></i>${rar(o.r).n} ${o.w}%</span>`).join('')}</div></div>
   <div class="ev-card"><div class="ev-sum"><div><span class="ev-lbl">Гарантия редкого</span><b>${c.pity} из ${c.pity_at}</b></div></div><div class="ev-bar sm"><i style="width:${pr}%"></i></div>
    <p class="ev-note l">На каждом ${c.pity_at}-м кейсе подряд без предмета редкости «${rar(EVENT.case.forcedMin).n}» и выше он выпадет точно. Дубликат косметики возвращает ${EVENT.case.dupPct}% цены жетонами.</p></div>
   <div class="ev-sec"><h3>Что может выпасть</h3><span>${pool.length}</span></div>
   <div class="ev-pool">${pool.map(i=>`<div class="ev-pt" style="--rl:${rc(i.r)}"><span class="ev-ico sm">${ic(i.kind)}</span><div><strong>${esc(i.n)}</strong><small>${rar(i.r).n}</small></div>${i.own?`<span class="ev-own" title="Уже есть">${ic('check')}</span>`:''}</div>`).join('')}</div>`}

// ---------- Топ ----------
function tabTop(){
  const unit=TOP_KIND=='chase'?' м':'';
  // «Работы» считаются по времени до финиша (секунды с десятыми), остальное числом
  const fv=v=>TOP_KIND=='score'?`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}.${Math.round((v%1)*10)}`:fmt(v)+unit;
  const CAP={pts:'Очки дороги. При равенстве выше тот, кто набрал раньше',score:'Лучшее время до финиша «Дорожных работ»',chase:'Самая длинная погоня'};
  const EMPTY=TOP_KIND=='score'?'Пока никто не добежал до финиша.':PERIOD=='season'?'В этом сезоне ещё никого.':'За этот период ещё никого.';
  const row=(r,extra)=>{const st=STY[r.id]||{},m=r.rk<=3?['g','s','b'][r.rk-1]:'';
    return `<div class="tp${r.me?' me':''}"><span class="ev-rk ${m}">${r.rk}</span><span class="ev-nm">${esc(r.n)}${r.me?'<em class="ev-tag on">Вы</em>':''} ${st.title?titleHTML(st.title):''}</span><span class="ev-v">${fv(r.v)}</span></div>`};
  let h=`<div class="ev-seg fit">${Object.keys(TOPS).map(x=>`<button type="button" class="${x==TOP_KIND?'a':''}" data-click="evTopK" data-arg="${x}">${TOPS[x]}</button>`).join('')}</div>`;
  if(TOP&&TOP.periods)h+=`<div class="ev-seg fit" role="group" aria-label="Период">${Object.keys(PERIODS).map(x=>`<button type="button" class="${x==PERIOD?'a':''}" data-click="evTopP" data-arg="${x}">${PERIODS[x]}</button>`).join('')}</div>`;
  h+=`<p class="ev-note">${CAP[TOP_KIND]}</p>`;
  h+=TOP&&TOP.rows.length?TOP.rows.map(row).join(''):`<div class="ev-empty">${EMPTY} Сыграйте заезд и займите первое место.</div>`;
  if(TOP&&TOP.me&&!TOP.rows.some(r=>r.me))h+=`<div class="ev-gap">…</div><div class="tp me"><span class="ev-rk">${TOP.me.rk}</span><span class="ev-nm">Вы<em class="ev-tag on">Ваше место</em></span><span class="ev-v">${fv(TOP.me.v)}</span></div>`;
  return h}

function nav(){
  const c=claimable(),n={pass:c.p,quests:c.q};
  return `<nav class="evn" aria-label="Разделы ивента">${Object.keys(TABS).map(k=>`<button type="button" class="${k==TAB?'a':''}" data-click="evTab" data-arg="${k}"${k==TAB?' aria-current="page"':''}${n[k]?` data-n="${n[k]}"`:''}><span class="ev-ni">${ic(k)}</span><span>${TABS[k]}</span></button>`).join('')}</nav>`}

const skeleton=()=>'<div class="ev-sk" style="height:150px"></div><div class="ev-sk"></div><div class="ev-sk"></div><div class="ev-sk" style="height:64px"></div>';
const fail=()=>`<div class="ev-state">${ic('def')}<strong>Не удалось загрузить ивент</strong><p>Проверьте соединение и попробуйте ещё раз.</p><button type="button" class="ev-btn" data-click="evReload">Повторить</button></div>`;
const idle=()=>`<div class="ev-state">${ic('pass')}<strong>Сезон ивента сейчас не идёт</strong><p>${ST.next?'Следующий «'+esc(ST.next.title)+'» начнётся '+day(ST.next.starts_at)+'.':'Новый сезон появится позже.'}</p><button type="button" class="ev-btn ghost" data-click="go" data-arg="menu">В меню</button></div>`;

// ---------- 3D-шоурум: машина из самой игры (js/vendor/roadworks.js, режим showroom), одна на всю вкладку ----------
let SHOW=null,SHOW_LOAD=null,SHOW_BAD=false;
const loadScript=src=>new Promise((ok,no)=>{const s=document.createElement('script');s.src=src;s.onload=()=>ok();s.onerror=()=>{s.remove();no(new Error(src))};document.head.appendChild(s)});
function loadRW(){
  return SHOW_LOAD||(SHOW_LOAD=(async()=>{
    if(!window.THREE)for(const u of THREE_SRC){try{await loadScript(u);if(window.THREE)break}catch(e){console.warn('three.js:',e.message)}}
    if(!window.THREE)throw new Error('three');
    if(!window.RoadWorks)await loadScript('js/vendor/roadworks.js');
    if(!window.RoadWorks)throw new Error('roadworks')})().catch(e=>{SHOW_LOAD=null;throw e}))}
function killShow(){if(SHOW){try{SHOW.g.destroy()}catch(e){}SHOW=null}}
function applyShow(e){
  const c=e.car||'',t=e.trail||'',f=e.frame||'';
  if(SHOW.c!==c){SHOW.g.setSkin(c);SHOW.c=c}
  if(SHOW.t!==t){SHOW.g.setTrail(t);SHOW.t=t}
  if(SHOW.f!==f){SHOW.g.setFrame(f);SHOW.f=f}}
// Вызывается после каждого paint(): есть площадка #evShow — показываем машину, нет — освобождаем WebGL
async function syncShow(){
  const ph=$('evShow');
  if(!ph){killShow();return}
  const e={...ST.wallet.equip,...TRY};
  if(SHOW){const el=SHOW.el;if(el.parentNode!==ph)ph.appendChild(el);ph.classList.remove('ld');applyShow(e);return}
  try{await loadRW()}catch(x){SHOW_BAD=true;const q=$('evShow');if(q){q.classList.remove('ld');q.innerHTML=`<div class="ev-fb">${carSVG(null)}</div>`}return}
  const q=$('evShow');if(!q||SHOW)return;
  const el=document.createElement('div');el.className='ev-3d';q.appendChild(el);
  try{
    const g=window.RoadWorks.mount(el,{showroom:true,plate:SAMPLE.main+' '+SAMPLE.reg,skin:e.car||'',trail:e.trail||'',frame:e.frame||''});
    SHOW={g,el,c:e.car||'',t:e.trail||'',f:e.frame||''};q.classList.remove('ld')
  }catch(x){console.error(x);SHOW_BAD=true;el.remove();q.classList.remove('ld');q.innerHTML=`<div class="ev-fb">${carSVG(null)}</div>`}}

function paint(){
  const box=$('evC');if(!box)return;
  if(!ST){box.innerHTML=LOADING?skeleton():fail();return}
  if(!ST.season){box.innerHTML=idle();return}
  box.innerHTML=SPRITE+head()+`<section class="ev-tab" data-tab="${TAB}">${({play:tabPlay,shop:tabShop,parts:partsTab,pass:tabPass,quests:tabQuests,case:tabCase,top:tabTop}[TAB])()}</section>`+nav();syncShow();partsSync(TAB=='parts')}
const top=()=>{try{window.scrollTo({top:0})}catch(e){}};
// Вкладка «Детали» живёт в parts.js, но данные ивента и перерисовку берёт отсюда
bindParts({st:()=>ST,paint:()=>paint(),reload:()=>load()});

// Серверный отказ → короткий текст; true, если действие прошло
function check(r){if(r&&r.ok)return true;banner('Не вышло',ERR[r&&r.err]||'Ошибка сервера');haptic&&haptic('error');return false}
async function act(fn){
  if(BUSY)return;BUSY=true;const box=$('evC');box&&box.classList.add('busy');
  try{await fn()}catch(e){console.error(e);banner('Нет связи','Попробуйте ещё раз')}finally{BUSY=false;box&&box.classList.remove('busy')}}

on({
  evTab:async t=>{if(t!='case')LAST=null;if(t!='shop')TRY={};TAB=t;if(t=='top')await loadTop();paint();top()},
  evKind:k=>{SHOP_KIND=k;paint()},
  evTry:a=>{const [k,id]=a.split('|');if(TRY[k]==id)delete TRY[k];else TRY[k]=id;paint()},
  evTryReset:()=>{TRY={};paint()},
  evTopK:async k=>{TOP_KIND=k;await loadTop();paint()},
  evTopP:async p=>{PERIOD=p;await loadTop();paint()},
  evReload:()=>load(),
  evPlay:m=>{setRoadMode(m);go('road')},
  evBuy:id=>act(async()=>{const r=await api.evBuy(id);if(check(r)){TRY={};const i=item(id),gp=r.grant&&gotPlate(r.grant);banner('Куплено',gp||(i?i.n:''));haptic&&haptic('success');await load()}}),
  evEquip:a=>act(async()=>{const [slot,id]=a.split('|');const r=await api.evEquip(slot,id);if(check(r)){TRY={};await load()}}),
  evPass:l=>act(async()=>{const r=await api.evPassClaim(+l);if(check(r)){
    // Сервер мог засчитать уровень, но не выдать приз (например, блат-номера уже разобраны): сверяем с тем, что обещала карта, и говорим прямо.
    const got=(r.items||[]).map(x=>x.id),z=(ST.pass||[]).find(q=>q.l==+l),miss=((z&&z.rw&&z.rw.items)||[]).filter(id=>!got.includes(id)).map(id=>{const i=item(id);return i?i.n:id});
    const txt=[r.reward_tokens?rewardText({tokens:r.reward_tokens,items:[]}):'',...(r.items||[]).map(x=>gotPlate(x)||(item(x.id)?rwName(item(x.id)):x.id))].filter(Boolean).join(' + ');
    banner(miss.length?'Награда получена не полностью':'Награда получена',txt+(miss.length?(txt?' · ':'')+'не выдано: '+miss.join(', '):''));
    haptic&&haptic(miss.length?'warning':'success');await load()}}),
  evQuest:id=>act(async()=>{const r=await api.evQuestClaim(id);if(check(r)){banner('Задание выполнено','+'+fmt(r.reward)+' '+plr(r.reward,['жетон','жетона','жетонов']));haptic&&haptic('success');await load()}}),
  evCase:()=>act(async()=>{
    const r=await api.evCase();if(!check(r))return;
    const it=r.item;LAST={it,forced:!!r.forced};
    banner(`${rar(it.r).n}${r.forced?' (гарантия)':''}`,it.dup?`${it.n}: дубликат, вернули ${fmt(it.refund)} ${plr(it.refund,['жетон','жетона','жетонов'])}`:it.n);haptic&&haptic('success');await load()})
});

// Перерисовка на каждом render() дешёвая (без сети); данные грузим при входе на экран и после каждого действия
DRAW.evshop=()=>{if(ST)paint()};
let was=false;
new MutationObserver(()=>{const now=$('v-evshop').classList.contains('on');if(now&&!was){LAST=null;partsReset();load()}if(!now&&was){killShow();partsSync(false)}was=now}).observe($('v-evshop'),{attributes:true,attributeFilter:['class']});
