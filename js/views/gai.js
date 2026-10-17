import {api} from '../api.js';
import {GAI, gaiX} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, render} from '../router.js';
import {rpc, serverDown} from '../server.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {beep} from '../ui/fx.js';
import {banner} from '../ui/modal.js';
import {plateHTML} from '../ui/plate.js';
import {$, esc, fmt, parseAsk, setHTML} from '../util.js';
import {fit, garageCar} from './garage.js';

// ГАИ: общий заезд для всех игроков. Ставки, точку остановки, множитель при «Забрать» и выплаты решает СЕРВЕР (gai.sql).
// Клиент знает только время начала заезда и рисует рост x(t)=exp(g·t) по часам сервера (поправка OFF). Где остановит гаишник, ему неизвестно:
// об остановке он узнаёт из опроса gai_state (во время заезда раз в 0,8 с), поэтому после остановки число на экране «откатывается» к настоящему.
const KEY='gai:v1';
const B={1:{a:1000,u:'1.5'},2:{a:1000,u:''}};          // сумма и автовывод (строкой, как ввёл игрок) для каждой из двух ставок
try{const j=JSON.parse(localStorage.getItem(KEY)||'{}');for(const k of GAI.slots)if(j[k])Object.assign(B[k],j[k])}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(B))}catch(e){}};

let ST=null,OFF=0,TAB='road',HIST=[],KNOWN=0,ME=null;
let LOOP=false,FR=0,POLLING=false,MUT=0,PT=0;               // MUT: когда мы последний раз сами поменяли ставки (ответ опроса, начатого раньше, их не затирает)
let FXR=0,SYNC=0,PASSED=0,LANE=0,V=0,LAST=0,CARKEY='';
const BZ={};
const now=()=>Date.now()/1000+OFF;
const fx=x=>'x'+(+x).toFixed(2).replace('.',',');
const mine=s=>ST&&ST.mine.find(m=>m.s==s);
const au=s=>{const v=parseFloat(String(B[s].u).replace(',','.'));return v>=GAI.minAuto&&v<=GAI.cap?Math.round(v*100)/100:null};
const lit=(el,c)=>{el.classList.remove(c);void el.offsetWidth;el.classList.add(c)};

// Фаза и множитель на экране: bet — приём ставок, run — заезд, crash — остановили
function view(){
  const r=ST&&ST.r;if(!r)return {ph:'load',x:1,left:0};
  const t=now();
  if(r.fin)return {ph:'crash',x:r.cx,left:Math.max(0,r.na-t)};
  if(t<r.be)return {ph:'bet',x:1,left:r.be-t};
  return {ph:'run',x:gaiX(t-r.be),left:0}}

// ---------- Опрос сервера ----------
async function poll(){
  if(POLLING)return;
  POLLING=true;const t0=Date.now();
  try{
    const s=await rpc('gai_state',{p_known:KNOWN});
    OFF=s.t-(t0+Date.now())/2000;
    const prev=ST;
    if(prev&&t0<MUT&&prev.r.id==s.r.id)s.mine=prev.mine;
    ST=s;
    if(s.hist){HIST=s.hist;KNOWN=s.hist.length?s.hist[0].id:0}
    if(s.r.id!=(prev&&prev.r.id)){PASSED=0;C={};$('gaiRoad')&&$('gaiRoad').classList.remove('crash')}
    if(s.r.fin&&FXR!=s.r.id){FXR=s.r.id;if(prev)crashFx(s)}   // при первом открытии уже закончившийся раунд молча
    if(s.r.fin&&s.mine.length&&SYNC!=s.r.id){SYNC=s.r.id;api.syncPlayer().then(()=>render(true)).catch(()=>{})}
    if(s.r.fin&&TAB=='top'&&prev&&!prev.r.fin)loadMe();
    lists()}
  catch(e){console.warn('gai',e)}
  finally{POLLING=false}}
const active=()=>$('v-gai').classList.contains('on')&&!document.hidden;
function tick(){
  if(!active()){LOOP=false;return}
  poll().then(()=>{
    if(!active()){LOOP=false;return}
    const v=view();let d=1500;
    if(v.ph=='run')d=800;
    else if(v.ph=='crash')d=Math.max(300,(ST.r.na-now())*1000+150);
    else if(v.ph=='bet')d=Math.min(2000,Math.max(300,v.left*1000+100));
    if(serverDown())d=5000;
    PT=setTimeout(tick,d)})}
const kick=()=>{clearTimeout(PT);if(LOOP)tick()};
document.addEventListener('visibilitychange',()=>{if(active()&&$('v-gai')&&!LOOP)start()});
function start(){
  if(!LOOP){LOOP=true;tick()}
  if(!FR){LAST=0;FR=requestAnimationFrame(frame)}}

// ---------- Разметка (строится один раз, дальше обновляются только тексты и классы) ----------
const COP=`<svg viewBox="0 0 90 150" width="70"><rect x="30" y="56" width="26" height="54" rx="6" fill="#39486b"/><rect x="30" y="68" width="26" height="5" fill="#f2c230"/><rect x="31" y="108" width="10" height="34" rx="3" fill="#252e49"/><rect x="45" y="108" width="10" height="34" rx="3" fill="#252e49"/><circle cx="43" cy="40" r="13" fill="#e8c9a0"/><path d="M28 36h30v-5a15 9 0 0 0-30 0z" fill="#39486b"/><rect x="26" y="35" width="34" height="4" rx="2" fill="#1b2238"/><rect x="44" y="60" width="26" height="9" rx="4.5" fill="#39486b" transform="rotate(-62 46 64)"/><g transform="rotate(14 66 24)"><rect x="63" y="2" width="7" height="46" rx="2" fill="#f4f4f6"/><rect x="63" y="10" width="7" height="7" fill="#d6372b"/><rect x="63" y="24" width="7" height="7" fill="#d6372b"/><rect x="63" y="38" width="7" height="7" fill="#d6372b"/></g></svg>`;
const slot=s=>`<div class="gai-b" id="gB${s}">
  <div class="gai-bh"><b>Ставка ${s}</b><span id="gS${s}"></span></div>
  <label class="gai-l">Сумма, ₽</label>
  <input class="gai-in" id="gA${s}" type="text" inputmode="text" autocomplete="off" value="${fmt(B[s].a)}" data-input="gaiAmt" data-change="gaiFmt" data-arg="${s}">
  <div class="gai-q">${[['½','h'],['×2','d'],['мин','n'],['макс','m']].map(([n,k])=>`<button data-click="gaiQ" data-arg="${s}:${k}">${n}</button>`).join('')}</div>
  <label class="gai-l">Автовывод на множителе</label>
  <input class="gai-in" id="gU${s}" type="text" inputmode="decimal" autocomplete="off" placeholder="нет" value="${esc(B[s].u)}" data-input="gaiAuto" data-arg="${s}">
  <div class="gai-q">${[1.5,2,3,5,10].map(v=>`<button data-click="gaiU" data-arg="${s}:${v}">x${v}</button>`).join('')}<button data-click="gaiU" data-arg="${s}:">нет</button></div>
  <button class="gai-go off" id="gG${s}" data-click="gaiGo" data-arg="${s}" disabled></button></div>`;
function build(){
  $('gaiC').innerHTML=`<div class="chips seg"><button id="gT1" class="a" data-click="gaiTab" data-arg="road">Заезд</button><button id="gT2" data-click="gaiTab" data-arg="top">Рекорды</button></div>
  <div id="gaiRoadP">
   <div class="gai-hist" id="gaiHist"></div>
   <div class="gai-road" id="gaiRoad">
    <div class="gai-lights"><i></i><i></i></div>
    <div class="gai-fence" id="gaiFence"></div>
    <div class="gai-lane" id="gaiLane"></div>
    <div class="gai-carw" id="gaiCar"></div>
    <div class="gai-cop">${COP}</div>
    <div class="gai-fl" id="gaiFl"></div>
    <div class="gai-hud"><b id="gaiX">…</b><span id="gaiK"></span></div>
   </div>
   <div class="gai-rail"><div class="gai-rt"><i id="gaiRf"></i></div>${GAI.posts.map((p,i)=>`<span class="gai-pt" id="gP${i}" style="left:${Math.min(100,Math.log(p)/Math.log(100)*100)}%">x${p}</span>`).join('')}</div>
   <div class="gai-bets">${GAI.slots.map(slot).join('')}</div>
   <p class="tl gai-note">Множитель — это скорость: x2 = 120 км/ч. Гаишник выходит в случайный момент, кто не успел забрать, теряет ставку. Автовывод сработает на сервере, даже если закрыть игру. Возврат ставок в среднем ${100-GAI.edge}%.</p>
   <h3 class="tsec" id="gaiFh">Ставки игроков</h3>
   <div id="gaiFeed"></div>
  </div>
  <div id="gaiTopP" style="display:none"></div>`}

// ---------- Обновление экрана ----------
let C={};   // что уже выведено: на DOM пишем только изменения
const txt=(id,v)=>{if(C[id]!==v){C[id]=v;const e=$(id);if(e)e.textContent=v}};
const cls=(id,c,on)=>{const k=id+'.'+c;if(C[k]!==on){C[k]=on;const e=$(id);if(e)e.classList.toggle(c,on)}};

function goState(s,v){
  const b=mine(s);
  if(v.ph=='bet')return b?['Отменить ставку · вернуть '+fmt(b.a)+' ₽','alt',false]:['Поставить · '+fmt(B[s].a||0)+' ₽','',false];
  if(v.ph=='run'){
    if(!b)return ['Ставки закрыты · ждите заезд','off',true];
    if(b.st=='won')return ['Вышел на '+fx(b.x)+' · +'+fmt(b.p)+' ₽','win',true];
    return ['Забрать · '+fmt(Math.floor(b.a*v.x))+' ₽','take',false]}
  if(v.ph=='crash'){
    if(!b)return ['Следующий заезд через '+Math.ceil(v.left),'off',true];
    if(b.st=='won')return ['Вышел на '+fx(b.x)+' · +'+fmt(b.p)+' ₽','win',true];
    return ['Остановили · −'+fmt(b.a)+' ₽','lose',true]}
  return ['…','off',true]}

function update(dt){
  const v=view(),run=v.ph=='run',cr=v.ph=='crash',road=$('gaiRoad');
  if(!road)return;
  // скорость ленты разметки: на заезде растёт вместе с множителем, на остановке гаснет
  const target=run?Math.min(1500,200*Math.sqrt(v.x)):0;
  V+=(target-V)*Math.min(1,dt*(cr?7:3));
  LANE+=V*dt;
  $('gaiLane').style.setProperty('--o',-LANE+'px');$('gaiFence').style.setProperty('--o',-LANE*.45+'px');
  cls('gaiRoad','run',run);cls('gaiRoad','bet',v.ph=='bet');
  if(S.fx<2)cls('gaiRoad','crash',cr);
  // табло: перед стартом — отсчёт, в заезде — множитель и км/ч, после остановки — где остановили
  if(v.ph=='bet'){txt('gaiX',String(Math.ceil(v.left)));txt('gaiK','Приём ставок')}
  else if(run){txt('gaiX',fx(v.x));txt('gaiK',Math.round(v.x*GAI.kmh)+' км/ч')}
  else if(cr){txt('gaiX',fx(v.x));txt('gaiK','Остановлен на '+Math.round(v.x*GAI.kmh)+' км/ч · следующий заезд через '+Math.ceil(v.left))}
  else{txt('gaiX','…');txt('gaiK','Подключаемся')}
  cls('gaiX','red',cr);
  // шкала постов ГАИ: логарифмическая, до x100
  const pos=run||cr?Math.min(100,Math.log(Math.max(1,v.x))/Math.log(100)*100):0;
  if(C.rf!==pos.toFixed(1)){C.rf=pos.toFixed(1);$('gaiRf').style.width=C.rf+'%'}
  GAI.posts.forEach((p,i)=>cls('gP'+i,'on',(run||cr)&&v.x>=p));
  if(run){while(PASSED<GAI.posts.length&&v.x>=GAI.posts[PASSED]){const p=GAI.posts[PASSED++];if(v.x<p*1.25)post(p)}}
  else if(v.ph=='bet')PASSED=0;
  // кнопки ставок
  for(const s of GAI.slots){
    const [t,c,d]=goState(s,v),b=mine(s),g=$('gG'+s);
    if(C['g'+s]!==t){C['g'+s]=t;g.textContent=t}
    if(C['gc'+s]!==c){C['gc'+s]=c;g.className='gai-go '+c}
    if(C['gd'+s]!==d){C['gd'+s]=d;g.disabled=d}
    txt('gS'+s,b?(b.au?'авто '+fx(b.au):'без автовывода'):'');
    for(const id of ['gA'+s,'gU'+s]){const k=id+'d',dis=!!b;if(C[k]!==dis){C[k]=dis;$(id).disabled=dis}}}}
function frame(ts){
  if(!active()){FR=0;return}
  const dt=LAST?Math.min(.1,(ts-LAST)/1000):0;LAST=ts;
  update(dt);FR=requestAnimationFrame(frame)}

// Машина игрока из гаража с его номером на бампере
function car(){
  const g=garageCar(),k=g?g.car.id+':'+(g.plate?g.plate.id:''):'none';
  if(k===CARKEY)return;CARKEY=k;
  if(!g){$('gaiCar').innerHTML=`<div class="gai-nocar"><b>Нужна машина</b><span>Машины выпадают из кейсов. Без неё в заезд не выехать.</span><button class="btn" data-click="go" data-arg="cases">Открыть кейс</button></div>`;return}
  const c=g.car,p=g.plate;
  $('gaiCar').innerHTML=`<div class="gcar" style="aspect-ratio:${c.ar}"><img src="${c.img}" alt="${esc(c.n)}">${p?`<div class="gpl pfit" style="left:${c.x}%;top:${c.y}%;width:${c.w*1.04}%" data-sy="${c.sy||1}"><div class="pin">${plateHTML(p)}</div></div>`:''}</div>`;
  fit('#gaiC')}

// Пост ГАИ: вспышка камеры, табличка, щелчок
function post(p){
  if(S.fx<2){
    lit($('gaiFl'),'on');
    const e=document.createElement('div');e.className='gai-post';e.textContent='ГАИ · x'+p;
    e.addEventListener('animationend',()=>e.remove());$('gaiRoad').appendChild(e)}
  beep(2200,.025,'square',.03);beep(1100,.05,'square',.02,.04);haptic('light')}
// Гаишник с жезлом: сирена и вибрация
function crashFx(s){
  haptic('heavy');setTimeout(()=>haptic('rigid'),160);
  [0,1,2,3,4,5].forEach(i=>beep(i%2?660:880,.2,'square',.025,i*.2));
  const lost=s.mine.some(m=>m.st=='lost');
  if(lost)setTimeout(()=>banner('Остановили на '+fx(s.r.cx),'Ставка потеряна'),300)}

// Списки: история заездов и лента ставок
function lists(){
  if(!$('gaiHist'))return;
  setHTML($('gaiHist'),HIST.slice(0,14).map(h=>`<span class="gai-h ${h.x>=2?'g':'r'}"><i></i>${fx(h.x)}</span>`).join('')||'<span class="tl">История появится после первого заезда</span>');
  if(!ST)return;
  const r=ST.r,ph=view().ph;
  txt('gaiFh',`Заезд №${r.id} · ${ST.n} ${plural(ST.n,'ставка','ставки','ставок')} · ${fmt(ST.sum)} ₽`);
  setHTML($('gaiFeed'),ST.feed.length?ST.feed.map(f=>`<div class="gai-f${f.me?' me':''}${f.x?' out':r.fin?' lost':''}"><b>${esc(f.n)}</b><span>${fmt(f.a)} ₽</span><em>${f.x?'вышел на '+fx(f.x)+' · +'+fmt(Math.floor(f.a*f.x))+' ₽':r.fin?'остановлен':ph=='bet'?'поставил':'в заезде'}</em></div>`).join('')
    :'<p class="tl" style="text-align:center">Пока никто не поставил. Будьте первым.</p>')}
const plural=(n,a,b,c)=>{const m=n%100,d=n%10;return m>10&&m<20?c:d==1?a:d>1&&d<5?b:c};

// ---------- Рекорды ----------
async function loadMe(){
  try{ME=await rpc('gai_me')}catch(e){console.warn('gai',e)}
  drawTop()}
function drawTop(){
  const el=$('gaiTopP');if(!el)return;
  if(!ME){el.innerHTML='<p class="tl" style="text-align:center">Загрузка…</p>';return}
  const st=ME.stats,net=(+st.won)-(+st.staked);
  setHTML(el,`<div class="card gai-st"><div><small>Лучший выход</small><b>${st.best_x?fx(st.best_x):'—'}</b></div><div><small>Ставок</small><b>${fmt(st.bets)}</b></div><div><small>Выходов</small><b>${st.bets?Math.round(st.wins*100/st.bets):0}%</b></div><div><small>Итог</small><b class="${net<0?'neg':'pos'}">${net>0?'+':net<0?'−':''}${fmt(Math.abs(net))} ₽</b></div></div>
   <h3 class="tsec">Топ дня по множителю</h3>
   ${ME.top.length?ME.top.map((t,i)=>`<div class="gai-f${t.me?' me':''} out"><b>${i+1}. ${esc(t.n)}</b><span>${fmt(t.a)} ₽</span><em>${fx(t.x)} · +${fmt(t.p)} ₽</em></div>`).join(''):'<p class="tl" style="text-align:center">За сутки ещё никто не вышел</p>'}
   <h3 class="tsec">Мои последние ставки</h3>
   ${ME.last.length?ME.last.map(l=>`<div class="gai-f ${l.x?'out':'lost'}"><b>${l.x?fx(l.x):'остановили'}</b><span>${fmt(l.a)} ₽</span><em>${l.x?'+'+fmt(l.p)+' ₽':'−'+fmt(l.a)+' ₽'} · стоп ${fx(l.c)}</em></div>`).join(''):'<p class="tl" style="text-align:center">Ставок пока нет</p>'}
   <button class="btn" style="width:100%;margin-top:10px" data-click="gaiMe">Обновить</button>`)}

// ---------- Действия ----------
const ERR={closed:['Приём ставок закончился','Дождитесь следующего заезда'],car:['Нужна машина','Откройте кейс и получите машину'],money:['Не хватает денег','Уменьшите ставку'],dup:['Ставка уже есть','Отмените её или дождитесь заезда'],bad:['Неверная ставка','Сумма и автовывод вне допустимых границ']};
async function place(s){
  if(!garageCar()){banner(...ERR.car);haptic('rigid');return}
  const a=B[s].a;
  if(!(a>=GAI.min&&a<=GAI.max)){banner('Сумма ставки','От '+fmt(GAI.min)+' до '+fmt(GAI.max)+' ₽');haptic('rigid');return}
  if(String(B[s].u).trim()&&!au(s)){banner('Автовывод','От '+fx(GAI.minAuto)+' до x'+GAI.cap);haptic('rigid');return}
  if(S.bal<a){banner(...ERR.money);haptic('rigid');return}
  const r=await api.gaiBet(s,a,au(s));
  if(r.err){banner(...(ERR[r.err]||['Не вышло','Попробуйте ещё раз']));haptic('rigid');kick();render(true);return}
  MUT=Date.now();
  ST.mine=ST.mine.filter(m=>m.s!=s).concat({s,a,au:au(s),x:null,p:0,st:'open'});
  haptic('light');beep(660,.06,'triangle',.04);render(true);kick()}
async function cancel(s){
  const r=await api.gaiCancel(s);
  if(r.err){banner('Отмена невозможна',r.err=='closed'?'Приём ставок закончился':'Ставки нет');kick();return}
  MUT=Date.now();ST.mine=ST.mine.filter(m=>m.s!=s);haptic('light');render(true);kick()}
async function cashout(s){
  const r=await api.gaiCashout(s);
  if(r.err=='crashed'){banner('Не успели','Остановили на '+fx(r.cx));haptic('rigid');kick();render(true);return}
  if(r.err){kick();render(true);return}
  MUT=Date.now();
  ST.mine=ST.mine.map(m=>m.s==s?{...m,x:+r.x,p:+r.p,st:'won'}:m);
  haptic('success');[988,1319].forEach((f,i)=>beep(f,.12,'triangle',.05,i*.1));
  banner('Вы вышли на '+fx(r.x),'+'+fmt(r.p)+' ₽');render(true);kick()}
async function go1(s){
  if(BZ[s]||!ST)return;
  const v=view(),b=mine(s);BZ[s]=1;
  try{
    if(v.ph=='bet')await(b?cancel(s):place(s));
    else if(v.ph=='run'&&b&&b.st=='open')await cashout(s)}
  catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');kick()}
  finally{BZ[s]=0}}

DRAW.gai=()=>{
  if(!$('gaiC').firstChild)build();
  car();fit('#gaiC');lists();if(TAB=='top')drawTop();
  start();update(0)};
window.addEventListener('resize',()=>fit('#gaiC'));
on({
  gaiGo:a=>go1(+a),
  gaiAmt:(a,el)=>{const s=+a;B[s].a=parseAsk(el.value)||0;save()},
  gaiFmt:(a,el)=>{const s=+a;if(B[s].a>0)el.value=fmt(B[s].a)},
  gaiAuto:(a,el)=>{B[+a].u=el.value;save()},
  gaiQ:a=>{
    const [s,k]=a.split(':'),n=+s,cur=B[n].a||GAI.min;
    B[n].a=k=='h'?Math.max(GAI.min,Math.floor(cur/2)):k=='d'?Math.min(GAI.max,cur*2):k=='n'?GAI.min:Math.max(GAI.min,Math.min(S.bal,GAI.max));
    $('gA'+n).value=fmt(B[n].a);save();C={}},
  gaiU:a=>{const [s,v]=a.split(':');B[+s].u=v;$('gU'+s).value=v;save()},
  gaiTab:a=>{TAB=a;$('gT1').classList.toggle('a',a=='road');$('gT2').classList.toggle('a',a=='top');
    $('gaiRoadP').style.display=a=='road'?'':'none';$('gaiTopP').style.display=a=='top'?'':'none';
    if(a=='top')loadMe();else{CARKEY='';car();fit('#gaiC')}},
  gaiMe:()=>loadMe()});
