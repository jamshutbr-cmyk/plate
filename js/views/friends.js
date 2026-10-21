import {api} from '../api.js';
import {REF} from '../config.js';
import {REF_LINK_BASE} from '../env.js';
import {haptic, askWriteAccess, TG} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {$, esc, fmt} from '../util.js';

// Экран «Друзья» (referral.sql): ссылка, лестница, друзья, журнал наград, рейтинг. Всё считает сервер, экран только показывает ответ ref_state.
// Состояния: загрузка (скелет), нет связи (кнопка «Повторить»), пусто, бан.
let ST=null,LOAD=false,ERR=false,BUSY=false,PER='week',TOP=null,OFF=0,CODE='',FR=[];
const ERRS={code:'Такого кода нет',self:'Нельзя ввести свой код',late:'Код можно ввести только в первые 24 часа и до 30 прокруток',already:'Вы уже привязаны к другу',banned:'Недоступно',cycle:'Этот код вам не подходит',
 locked:'Ступень ещё не достигнута',claimed:'Уже получено',review:'Награда на проверке',cancelled:'Награда отменена',hold:'Награда ещё в удержании',later:'Выдача перенесена: попробуйте позже',debt:'Сначала погасите долг',rub:'Не хватает рублей',nodebt:'Долга нет'};
const KIND={welcome:'Стартовый набор',stage1:'Друг освоился',stage2:'Друг играет',stage3:'Друг стал своим',ladder:'Ступень лестницы',donate:'Процент с доната',week:'Приз недели',revoke:'Отзыв награды'};
const STAT={hold:'в удержании',paid:'выдано',review:'в проверке',cancelled:'отменено'};
const FST={pending:'ждёт',active:'активен',hold:'в удержании',review:'в проверке',revoked:'отозван'};
const itemName=id=>(REF.items.find(x=>x.id==id)||{}).n||id;
const link=()=>{const b=(ST&&ST.link_base)||REF_LINK_BASE;return b&&ST?b+ST.code:''};
const dt=ms=>new Date(ms).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
const rw=r=>{const a=[];if(r.rub)a.push((r.rub>0?'+':'')+fmt(r.rub)+' ₽');if(r.luck)a.push('+'+r.luck+' прокрутов');for(const i of r.items||[])a.push(itemName(i));if(r.car)a.push('машина');if(r.plate)a.push('номер серии «Друзья»');if(r.named)a.push('именной номер');return a.join(', ')||'—'};
const ladRw=d=>{const r=d.reward||{},a=[];if(r.rub)a.push(fmt(r.rub)+' ₽');if(r.luck)a.push(r.luck+' прокрутов');for(const i of r.items||[])a.push(itemName(i));if(r.car)a.push('машина из гаража');if(r.plate)a.push(r.rare?'редкий номер серии «Друзья»':'номер серии «Друзья»');if(r.named)a.push('именной номер по заявке');return a.join(' · ')};

async function load(more){
  LOAD=true;ERR=false;
  try{ST=await api.refState(more?OFF:0);if(!more)FR=ST.friends||[];else FR=FR.concat(ST.friends||[])}
  catch(e){console.error(e);ERR=true}
  finally{LOAD=false}}
async function loadTop(){try{TOP=await api.refTop(PER)}catch(e){TOP=null}}

const dots=n=>`<span class="fr-dots">${[0,1,2,3].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`;
function card(){
  const l=link();
  return `<div class="fr-card fr-main"><div class="fr-nums"><div><b>${ST.invited}</b><small>приглашено</small></div><div><b>${ST.active}</b><small>активных</small></div></div>
   <div class="fr-code"><small>Ваш код</small><b>${esc(ST.code)}</b></div>
   ${l?`<div class="fr-link">${esc(l)}</div>`:`<div class="tl">Ссылка пока не настроена: отправьте другу код вручную.</div>`}
   <div class="fr-row"><button class="btn" data-click="frCopy">Скопировать</button><button class="btn fr-y" ${l?'':'disabled'} data-click="frShare">Поделиться</button></div>
   ${ST.boost>1?`<div class="fr-note y">Неделя друзей: награды ×${String(ST.boost).replace('.',',')}</div>`:''}
   ${ST.debt>0?`<div class="fr-note r">Долг по отозванным наградам: ${fmt(ST.debt)} ₽. Пока он не погашен, новых наград нет. <button class="btn" data-click="frDebt">Погасить из баланса</button></div>`:''}
   ${ST.dm?'':`<button class="btn fr-dm" data-click="frDm">Разрешить уведомления от бота</button>`}</div>`}
function ladder(){
  const next=ST.ladder.find(d=>d.state!='claimed')||null;
  const big=next?`<div class="fr-next"><small>Ближайшая награда · ${next.n} ${next.n==1?'друг':'друзей'}</small><b>${esc(ladRw(next))}</b><em>${Math.min(ST.active,next.n)} из ${next.n}</em><div class="fr-bar"><i style="width:${Math.min(100,ST.active/next.n*100)}%"></i></div></div>`:'';
  return `<div class="fr-card"><h3>Лестница</h3>${big}<div class="fr-lad">${ST.ladder.map(d=>{
    const btn=d.state=='ready'?`<button class="btn fr-y" data-click="frClaim" data-arg="${d.n}">Забрать</button>`:d.state=='hold'?`<small>с ${dt(d.at)}</small>`:d.state=='review'?`<small>в проверке</small>`:d.state=='claimed'?`<small>✓</small>`:'';
    return `<div class="fr-st ${d.state}"><b>${d.n}</b><span>${esc(ladRw(d))}</span>${btn}</div>`}).join('')}</div></div>`}
function friends(){
  if(!FR.length)return `<div class="fr-card"><h3>Мои друзья</h3><div class="tl" style="text-align:center;padding:14px 0">Позовите первого друга</div></div>`;
  return `<div class="fr-card"><h3>Мои друзья</h3>${FR.map(f=>`<div class="fr-fr"><div><b>${esc(f.nick)}</b><small>${dt(f.at)}</small></div>${dots(f.stage)}<span class="fr-s ${f.status}">${FST[f.status]}${f.status=='hold'&&f.until?' до '+dt(f.until):''}</span></div>`).join('')}
   ${ST.invited>FR.length&&FR.length%REF.page==0?`<button class="btn" data-click="frMore">Ещё</button>`:''}</div>`}
const ledger=()=>!ST.ledger.length?'':`<div class="fr-card"><h3>Журнал наград</h3>${ST.ledger.map(l=>`<div class="fr-lg"><div><b>${KIND[l.kind]||l.kind}${l.who?' · '+esc(l.who):''}</b><small>${rw(l)}</small></div><span class="fr-s ${l.status}">${STAT[l.status]||l.status}${l.status=='hold'&&l.until?' до '+dt(l.until):''}</span></div>`).join('')}</div>`;
function top(){
  const rows=TOP?TOP.rows:[];
  return `<div class="fr-card"><h3>Рейтинг приглашающих</h3><div class="chips">${[['week','Неделя'],['season','Сезон'],['all','Всё время']].map(([k,n])=>`<button class="${PER==k?'a':''}" data-click="frPer" data-arg="${k}">${n}</button>`).join('')}</div>
   ${rows.length?rows.map((r,i)=>`<div class="fr-tp${r.me?' me':''}"><span>${i+1}</span><b>${esc(r.nick)}</b><em>${r.n}</em></div>`).join(''):'<div class="tl" style="text-align:center">Пока никого</div>'}
   ${TOP&&TOP.me?`<div class="tl" style="text-align:center;margin-top:8px">Вы: ${TOP.me.n} · место ${TOP.me.rank}</div>`:''}</div>`}
const bindForm=()=>ST.can_bind?`<div class="fr-card"><h3>Код друга</h3><div class="tl">Если вас пригласили, но ссылка не сработала, введите код до ${dt(ST.bind_until)}.</div><div class="fr-row"><input class="gq" maxlength="8" autocomplete="off" placeholder="Код" value="${esc(CODE)}" data-input="frCode"><button class="btn fr-y" data-click="frBind">Применить</button></div></div>`:ST.referrer?`<div class="tl" style="text-align:center;margin-bottom:10px">Вас пригласил: ${esc(ST.referrer)}</div>`:'';
const rules=()=>`<div class="fr-card"><h3>Правила</h3><div class="tl">Награда выдаётся не за клик, а за этапы: ${REF.stages.slice(1).map(s=>s.t).join(' → ')}. Выдача идёт с удержанием (24–72 часа) и проверкой. Мультиаккаунты и накрутка запрещены (раздел 19 правил сообщества): награды отзываются, аккаунты блокируются.</div></div>`;

function draw(){
  const c=$('friendsC');if(!c)return;
  if(ERR&&!ST){c.innerHTML=`<div class="fr-card" style="text-align:center"><b>Нет связи</b><div class="tl">Не удалось загрузить экран</div><button class="btn" data-click="frRetry">Повторить</button></div>`;return}
  if(!ST){c.innerHTML=`<div class="fr-card fr-sk"></div><div class="fr-card fr-sk"></div>`;return}
  if(ST.banned){c.innerHTML=`<div class="fr-card" style="text-align:center"><b>Экран закрыт</b><div class="tl">Аккаунт заблокирован</div></div>`;return}
  if(ST.on===false){c.innerHTML=`<div class="fr-card" style="text-align:center"><b>Программа приостановлена</b></div>`;return}
  c.innerHTML=card()+bindForm()+ladder()+friends()+ledger()+top()+rules()}
function drawFriends(){
  draw();
  if(!ST&&!LOAD)load().then(()=>{draw();loadTop().then(draw)});
  else if(ST&&!LOAD&&!BUSY&&Date.now()-(ST._at||0)>30000){ST._at=Date.now();load().then(draw)}}
const badge=()=>{const e=$('frBadge');if(e)e.style.display=ST&&ST.ladder&&ST.ladder.some(d=>d.state=='ready')?'':'none'};

async function frCopy(){const t=link()||(ST&&ST.code)||'';try{await navigator.clipboard.writeText(t);banner('Скопировано',t)}catch(e){banner('Код',t)}haptic('light')}
function frShare(){const l=link();if(!l)return;const u='https://t.me/share/url?url='+encodeURIComponent(l)+'&text='+encodeURIComponent('Заходи в «Генератор номеров»: собирай редкие номера и получи стартовый набор');
  try{if(TG&&TG.openTelegramLink)TG.openTelegramLink(u);else window.open(u,'_blank')}catch(e){window.open(u,'_blank')}}
async function frClaim(n){
  if(BUSY)return;BUSY=true;
  try{const r=await api.refClaim(+n);if(r.err)banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');else{haptic('success');banner('Награда получена',rw(r.reward||{}))}await load();draw();render(true)}
  catch(e){console.error(e)}finally{BUSY=false}}
async function frBind(){
  if(BUSY||!CODE.trim())return;BUSY=true;
  try{const r=await api.refBind(CODE.trim());if(r.err)banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');else{banner('Готово','Стартовый набор выдан');CODE='';await load();render(true)}draw()}
  catch(e){console.error(e)}finally{BUSY=false}}
async function frDebt(){try{const r=await api.refDebtPay();if(r.err)banner('Не получилось',ERRS[r.err]||'Ошибка');else banner('Погашено',fmt(r.paid)+' ₽');await load();draw();render(true)}catch(e){console.error(e)}}
function frDm(){if(!askWriteAccess(ok=>{if(ok)api.refDm(true).then(()=>{if(ST)ST.dm=true;draw()})}))banner('Недоступно','Откройте игру в Telegram')}
async function frPer(p){PER=p;TOP=null;draw();await loadTop();draw()}
async function frMore(){OFF=FR.length;await load(true);draw()}
async function frRetry(){ERR=false;ST=null;draw();await load();draw();loadTop().then(draw)}
on({frCopy,frShare,frClaim,frBind,frDebt,frDm,frPer,frMore,frRetry,frCode:(a,el)=>{CODE=el.value.toUpperCase().replace(/[^A-Z0-9]/g,'');el.value=CODE}});
DRAW.friends=drawFriends;
import {painters} from '../router.js';
painters.push(badge);
// Фоновая загрузка при старте: нужна, чтобы бейдж «есть что забрать» на плитке был виден без захода на экран
export async function initFriends(){try{await load();badge()}catch(e){}}
