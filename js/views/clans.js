import {api} from '../api.js';
import {CLAN, clanCap, clanUpkeep} from '../config.js';
import {TG, haptic} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {burst, chime} from '../ui/fx.js';
import {banner, cm, sm} from '../ui/modal.js';
import {$, esc, fmt, parseAsk} from '../util.js';
import {bidPrev, mount, styleCls, tabRegions, tabShop} from './clanext.js';

// Кланы: экран «Клан». Правила, цены и права проверяет ТОЛЬКО сервер (supabase/clans.sql); CLAN в config.js нужен лишь для показа.
// Если клана нет: поиск и создание. Если есть: казна и улучшения, участники, заявки, настройки.
// Поля ввода не перерисовываются при наборе: обработчики input трогают только подсказку и состояние кнопки.
let EX=null;                                          // clan_ext: регионы, магазин, вид тега. null, пока clan_regions.sql не выполнен: вкладки скрыты
let CS=null,OFF=0,AT=0,LOAD=false,ERR=false;          // ответ clan_state, сдвиг часов сервера, время загрузки, идёт ли загрузка, ошибка
let TAB='main',NOTAB='find',BUSY=false,TM=null,FRESH=true;   // FRESH: плашка-номер «ставится» анимацией только при открытии экрана        // вкладки, защита от двойного нажатия, таймер отсчёта
let SQ='',SR=null,SMORE=false,SLOAD=false;             // поиск: запрос, результаты, есть ли ещё, идёт ли загрузка
let RK='season',LB=null,LBLOAD=false,LBERR=false;       // рейтинг кланов: вид, ответ сервера, загрузка, ошибка
let F={name:'',tag:'',mode:'open',min:'1'},DT='';      // форма создания и текст взноса
let ST={mode:'open',min:'1',tg:''};                    // черновик настроек клана

const MED=['🥇','🥈','🥉'],MODE={open:'открытый',request:'по заявке',closed:'закрытый'},ROLE={leader:'Глава',deputy:'Заместитель',member:'Участник'},RIC={leader:'👑',deputy:'🛡️',member:''};
const ERRS={level:'Уровень слишком мал',minlvl:'Ваш уровень ниже, чем требует клан',inclan:'Вы уже в клане',noclan:'Вы не в клане',name:'Название: 3–20 символов, буквы, цифры, пробел, дефис',tag:'Тег: 2–4 буквы или цифры',
 nametaken:'Такое название уже занято',tagtaken:'Такой тег уже занят',word:'Недопустимое слово в названии или теге',cooldown:'Пока нельзя: действует пауза',rub:'Не хватает рублей',usd:'Не хватает долларов',
 amount:'Взнос от '+fmt(CLAN.donateMin)+' ₽',treasury:'В казне не хватает денег',overdue:'Сначала нужно погасить содержание',maxlvl:'Максимальный уровень',full:'В клане нет мест',closed:'Набор закрыт',
 manyreq:'Не больше '+CLAN.maxReq+' заявок сразу',rolelimit:'Не больше '+CLAN.maxDeputies+' заместителей',denied:'Недостаточно прав',settings:'Проверьте настройки',link:'Ссылка должна начинаться с https://t.me/',
 reglimit:'Ставок на регионы не больше уровня клана',badregion:'Такого региона нет',owned:'Уже куплено',notowned:'Сначала купите это',baditem:'Такого товара нет',
 gone:'Это уже неактуально',leader:'Глава не может выйти: передайте власть или распустите клан'};

const fail=r=>{banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');haptic('rigid');return reload()};
const win=()=>{burst('#f5b82e',16);chime(1);haptic('success')};
async function act(f){if(BUSY)return;BUSY=true;try{return await f()}finally{BUSY=false}}
async function reload(){await load();render(true)}
async function load(){
  LOAD=true;
  try{
    CS=await api.clanState();OFF=CS.now-Date.now();ERR=false;
    if(CS.clan){ST={mode:CS.clan.mode,min:String(CS.clan.min_lvl),tg:CS.clan.tg||''};try{EX=await api.clanExt()}catch(e){EX=null}}else EX=null}
  catch(e){console.error(e);ERR=true}
  LOAD=false;AT=Date.now()}

// ---------- время ----------
const left=ts=>Math.max(0,+ts-(Date.now()+OFF));
function fmtLeft(ms){const s=Math.ceil(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?`${d} д ${h} ч`:h?`${h} ч ${m} мин`:`${m} мин ${s%60} с`}
const cd=ts=>`<b class="cl-cd" data-end="${ts}">${fmtLeft(left(ts))}</b>`;
const dt=ts=>new Date(+ts).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit'});
const ago=ts=>{const d=Math.floor((Date.now()+OFF-ts)/864e5);return d>=3?d+' дн.':''};
function tick(){
  if(!$('v-clans').classList.contains('on')){clearInterval(TM);TM=null;FRESH=true;return}
  document.querySelectorAll('#clanC .cl-cd').forEach(e=>{e.textContent=fmtLeft(left(+e.dataset.end))})}

// ---------- общие куски ----------
// Клан — это номерной знак: тег на месте номера, уровень в графе региона, цвет по уровню как у редкостей номеров (серый, зелёный, синий, фиолетовый, золото)
const LV=l=>'c'+Math.min(4,Math.max(0,l-1));
export const plate=(tag,l,k='')=>`<span class="mp ${LV(l)} ${k}"><span>${esc(tag)}</span><em>${l}</em></span>`;
export const ctagHTML=t=>t&&t.tag?`<span class="ctag"><span class="mp cl-sm${styleCls(t.fr,t.fx)}"><span>${esc(t.tag)}</span></span>${t.medal?`<i>${MED[t.medal-1]}</i>`:''}</span>`:'';
const sec=(h,k='')=>`<section class="cl-sec ${k}">${h}</section>`;
const seg=(items,cur,click)=>`<div class="cl-seg">${items.map(([k,n])=>`<button class="${cur==k?'a':''}" data-click="${click}" data-arg="${k}">${n}</button>`).join('')}</div>`;
const pts=n=>Math.floor((+n||0)/CLAN.pt);
const ini=n=>([...(n||'И')][0]||'И').toUpperCase();
const pv=()=>`${plate(F.tag.trim()||'ТЕГ',1,'cl-xl')}<h2>${esc(F.name.trim()||'Название клана')}</h2>`;

// ---------- рейтинг и просмотр чужих кланов ----------
const RKS=[['season','За сезон'],['level','По уровню'],['new','Новые']];
const dfull=ts=>new Date(+ts).toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'2-digit'});
function rkRow(c,kind){
  const num=kind=='new'?(c.srk?'#'+c.srk:''):c.rk,top=kind!='new'&&c.rk<=3?MED[c.rk-1]:num;
  const meta=kind=='new'?`создан ${dfull(c.created)} · ${c.srk} место в сезоне`:kind=='level'?`${c.lvl} ур. · ${c.n}/${c.cap}`:`${fmt(c.pts)} очк. · ${c.lvl} ур. · ${c.n}/${c.cap}`;
  return `<div class="cl-rk${c.mine?' me':''}" data-click="clView" data-arg="${c.id}"><span class="cl-n">${top}</span>${plate(c.tag,c.lvl,'cl-md-p')}\
<div class="cl-fi"><b>${esc(c.name)}${c.medal?` <span class="cl-mdl">${MED[c.medal-1]}</span>`:''}${c.mine?' (ваш)':''}</b><div class="cl-fm">${meta}</div></div><i class="cl-ch">›</i></div>`}
function tabRating(){
  const body=LBERR?`<p class="cl-empty">Не удалось загрузить рейтинг</p><button class="cl-ghost wide" data-click="clRkRetry">Повторить</button>`
    :LB==null||LB.kind!=RK?`<p class="cl-empty">Загружаю рейтинг…</p>`
    :LB.top.length?LB.top.map(c=>rkRow(c,RK)).join('')+(LB.me&&!LB.top.some(c=>c.mine)?`<p class="cl-fine cl-gap">Ваш клан</p>${rkRow(LB.me,RK)}`:'')
    :`<p class="cl-empty">${RK=='season'?'На этой неделе ещё никто не вносил в казну.':'Кланов пока нет.'}</p>`;
  return sec(`<h3>Рейтинг кланов</h3>${seg(RKS,RK,'clRk')}`
    +(RK=='season'?`<p class="cl-fine cl-gap">Очки дают только взносы. Сезон закончится через ${LB&&LB.kind==RK?cd(LB.season_end):'…'}</p>`:RK=='new'?`<p class="cl-fine cl-gap">Последние созданные кланы. Нажмите на клан, чтобы посмотреть состав.</p>`:'')
    +`<div class="cl-rks">${body}</div>`)}
async function loadRating(){
  if(LBLOAD)return;LBLOAD=true;const k=RK;
  try{LB=await api.clanLeaderboard(k);LBERR=false}catch(e){console.error(e);LBERR=true}
  LBLOAD=false;render(true)}
function clanCard(v){
  const can=!CS.clan&&v.mode!='closed',req=(CS.reqs||[]).includes(v.id),full=v.members.length>=v.cap,now=Date.now()+OFF,jw=CS.cd&&CS.cd.join&&+CS.cd.join>now;
  const btn=v.mine?'':CS.clan?'':req?`<button class="btn" data-click="clCancelReq" data-arg="${v.id}">Отозвать заявку</button>`
    :!can?`<button class="btn" disabled>${v.mode=='closed'?'Набор закрыт':'Вступить нельзя'}</button>`
    :`<button class="btn" ${full||jw||S.lvl<CLAN.joinLvl||S.lvl<v.min_lvl?'disabled ':''}data-click="clJoin" data-arg="${v.id}">${full?'Мест нет':v.mode=='open'?'Вступить':'Подать заявку'}</button>`;
  return `<div class="dlg cl-card"><div class="cl-pw">${plate(v.tag,v.lvl,'cl-xl')}${v.medal?`<span class="cl-md">${MED[v.medal-1]}</span>`:''}</div><h3>${esc(v.name)}</h3>
    <p class="tl">${v.srk} место в сезоне · ${fmt(v.pts)} очк. · ${v.lvl} ур. · ${MODE[v.mode]}${v.min_lvl>1?', от '+v.min_lvl+' ур.':''}<br>Создан ${dfull(v.created)} · ${v.members.length}/${v.cap} участников</p>
    <div class="cl-cm">${v.members.map(m=>`<div class="cl-cmr"><span>${RIC[m.role]||''} ${esc(m.nick||'Игрок')}</span><em>${m.lvl} ур.</em><b>${fmt(m.donated)} ₽</b></div>`).join('')}</div>
    ${btn}<button class="btn" data-click="cm">Закрыть</button></div>`}
async function viewClan(id){
  if(BUSY)return;BUSY=true;
  try{const v=await api.clanView(+id);sm(clanCard(v))}
  catch(e){console.error(e);banner('Не получилось','Клан не найден или нет связи')}
  finally{BUSY=false}}

// ---------- клана нет ----------
const nameOk=s=>{s=s.trim().replace(/\s+/g,' ');return s.length>=CLAN.name[0]&&s.length<=CLAN.name[1]&&/^[A-Za-zА-Яа-яЁё0-9][A-Za-zА-Яа-яЁё0-9 _-]*$/.test(s)};
const tagOk=s=>/^[A-Za-zА-Яа-яЁё0-9]{2,4}$/.test(s.trim());
const canCreate=()=>S.lvl>=CLAN.createLvl&&S.bal>=CLAN.createRub&&S.usd>=CLAN.createUsd&&nameOk(F.name)&&tagOk(F.tag);

function clanRow(c,jw){
  const req=(CS.reqs||[]).includes(c.id),full=c.n>=c.cap;
  const btn=req?`<button class="cl-ghost sm" data-click="clCancelReq" data-arg="${c.id}">Отозвать</button>`
    :c.mode=='closed'?`<button class="cl-ghost sm" disabled>Закрыт</button>`
    :full?`<button class="cl-ghost sm" disabled>Мест нет</button>`
    :`<button class="cl-go sm" ${S.lvl<CLAN.joinLvl||S.lvl<c.min_lvl||jw?'disabled ':''}data-click="clJoin" data-arg="${c.id}">${c.mode=='open'?'Вступить':'Заявка'}</button>`;
  return `<div class="cl-find"><div class="cl-fh">${plate(c.tag,c.lvl,'cl-md-p')}<div class="cl-fi"><b>${esc(c.name)}${c.medal?` <span class="cl-mdl">${MED[c.medal-1]}</span>`:''}</b>
    <div class="cl-fm">${c.n}/${c.cap} · ${MODE[c.mode]}${c.min_lvl>1?` · ${c.min_lvl}+ ур.`:''}</div></div></div>${btn}</div>`}

function findForm(jw){
  return `<div class="cl-search"><input class="gq" id="clQ" placeholder="Название или тег" maxlength="20" autocomplete="off" value="${esc(SQ)}" data-input="clQ" data-change="clFind"><button class="cl-go" data-click="clFind">Найти</button></div>`
    +(S.lvl<CLAN.joinLvl?`<p class="cl-warn">Вступать можно с ${CLAN.joinLvl} уровня, у вас ${S.lvl}.</p>`:'')
    +(SR==null?`<p class="cl-empty">Загружаю список…</p>`
      :SR.clans.length?SR.clans.map(c=>clanRow(c,jw)).join('')+(SMORE?`<button class="cl-ghost wide" data-click="clMore">Показать ещё</button>`:'')
      :`<p class="cl-empty">Ничего не нашлось. Создайте свой клан.</p>`)}

const need=(ok,t)=>`<li class="${ok?'ok':'bad'}">${t}</li>`;
function createForm(cw,cdc){
  return (cw?`<p class="cl-warn">Новый клан можно создать через ${cd(cdc.create)}.</p>`:'')
    +`<div class="cl-pv" id="clPv">${pv()}</div>
    <label class="cl-lb">Название</label><input class="gq" maxlength="${CLAN.name[1]}" autocomplete="off" placeholder="Ночные тачки" value="${esc(F.name)}" data-input="clF" data-arg="name">
    <label class="cl-lb">Тег, ${CLAN.tag[0]}–${CLAN.tag[1]} символа</label><input class="gq" maxlength="${CLAN.tag[1]}" autocomplete="off" placeholder="НТ" value="${esc(F.tag)}" data-input="clF" data-arg="tag">
    <label class="cl-lb">Набор</label>${seg(Object.entries(MODE),F.mode,'clMode')}
    <label class="cl-lb">Минимальный уровень</label><input class="gq" inputmode="numeric" maxlength="2" value="${esc(F.min)}" data-input="clF" data-arg="min">
    <ul class="cl-need">${need(S.lvl>=CLAN.createLvl,'Уровень '+CLAN.createLvl+'+')}${need(S.bal>=CLAN.createRub,fmt(CLAN.createRub)+' ₽')}${need(S.usd>=CLAN.createUsd,CLAN.createUsd+' $')}</ul>
    <p class="cl-fine">Деньги сгорают. На старте ${clanCap(1)} мест.</p>
    <button class="cl-go wide" id="clGo" ${canCreate()&&!cw?'':'disabled '}data-click="clCreate">Создать клан</button>`}

function noClan(){
  const now=Date.now()+OFF,c=CS.cd||{},jw=c.join&&+c.join>now,cw=c.create&&+c.create>now;
  return `<section class="cl-intro"><h2>Кланы</h2><p>Общая казна, ваш тег рядом с ником и медали лучшим кланам недели.</p></section>`
    +(jw?`<p class="cl-warn">Вступить снова можно через ${cd(c.join)}.</p>`:'')
    +`<div class="cl-tabs">${[['find','Найти клан'],['top','Рейтинг'],['new','Создать свой']].map(([k,n])=>`<button class="${NOTAB==k?'a':''}" data-click="clNo" data-arg="${k}">${n}</button>`).join('')}</div>`
    +(NOTAB=='new'?createForm(cw,c):NOTAB=='top'?tabRating():findForm(jw))}

// ---------- свой клан ----------
const logLine=l=>{
  const who=esc(l.nick||'Игрок');
  const [ic,t,a]=l.k=='donate'?['+',who,'+'+fmt(l.amt)+' ₽']:l.k=='upgrade'?['▲',`${who} поднял клан до ${l.lvl} ур.`,'−'+fmt(l.amt)+' ₽']
    :l.k=='upkeep'?['−','Содержание клана','−'+fmt(l.amt)+' ₽']:l.k=='bid'?['▲',`${who}: ставка на регион`,'−'+fmt(l.amt)+' ₽']:l.k=='shop'?['★',`${who}: покупка в магазине`,'−'+fmt(l.amt)+' ₽']:['▼',`Просрочка: клан опустился до ${l.lvl} уровня`,''];
  return `<div class="cl-led ${l.k}"><i>${ic}</i><span>${t}</span><b>${a}</b><em>${dt(l.ts)}</em></div>`};

function ladder(c){
  return `<div class="cl-lad">${[1,2,3,4,5].map(l=>`<div class="${l<c.lvl?'done':l==c.lvl?'cur':''}"><span class="mp cl-sm ${LV(l)}"><span>${l}</span></span><small>${clanCap(l)} мест</small></div>`).join('')}</div>`}

function tabMain(c,mgr){
  const nx=CLAN.up[c.lvl+1],mx=Math.max(S.bal,0);
  const chips=[['1 млн',1e6],['10 млн',1e7],['100 млн',1e8],['1 млрд',1e9]].filter(([,v])=>v<=mx).map(([l,v])=>`<button data-click="clChip" data-arg="${v}">${l}</button>`).join('')
    +(mx>=CLAN.donateMin?`<button data-click="clChip" data-arg="${mx}">Всё</button>`:'');
  const up=sec(`<h3>Уровень клана</h3>${ladder(c)}`+(nx?`<p class="cl-fine cl-nx">До ${c.lvl+1} уровня: ${clanCap(c.lvl+1)} мест</p>
      <div class="cl-gauge"><i style="width:${Math.min(100,c.treasury/nx*100)}%"></i></div><div class="cl-gl"><span>${fmt(c.treasury)} ₽</span><span>${fmt(nx)} ₽</span></div>
      ${mgr?`<button class="cl-go wide" ${c.treasury>=nx&&!c.lapsed?'':'disabled '}data-click="clUpAsk">Поднять до ${c.lvl+1} уровня</button>`:`<p class="cl-fine">Поднимает глава или заместитель.</p>`}`
    :`<p class="cl-fine cl-nx">Максимальный уровень</p>`));
  return sec(`<h3>Внести в казну</h3><p class="cl-fine">Деньги сгорают. ${fmt(CLAN.pt)} ₽ = 1 очко сезона.</p>
      <div class="cl-chips">${chips}</div>
      <input class="gq" id="clAmt" inputmode="text" placeholder="Сумма, например 5м" maxlength="16" autocomplete="off" value="${esc(DT)}" data-input="clAmt">
      <div class="cl-prev" id="clPrev"></div><button class="cl-go wide" id="clDon" disabled data-click="clDonate">Внести в казну</button>`,'burn')
    +up
    +sec(`<h3>Журнал казны</h3>`+(CS.log.length?`<div class="cl-leds">${CS.log.slice(0,6).map(logLine).join('')}</div>`:`<p class="cl-fine">Пока пусто.</p>`))
    +`<details class="cl-rules"><summary>Как работает сезон</summary><p>Неделя с понедельника 00:00 UTC. Очки дают только взносы. Топ-3 кланов получают медаль у тега.</p></details>`}

function tabMembers(c){
  const lead=c.role=='leader',dep=c.role=='deputy',mx=Math.max(1,...CS.members.map(m=>+m.donated));
  return sec(`<h3>Участники · ${c.members}/${c.cap}</h3>`+CS.members.map(m=>{
    const me=!!m.me,can=!me&&(lead||(dep&&m.role=='member')),a=ago(m.seen);
    return `<div class="cl-mem${me?' me':''}${can?' tap':''}" style="--sh:${(m.donated/mx*100).toFixed(1)}%"${can?` data-click="clMember" data-arg="${m.id}"`:''}>
      <span class="cl-av ${m.role}">${esc(ini(m.nick))}</span><div class="cl-i"><b>${esc(m.nick||'Игрок')}${me?' (вы)':''}</b><span>${m.role=='member'?'':ROLE[m.role]+', '}уровень ${m.lvl}${a?`, <u>был ${a} назад</u>`:''}</span></div>
      <div class="cl-am"><b>${fmt(m.donated)} ₽</b></div>${can?'<i class="cl-ch">›</i>':''}</div>`}).join(''))}

function tabReqs(){
  return sec(`<h3>Заявки · ${CS.requests.length}</h3>`+(CS.requests.length?CS.requests.map(r=>
    `<div class="cl-mem"><span class="cl-av member">${esc(ini(r.nick))}</span><div class="cl-i"><b>${esc(r.nick||'Игрок')}</b><span>уровень ${r.lvl}</span></div><button class="cl-go sm" data-click="clAcc" data-arg="${r.id}">Принять</button><button class="cl-ghost sq" aria-label="Отклонить" data-click="clDec" data-arg="${r.id}">✕</button></div>`).join('')
    :`<p class="cl-fine">Заявок нет.</p>`))}

function tabSet(c){
  const lead=c.role=='leader';
  return (c.tg?sec(`<button class="cl-ghost wide" data-click="clTg">Чат клана в Telegram</button>`):'')
    +(lead?sec(`<h3>Настройки клана</h3><label class="cl-lb">Набор</label>${seg(Object.entries(MODE),ST.mode,'clSetMode')}
      <label class="cl-lb">Минимальный уровень</label><input class="gq" inputmode="numeric" maxlength="2" value="${esc(ST.min)}" data-input="clSet" data-arg="min">
      <label class="cl-lb">Чат клана</label><input class="gq" maxlength="64" autocomplete="off" placeholder="https://t.me/..." value="${esc(ST.tg)}" data-input="clSet" data-arg="tg">
      <button class="cl-go wide" data-click="clSave">Сохранить настройки</button>`)
      :sec(`<h3>О клане</h3><p class="cl-fine">Набор: ${MODE[c.mode]}${c.min_lvl>1?', от '+c.min_lvl+' ур.':''}</p>`))
    +sec(lead?`<h3>Власть</h3><p class="cl-fine">Чтобы выйти, передайте власть участнику: нажмите на него в списке.</p><button class="cl-danger wide" data-click="clDisbandAsk">Распустить клан</button>`
      :`<button class="cl-danger wide" data-click="clLeaveAsk">Выйти из клана</button><p class="cl-fine">После выхода ${CLAN.joinCdH} ч нельзя вступать в кланы.</p>`,'last')}

function inClan(){
  const c=CS.clan,mgr=c.role!='member',weeks=Math.floor(c.treasury/c.upkeep);
  const drop=c.lvl>1?`уровень пропадёт через ${cd(+c.due+CLAN.upkeepDays*864e5)}`:`уровень не упадёт`;
  const tabs=[['main','Казна'],['mem','Участники'],...(mgr?[['req','Заявки'+(CS.requests.length?`<sup>${CS.requests.length}</sup>`:'')]]:[]),...(EX?[['reg','Регионы'],['shop','Магазин']]:[]),['top','Рейтинг'],['set','Клан']];
  if(!tabs.some(t=>t[0]==TAB))TAB='main';
  const who={leader:'Глава',deputy:'Заместитель',member:'Участник'}[c.role];
  return `<section class="cl-top${FRESH?' fresh':''}"><div class="cl-pw">${plate(c.tag,c.lvl,'cl-xl'+(EX?styleCls((EX.style||{}).frame,(EX.style||{}).fx):''))}${c.medal?`<span class="cl-md">${MED[c.medal-1]}</span>`:''}</div>
      <h2>${esc(c.name)}</h2><p class="cl-sub">${who} · ${c.members}/${c.cap}</p></section>
    <div class="cl-ledger"><div class="main"><span>В казне</span><b>${fmt(c.treasury)}<small>₽</small></b></div><div><span>Очки</span><b>${fmt(pts(c.season_donated))}</b></div><div><span>До конца сезона</span>${cd(CS.season_end)}</div></div>`
    +(c.lapsed?`<div class="cl-alert"><b>Содержание просрочено</b><span>Нужно ${fmt(c.upkeep)} ₽: ${drop}.</span></div>`
      :`<p class="cl-fine cl-up">Содержание ${fmt(c.upkeep)} ₽ через ${cd(c.due)} · хватит на ${weeks} нед.</p>`)
    +`<div class="cl-tabs">${tabs.map(([k,n])=>`<button class="${TAB==k?'a':''}" data-click="clTab" data-arg="${k}">${n}</button>`).join('')}</div>`
    +(TAB=='mem'?tabMembers(c):TAB=='req'?tabReqs():TAB=='reg'?tabRegions(c,mgr):TAB=='shop'?tabShop(c,mgr):TAB=='set'?tabSet(c):TAB=='top'?tabRating():tabMain(c,mgr))}

// ---------- отрисовка ----------
export function drawClans(){
  const el=$('clanC'),typing=document.activeElement&&el.contains(document.activeElement)&&document.activeElement.tagName=='INPUT';
  if(!CS){
    if(ERR){el.innerHTML=`<p class="tl" style="text-align:center">Не удалось загрузить кланы</p><button class="btn" style="width:100%" data-click="clRetry">Повторить</button>`;return}
    if(!LOAD)load().then(()=>render(true));
    el.innerHTML=`<p class="tl" style="text-align:center">Загрузка…</p>`;return}
  if(!LOAD&&!typing&&Date.now()-AT>30000)load().then(()=>render(true));
  if(!CS.clan&&NOTAB=='find'&&SR==null&&!SLOAD)search(0);
  if((CS.clan?TAB:NOTAB)=='top'&&!LBLOAD&&!LBERR&&(!LB||LB.kind!=RK))loadRating();
  el.innerHTML=CS.clan?inClan():noClan();
  FRESH=false;donPrev();if(CS.clan)bidPrev(CS.clan);
  if(!TM)TM=setInterval(tick,1000)}

async function search(off){
  SLOAD=true;
  try{const d=await api.clanSearch(SQ.trim(),off);SR=off&&SR?{clans:[...SR.clans,...d.clans]}:d;SMORE=!!d.more}
  catch(e){console.error(e);SR={clans:[]};SMORE=false}
  SLOAD=false;render(true)}

function donPrev(){
  const p=$('clPrev'),b=$('clDon');if(!p||!b)return;
  const n=Math.floor(parseAsk(DT)),ok=n>=CLAN.donateMin&&n<=S.bal;
  p.className='cl-prev'+(ok?' ok':'');
  p.textContent=!DT.trim()?`От ${fmt(CLAN.donateMin)} ₽`:n<CLAN.donateMin?`Взнос от ${fmt(CLAN.donateMin)} ₽`:n>S.bal?'Не хватает рублей':`+${fmt(pts(n))} очк. сезона`;
  b.disabled=!ok}

// ---------- действия ----------
const memberById=id=>CS.members.find(m=>m.id==id);
async function donate(n){
  cm();
  await act(async()=>{
    const r=await api.clanDonate(n);
    if(r.err)return fail(r);
    DT='';win();banner('Взнос принят','−'+fmt(n)+' ₽ · +'+fmt(pts(n))+' очк.');await reload()})}
function openMember(id){
  const m=memberById(id);if(!m)return;
  const lead=CS.clan.role=='leader';
  sm(`<div class="dlg"><h3>${esc(m.nick||'Игрок')}</h3><p class="tl">${ROLE[m.role]} · уровень ${m.lvl} · внёс ${fmt(m.donated)} ₽</p>
    ${lead?(m.role=='deputy'?`<button class="btn" data-click="clRole" data-arg="${m.id}:member">Разжаловать до участника</button>`:`<button class="btn" data-click="clRole" data-arg="${m.id}:deputy">Назначить заместителем</button>`)
      +`<button class="btn" data-click="clTransferAsk" data-arg="${m.id}">Передать власть</button>`:''}
    <button class="btn red" data-click="clKickAsk" data-arg="${m.id}">Исключить</button><button class="btn" data-click="cm">Закрыть</button></div>`)}
const dlg=(t,x,go,arg,btn,red=1)=>sm(`<div class="dlg"><h3>${t}</h3><p class="tl">${x}</p><button class="btn${red?' red':''}" data-click="${go}"${arg!=null?` data-arg="${arg}"`:''}>${btn}</button><button class="btn" data-click="cm">Отмена</button></div>`);
const run=(f,ok,pre)=>act(async()=>{cm();const r=await f();if(r.err)return fail(r);haptic('success');if(ok)banner(ok[0],ok[1]);if(pre)pre();await reload()});

on({
  cm,
  clRetry:()=>{ERR=false;CS=null;render(true)},
  clNo:k=>{NOTAB=k;if(k=='top')LB=null;render(true)},
  clRk:k=>{RK=k;LB=null;LBERR=false;render(true)},
  clRkRetry:()=>{LBERR=false;LB=null;render(true)},
  clView:viewClan,
  clTab:k=>{TAB=k;if(k=='top')LB=null;render(true)},
  clF:(k,el)=>{F[k]=el.value;const b=$('clGo');if(b)b.disabled=!canCreate();const v=$('clPv');if(v)v.innerHTML=pv()},
  clMode:k=>{F.mode=k;render(true)},
  clQ:(_,el)=>{SQ=el.value},
  clFind:()=>{const q=$('clQ');if(q)SQ=q.value;SR=null;search(0)},
  clMore:()=>search(SR?SR.clans.length:0),
  clJoin:id=>act(async()=>{
    const r=await api.clanJoin(+id);
    if(r.err)return fail(r);
    cm();win();banner(r.res=='joined'?'Вы в клане':'Заявка отправлена',r.res=='joined'?'Добро пожаловать!':'Ждите решения главы');
    SR=null;LB=null;await reload()}),
  clCancelReq:id=>act(async()=>{const r=await api.clanCancelRequest(+id);if(r.err)return fail(r);cm();await reload()}),
  clCreate:()=>act(async()=>{
    if(!canCreate())return;
    const r=await api.clanCreate(F.name.trim().replace(/\s+/g,' '),F.tag.trim(),F.mode,Math.max(1,Math.min(99,parseInt(F.min)||1)));
    if(r.err)return fail(r);
    F={name:'',tag:'',mode:'open',min:'1'};TAB='main';SR=null;win();banner('Клан создан','Вы глава клана');await reload()}),
  clAmt:(_,el)=>{DT=el.value;donPrev()},
  clChip:v=>{DT=String(v);render(true)},
  clDonate:()=>{
    const n=Math.floor(parseAsk(DT));if(!(n>=CLAN.donateMin&&n<=S.bal))return;
    if(n>=1e8||n*2>=S.bal)dlg('Внести '+fmt(n)+' ₽?','Деньги уйдут в казну клана и исчезнут из игры. Вернуть их нельзя никому.','clDonateGo',n,'Внести',0);
    else donate(n)},
  clDonateGo:n=>donate(+n),
  clUpAsk:()=>{const c=CS.clan;dlg('Улучшить клан до '+(c.lvl+1)+' уровня?','Из казны спишется '+fmt(CLAN.up[c.lvl+1])+' ₽, они сгорят. Содержание вырастет до '+fmt(clanUpkeep(c.lvl+1))+' ₽ в неделю.','clUpgrade',null,'Улучшить',0)},
  clUpgrade:()=>run(()=>api.clanUpgrade(),['Клан улучшен','Новых мест больше']),
  clMember:openMember,
  clRole:a=>{const [id,role]=a.split(':');return run(()=>api.clanSetRole(id,role),[role=='deputy'?'Назначен заместитель':'Разжалован',''])},
  clKickAsk:id=>{const m=memberById(id);dlg('Исключить '+esc((m&&m.nick)||'игрока')+'?','Он не сможет вступить в клан '+CLAN.joinCdH+' ч. Внесённые им деньги останутся в казне.','clKick',id,'Исключить')},
  clKick:id=>run(()=>api.clanKick(id),['Участник исключён','']),
  clTransferAsk:id=>{const m=memberById(id);dlg('Передать власть?','Новым главой станет '+esc((m&&m.nick)||'игрок')+'. Вы станете заместителем (если места нет, участником).','clTransfer',id,'Передать')},
  clTransfer:id=>run(()=>api.clanTransfer(id),['Власть передана','']),
  clAcc:id=>act(async()=>{const r=await api.clanResolve(id,true);if(r.err)return fail(r);if(r.res=='gone')banner('Заявка неактуальна','');else win();await reload()}),
  clDec:id=>act(async()=>{const r=await api.clanResolve(id,false);if(r.err)return fail(r);await reload()}),
  clSetMode:k=>{ST.mode=k;render(true)},
  clSet:(k,el)=>{ST[k]=el.value},
  clSave:()=>act(async()=>{
    const r=await api.clanSettings(ST.mode,Math.max(1,Math.min(99,parseInt(ST.min)||1)),ST.tg.trim());
    if(r.err)return fail(r);
    banner('Сохранено','');haptic('success');await reload()}),
  clTg:()=>{const u=CS&&CS.clan&&CS.clan.tg;if(!u)return;try{TG&&TG.openTelegramLink?TG.openTelegramLink(u):window.open(u,'_blank')}catch(e){window.open(u,'_blank')}},
  clLeaveAsk:()=>dlg('Выйти из клана?','Внесённые деньги останутся в казне. Вступить в другой клан можно будет через '+CLAN.joinCdH+' ч.','clLeave',null,'Выйти'),
  clLeave:()=>run(()=>api.clanLeave(),['Вы вышли из клана',''],()=>{SR=null;NOTAB='find'}),
  clDisbandAsk:()=>dlg('Распустить клан?','Казна пропадёт без возврата, все участники выйдут. Создать новый клан можно будет через '+CLAN.createCdH+' часа.','clDisband',null,'Распустить'),
  clDisband:()=>run(()=>api.clanDisband(),['Клан распущен',''],()=>{SR=null;NOTAB='find'})
});
mount({ex:()=>EX||{},clan:()=>CS&&CS.clan,seasonEnd:()=>CS&&CS.season_end,myTitle:()=>S.equip&&S.equip.title,sec,plate,cd,cm,act,fail,win,reload,dlg,render:()=>render(true)});
DRAW.clans=drawClans;
