import {HW, RAR, hwGuard} from '../config.js';
import {fake} from '../engine.js';
import {haptic, tgUser} from '../platform.js';
import {DRAW, go} from '../router.js';
import {handleBan, loadPlayer, rpc, sb} from '../server.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {beep, burst, dropSound} from '../ui/fx.js';
import {banner, cm, sm} from '../ui/modal.js';
import {dots, nickCls, plateHTML, titleHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';
import {pName} from './profile.js';
import {hwText} from '../ui/hwplate.js';
import {hwMusicInit} from '../ui/hwmusic.js';

// Экран ивента «Ночь тыкв»: отдельный режим со своей валютой 🎃 и своими номерами.
// Шесть вкладок: прокрут, коллекция, алтарь (хранители и награды), задания (подарок, задания, обмен), профиль, топ.
// Шансы, цены, награды и лимиты считает только сервер (supabase/hw.sql, функция hw-roll); здесь данные для показа
// и действия игрока. Из режима нет дороги в рынок, магазин, банк и прочее: нижняя панель ведёт только по этим вкладкам.
// Вёрстка: css/hw.css. Все классы с префиксом hw-, чтобы не пересекаться с остальной игрой.
const COLS='id,country,type,main,reg,region_name,cls,mu,price,curse,guardian,pv,created_at';
// Значки нижней панели: свои SVG вместо системных эмодзи (рисуются цветом текста кнопки, поэтому одинаково выглядят на всех устройствах)
const IC=d=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const TABS=[
 ['roll',IC('<path d="M12 7.5C10.5 6.3 8.2 6.3 6.6 7.6 4.9 9 4 11 4 13.2c0 3.6 3.6 6.3 8 6.3s8-2.7 8-6.3c0-2.2-.9-4.2-2.6-5.6-1.6-1.3-3.9-1.3-5.4-.1z"/><path d="M9.6 7.8C8.2 10.6 8.2 16 9.8 19.2M14.4 7.8c1.4 2.8 1.4 8.2-.2 11.4"/><path d="M12 7.5c0-1.7.6-3.2 2.2-4.2"/>'),'Прокрут'],
 ['col',IC('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),'Коллекция'],
 ['altar',IC('<path d="M12 2.8c2.3 2.7 2.7 4.4.1 6.4-2.8-2-2.4-3.7-.1-6.4z"/><rect x="8.5" y="11" width="7" height="8.2" rx="1.3"/><path d="M5.5 21h13M12 9.5V11"/>'),'Алтарь'],
 ['quests',IC('<path d="M7 3.5h10a2 2 0 0 1 2 2V18a2.5 2.5 0 0 1-2.5 2.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>'),'Задания'],
 ['prof',IC('<circle cx="12" cy="8.3" r="3.8"/><path d="M4.5 20.2c.6-3.7 3.7-6 7.5-6s6.9 2.3 7.5 6"/>'),'Профиль'],
 ['top',IC('<path d="M8 3.8h8v5.4a4 4 0 0 1-8 0V3.8z"/><path d="M8 5.8H5v1.2A3.2 3.2 0 0 0 8 10.2M16 5.8h3v1.2a3.2 3.2 0 0 1-3 3.2"/><path d="M12 13.2v3.6M8.5 20.2h7M10 16.8h4"/>'),'Топ']];
// Значки вкладок: контурные SVG вместо эмодзи (одинаково на всех устройствах, красятся через currentColor)
const SORTS=[['date','Новые'],['price','Дорогие'],['curse','Сильные']];
const ERR=[['season','Ивент сейчас не идёт'],['collection full','Коллекция полна: продайте номера'],['full','Коллекция полна: продайте номера'],
 ['not enough pumpkins','Не хватает тыковок'],['money','Не хватает тыковок'],['not enough rub','Не хватает рублей'],['limit','Лимит обмена на сегодня исчерпан'],
 ['claimed','Уже получено'],['not done','Условие ещё не выполнено'],['too many','Слишком много номеров сразу']];
const errMsg=e=>{const m=String(e&&e.message||e),f=ERR.find(x=>m.includes(x[0]));return f?f[1]:'Не удалось выполнить, попробуйте ещё раз'};
const fail=e=>{if(e&&e.banned)return;console.error(e);banner('Не получилось',errMsg(e))};

const H={ok:false,err:null,p:null,cfg:null,gd:{},claimed:[],dq:{},plates:[],tab:'roll',busy:false,loading:false,off:0,day:'',
 sort:'date',flt:'all',top:{},kind:'best',last:null};
const now=()=>Date.now()+H.off;
const mskDay=()=>new Date(now()+3*36e5).toISOString().slice(0,10);
const toMidnight=()=>Date.parse(mskDay()+'T00:00:00+03:00')+864e5-now();
const left=ms=>{const m=Math.max(0,Math.floor(ms/6e4)),d=Math.floor(m/1440),h=Math.floor(m%1440/60);return d?`${d} д ${h} ч`:h?`${h} ч ${m%60} мин`:`${m} мин`};
const phase=()=>{const t=now();return !H.cfg.on||t<H.cfg.s?'soon':t>=H.cfg.e?'over':'live'};
const blood=()=>phase()=='live'&&now()>=H.cfg.b;
const claimOpen=()=>H.cfg.on&&now()>=H.cfg.s&&now()<H.cfg.e+7*864e5;
const fromRow=r=>({id:r.id,country:r.country,type:r.type,main:r.main,reg:r.reg,rn:r.region_name,cls:r.cls,mu:r.mu,price:+r.price,
 curse:r.curse,guardian:r.guardian,pv:+r.pv,ts:Date.parse(r.created_at)});
// Плашка режима: проклятые номера получают свой скин по хранителю (hwg-*) и силе (hwc1..4), см. css/hw.css
const hp=(p,c='')=>{
  const t=hwText(p);
  let h=plateHTML(p,(p.curse?`hwp hwc${p.curse} hwg-${p.guardian} `:`hwn hwn${p.cls} `)+c,'');
  // подменяем обычный номер надписью: .pm — основная часть, .pr — регион (сохраняем разметку плашки, меняем только текст)
  h=h.replace(/(<[^>]*class="[^"]*\bpm\b[^"]*")([^>]*>)[\s\S]*?(<\/)/,`$1 style="font-size:calc(13.2cqw*${t.scale})"$2${esc(t.main)}$3`);
  h=h.replace(/(<[^>]*class="[^"]*\bpr\b[^"]*"[^>]*>)[\s\S]*?(<\/div>|<\/span>)/,`$1<span class="hwsub">${t.sub}</span>$2`);
  if(!p.curse||p.curse<2)return h;
  // эмблемы хранителя: сила 2 — водяной знак, 4 — бегущее кольцо (самоцветы вместо заклёпок на 3 и 4 рисует CSS)
  const e=hwGuard(p.guardian).e;
  return h.replace(/<\/div>$/,`<i class="hwe w">${e}</i>${p.curse>=4?'<i class="hwe rg"></i>':''}</div>`);
};
const pips=n=>`<span class="hw-pips">${[1,2,3,4].map(i=>`<i class="${i<=n?'on':''}"></i>`).join('')}</span>`;
const gCount=()=>Object.keys(H.gd).length;
const gSum=()=>Object.values(H.gd).reduce((a,b)=>a+b,0);
const gMin=()=>Math.min(...Object.values(H.gd),9);
const need=()=>H.p.lvl*HW.lvlMul;
const sellOf=p=>Math.floor(p.pv*HW.sellPct/100);
const dateRu=ms=>new Date(ms).toLocaleDateString('ru-RU',{day:'numeric',month:'long'});

function apply(st,rows){
  H.cfg={s:Date.parse(st.cfg.starts),e:Date.parse(st.cfg.ends),b:Date.parse(st.cfg.blood),on:!!st.cfg.on};
  H.off=Date.parse(st.cfg.now)-Date.now();
  H.p=st.p;H.gd=st.gd||{};H.claimed=st.claimed||[];H.dq=st.dq||{};
  if(rows)H.plates=rows.map(fromRow);
  H.day=mskDay();
}
async function load(){
  if(H.loading)return;H.loading=true;
  try{
    const [st,pl]=await Promise.all([rpc('hw_state'),sb.from('hw_plates').select(COLS).order('id')]);
    if(pl.error)throw pl.error;
    apply(st,pl.data);H.ok=true;H.err=null;
  }catch(e){if(!e||!e.banned){console.error(e);H.err=e}}
  H.loading=false;draw();
}
export function openHW(){go('hw');load()}

// ---------- Каркас ----------
function draw(){
  const bal=$('hwBal'),nav=$('hwNav'),c=$('hwC');if(!c)return;
  bal.innerHTML=H.p?`<span class="hw-pm">🎃</span>${fmt(H.p.pumpkins)}`:'';
  nav.innerHTML=TABS.map(([k,e,n])=>`<button class="${H.tab==k?'on':''}" data-click="hwTab" data-arg="${k}"><i>${e}</i>${n}</button>`).join('');
  if(!H.ok){c.innerHTML=H.err?`<div class="hw-msg"><b>Режим пока недоступен</b><span>Не удалось загрузить данные. Проверьте связь и попробуйте ещё раз.</span><button class="btn hw-btn" data-click="hwReload">Повторить</button></div>`
    :`<div class="hw-msg"><b>Зажигаем свечи…</b></div>`;return}
  if(H.tab=='roll'&&H.busy){return}
  c.innerHTML=({roll:drawRoll,col:drawCol,altar:drawAltar,quests:drawQuests,prof:drawProf,top:drawTop})[H.tab]();
  if(H.tab=='top')loadTop(H.kind);
}
function ribbon(){
  const ph=phase();
  if(ph=='soon')return `<div class="hw-rib" id="hwRib"><i>🌘</i><div><b>Ночь тыкв скоро начнётся</b><span>Старт ${dateRu(H.cfg.s)}</span></div></div>`;
  if(ph=='over')return `<div class="hw-rib over" id="hwRib"><i>🌑</i><div><b>Ночь закончилась</b><span>${claimOpen()?'Награды можно забрать ещё '+left(H.cfg.e+7*864e5-now()):'Спасибо, что играли'}</span></div></div>`;
  return blood()?`<div class="hw-rib blood" id="hwRib"><i>🩸</i><div><b>Кровавая луна</b><span>Проклятие ${HW.chanceBlood}%, Древнее вдвое чаще</span></div><em>${left(H.cfg.e-now())}</em></div>`
    :`<div class="hw-rib" id="hwRib"><i>🌕</i><div><b>Ночь тыкв идёт</b><span>До конца ночи</span></div><em>${left(H.cfg.e-now())}</em></div>`;
}

// ---------- Прокрут ----------
function phHTML(){
  const ph=phase(),ghost='<div class="hw-ghost"><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span><span>?</span></div>';
  if(ph!='live')return `<div class="hw-ph">${ghost}<b>${ph=='soon'?'Ещё не началось':'Ивент закончился'}</b><span>${ph=='soon'?'Старт '+dateRu(H.cfg.s):'Заберите награды на вкладке «Алтарь»'}</span></div>`;
  if(H.p.pumpkins<HW.cost)return `<div class="hw-ph">${ghost}<b>Не хватает тыковок</b><span>Заберите подарок или задания, или обменяйте рубли</span></div>`;
  return `<div class="hw-ph">${ghost}<b>Что выпадет этой ночью?</b><span>Нажмите в любом месте или на кнопку</span></div>`;
}
function resultHTML(r,anim){
  const p=r.plate||r,R=RAR[p.cls],g=p.curse?hwGuard(p.guardian):null;
  return `<div class="hw-res${g?' cursed c'+p.curse:''}${anim?' fresh':''}" style="--gc:${g?g.c:R.c}">
    <div class="hw-badge"><span style="color:${R.c}">${R.n}</span><b>🎃 ${fmt(p.pv)}</b></div>
    <div class="hw-plwrap">${g?'<i class="hw-aura"></i><i class="hw-sparks"></i>':''}${hp(p,anim?'in':'sh')}</div>
    ${g?curseHTML(p,g):'<div class="hw-clean">Без проклятия</div>'}${dots(p.cls)}</div>`;
}
const curseHTML=(p,g)=>`<div class="hw-curse c${p.curse}" style="--gc:${g.c}"><span class="hw-ge">${g.e}</span><div><em>${HW.powers[p.curse]} проклятие</em><b>${g.n}</b><span>Цена ×${HW.mult[p.curse-1]}</span></div>${pips(p.curse)}</div>`;
function goBtn(){
  const ph=phase(),ok=ph=='live'&&H.p.pumpkins>=HW.cost&&H.plates.length<HW.cap;
  const t=ph=='soon'?'Скоро':ph=='over'?'Ночь закончилась':H.p.pumpkins<HW.cost?'Нужны тыковки':H.plates.length>=HW.cap?'Коллекция полна':'Прокрутить';
  return `<button class="hw-go${ok?'':' off'}" id="hwGo" data-click="hwGen"><span>${t}</span>${ph=='live'?`<b>🎃 ${HW.cost}</b>`:''}</button>`;
}
function drawRoll(){
  const p=H.p,streak=p.streak;
  const candle=phase()=='live'?(p.candle?`<div class="hw-chip hot"><i class="hw-flame">🕯</i><div><b>Свеча дня горит</b><span>Первый прокрут сегодня будет проклятым</span></div></div>`
    :`<div class="hw-chip"><i class="hw-flame off">🕯</i><div><b>Свеча погасла</b><span id="hwCandle">Снова через ${left(toMidnight())}</span></div></div>`):'';
  const gift=phase()=='live'?(p.daily?`<button class="hw-chip hot" data-click="hwDaily"><i>🎁</i><div><b>Подарок дня</b><span>+${fmt(HW.daily+HW.streakStep*Math.min(streak,HW.streakMax))} 🎃${streak?' · серия '+streak:''}</span></div></button>`
    :`<div class="hw-chip"><i>🎁</i><div><b>Подарок получен</b><span>Серия ${streak} · завтра больше</span></div></div>`):'';
  return `<div class="hw-roll">${ribbon()}
    <div class="stage hw-stage" id="hwStage" data-click="hwGen">${H.last?resultHTML(H.last,false):phHTML()}</div>
    ${goBtn()}
    <div class="hw-stat">Выпало: ${fmt(p.n)} · Лучший: 🎃 ${fmt(p.best)}</div>
    <div class="hw-chips">${candle}${gift}</div></div>`;
}
// Прокрут: 12 кадров по 75 мс. Не зависит от настройки S.reel (раньше при выключенной/неопределённой настройке кадров не было вообще),
// а любой сбой при отрисовке кадра не может повесить промис: по ошибке показываем запасной кадр и всё равно завершаемся.
const GH='<div class="hw-ghost"><span>🎃</span><span>🕯</span><span>🦇</span><span>🕷</span><span>👻</span><span>💀</span></div>';
const spin=el=>new Promise(res=>{
  if(!el){res();return}
  let i=0,done=false;
  const end=()=>{if(done)return;done=true;clearInterval(t);res()};
  const frame=()=>{
    try{el.innerHTML=`<div class="hw-res spin"><div class="hw-plwrap">${hp(fake())}</div></div>`}
    catch(e){console.error('hw spin frame',e);try{el.innerHTML=`<div class="hw-res spin">${GH}</div>`}catch(_){}}
    if(++i>=12)end();
  };
  const t=setInterval(frame,75);frame();
  setTimeout(end,3000); // страховка
});
async function callRoll(){
  const {data,error}=await sb.functions.invoke('hw-roll');
  if(error){
    let e=null;try{e=await error.context.json()}catch(_){}
    if(e&&e.error=='banned'){handleBan({reason:e.reason,until:e.until});return {err:'banned'}}
    if(e&&['full','money','season'].includes(e.error)){await load();return {err:e.error}}
    await load();return {err:'net'}}
  if(!data)return {err:'net'};
  if(data.error){if(data.error=='banned'){handleBan({reason:data.reason,until:data.until});return {err:'banned'}}return {err:data.error}}
  if(!data.plate||!data.p)return {err:'net'};
  return data;
}
async function gen(){
  if(H.busy||!H.ok||H.tab!='roll')return;
  const ph=phase();
  if(ph!='live'){banner(ph=='soon'?'Ещё не началось':'Ивент закончился','Награды ждут в «Алтаре»');return}
  if(H.p.pumpkins<HW.cost){banner('Не хватает тыковок','Подарок, задания и обмен — во вкладке «Задания»');return}
  if(H.plates.length>=HW.cap){banner('Коллекция полна','Продайте номера, чтобы освободить место');return}
  H.busy=true;haptic('light');
  const st=$('hwStage');
  let r;
  try{[r]=await Promise.all([callRoll(),spin(st)])}
  catch(e){console.error(e);r={err:'net'}}
  finally{H.busy=false}
  if(!r||r.err){
    // кадр прокрута остаётся на сцене: возвращаем нормальный вид
    if(H.tab=='roll'){const s0=$('hwStage');if(s0)s0.innerHTML=H.last?resultHTML(H.last,false):phHTML()}
    if(r&&r.err=='banned')return;
    const e=r&&r.err;
    banner(e=='money'?'Не хватает тыковок':e=='full'?'Коллекция полна':e=='season'?'Ивент сейчас не идёт':'Нет связи','Попробуйте ещё раз');
    return}
  Object.assign(H.p,r.p);H.gd=r.gd||H.gd;H.dq=r.dq||H.dq;H.plates.push(r.plate);H.last=r;
  const p=r.plate;
  if(H.tab=='roll'){const s=$('hwStage');if(s)s.innerHTML=resultHTML(r,true)}
  $('hwBal').innerHTML=`<span class="hw-pm">🎃</span>${fmt(H.p.pumpkins)}`;
  const gb=$('hwGo');if(gb)gb.outerHTML=goBtn();
  const s2=document.querySelector('.hw-stat');if(s2)s2.textContent=`Выпало: ${fmt(H.p.n)} · Лучший: 🎃 ${fmt(H.p.best)}`;
  effects(r,p);
  if(r.candle){const c=document.querySelector('.hw-chip.hot');if(c)c.outerHTML=`<div class="hw-chip"><i class="hw-flame off">🕯</i><div><b>Свеча погасла</b><span id="hwCandle">Снова через ${left(toMidnight())}</span></div></div>`}
}
function effects(r,p){
  const g=p.curse?hwGuard(p.guardian):null;
  dropSound(p.cls);
  if(g){
    haptic('heavy');burst(g.c,10+p.curse*9);
    beep(110,.5,'sawtooth',.05);beep(98,.6,'sawtooth',.04,.12);if(p.curse>=3)beep(65,.9,'sawtooth',.05,.25);
    if(p.curse==4){document.body.classList.add('shake');setTimeout(()=>document.body.classList.remove('shake'),650);flash(g.c)}
  }else if(p.cls>=2)burst(RAR[p.cls].c,10);
  // одно сообщение за раз: самое важное
  if(r.gnew&&g)banner(r.gnew==1?'Новый хранитель: '+g.n:'Сила выросла: '+g.n,r.gnew==1?'Он записан в Алтаре':HW.powers[p.curse]+' проклятие');
  else if(r.lvup)banner('Новый уровень',`Уровень ${H.p.lvl} · бонус тыковками`);
  else if(r.candle)banner('Свеча дня','Проклятие выпало, как и обещано');
}
function flash(c){const f=document.createElement('div');f.className='hw-flash';f.style.setProperty('--gc',c);$('v-hw').appendChild(f);setTimeout(()=>f.remove(),1000)}

// ---------- Коллекция ----------
function listOf(){
  let a=H.plates.slice();
  if(H.flt=='curse')a=a.filter(p=>p.curse);else if(H.flt!='all')a=a.filter(p=>p.guardian==H.flt);
  const key={date:p=>p.id,price:p=>p.pv,curse:p=>p.curse*1e12+p.pv}[H.sort];
  return a.sort((x,y)=>key(y)-key(x));
}
function drawCol(){
  const a=listOf(),tot=H.plates.reduce((s,p)=>s+p.pv,0),junk=H.plates.filter(p=>!p.curse&&p.cls<=1).length;
  const fl=[['all','Все'],['curse','☠ Проклятые'],...HW.guardians.map(g=>[g.id,g.e])];
  return `<div class="hw-col"><div class="hw-hd"><h2 class="hw-h">🗂 Коллекция</h2><b>${H.plates.length} / ${HW.cap}</b></div>
   <div class="hw-sub">Стоимость 🎃 ${fmt(tot)}</div>
   <div class="hw-chipsrow">${SORTS.map(([k,n])=>`<button class="${H.sort==k?'a':''}" data-click="hwSort" data-arg="${k}">${n}</button>`).join('')}</div>
   <div class="hw-chipsrow">${fl.map(([k,n])=>`<button class="${H.flt==k?'a':''}" data-click="hwFlt" data-arg="${k}">${n}</button>`).join('')}</div>
   <div class="hw-rows">${a.length?a.map((p,i)=>rowHTML(p,i)).join(''):`<div class="hw-empty">${H.plates.length?'Здесь ничего нет':'Пока пусто. Нажмите «Прокрут», чтобы выбить первый номер.'}</div>`}</div>
   <button class="btn hw-btn" ${junk?'':'disabled'} data-click="hwJunk">Продать мелочь${junk?' ('+junk+')':''}</button></div>`;
}
function rowHTML(p,i){
  const R=RAR[p.cls],g=p.curse?hwGuard(p.guardian):null;
  return `<div class="hw-row${g?' cursed c'+p.curse:''}" style="--gc:${g?g.c:R.c};animation-delay:${Math.min(i,12)*25}ms" data-click="hwOpenP" data-arg="${p.id}">
   <div class="hw-mini">${hp(p)}</div>
   <div class="hw-ri"><span style="color:${R.c}">${R.n}</span><b>🎃 ${fmt(p.pv)}</b></div>
   ${g?`<div class="hw-rc"><span>${g.e} ${HW.powers[p.curse]} ×${HW.mult[p.curse-1]}</span>${pips(p.curse)}</div>`:'<div class="hw-rc dim"><span>Без проклятия</span></div>'}</div>`;
}
function openPlate(id){
  const p=H.plates.find(x=>x.id==id);if(!p)return;
  const R=RAR[p.cls],g=p.curse?hwGuard(p.guardian):null;
  sm(`<div class="dlg hw-dlg" style="--gc:${g?g.c:R.c}"><div class="hw-dp">${hp(p,'sh')}</div>
    <div class="hw-dn" style="color:${R.c}">${R.n}</div>${g?curseHTML(p,g):''}
    <div class="hw-val">Цена 🎃 ${fmt(p.pv)}<span>Продажа ${HW.sellPct}%: 🎃 ${fmt(sellOf(p))}</span></div>
    <button class="btn red hw-btn" data-click="hwSell" data-arg="${p.id}">${g?'Развеять и продать':'Продать'} · 🎃 ${fmt(sellOf(p))}</button>
    <button class="btn hw-btn" data-click="hwClose">Закрыть</button></div>`);
}
function sellAsk(id){
  const p=H.plates.find(x=>x.id==id);if(!p)return;
  if(p.curse>=3){const g=hwGuard(p.guardian);
    sm(`<div class="dlg hw-dlg"><h3>Развеять ${HW.powers[p.curse].toLowerCase()} проклятие?</h3><div class="hw-sub" style="text-align:center">${g.e} ${g.n} · ×${HW.mult[p.curse-1]}<br>Номер уйдёт навсегда. Прогресс хранителя в Алтаре останется.</div>
    <button class="btn red hw-btn" data-click="hwSellOk" data-arg="${p.id}">Продать · 🎃 ${fmt(sellOf(p))}</button><button class="btn" data-click="hwClose">Оставить</button></div>`);return}
  sellDo(id);
}
async function sellDo(id){
  cm();
  try{
    const r=await rpc('hw_sell',{ids:[+id]});
    if(!r.n){await load();return}
    H.plates=H.plates.filter(x=>x.id!=id);H.p.pumpkins=+r.pumpkins;H.dq=r.dq;
    burst('#ff8a1f',12);haptic('light');banner('Продано','+🎃 '+fmt(r.gain));draw();
  }catch(e){fail(e)}
}
function junkAsk(){
  const j=H.plates.filter(p=>!p.curse&&p.cls<=1);if(!j.length){banner('Мелочи нет','Проклятые и редкие номера остаются');return}
  const gain=Math.floor(j.reduce((s,p)=>s+p.pv,0)*HW.sellPct/100);
  sm(`<div class="dlg hw-dlg"><h3>Продать мелочь?</h3><div class="hw-sub" style="text-align:center">${j.length} обычных и необычных номеров без проклятия.<br>Вы получите 🎃 ${fmt(gain)}</div>
    <button class="btn red hw-btn" data-click="hwJunkOk">Продать</button><button class="btn" data-click="hwClose">Отмена</button></div>`);
}
async function junkDo(){
  cm();
  try{
    const r=await rpc('hw_sell_junk');
    await load();
    if(r.n){burst('#ff8a1f',16);haptic('light');banner('Продано: '+r.n,'+🎃 '+fmt(r.gain))}
  }catch(e){fail(e)}
}

// ---------- Алтарь ----------
function drawAltar(){
  const gc=gCount(),p=H.p,bl=blood(),pw=bl?HW.pwBlood:HW.pw;
  const left2=Math.max(0,HW.pityAt-p.pity);
  const gs=HW.guardians.map(g=>{const v=H.gd[g.id]||0;
    return `<div class="hw-g${v?' on':''}" style="--gc:${g.c}"><div class="hw-gi">${v?g.e:'❔'}</div><b>${v?g.n:'Не найден'}</b>
     ${pips(v)}<span>${v?HW.powers[v]:'шанс '+g.w+'%'}</span></div>`}).join('');
  return `<div class="hw-altar">${ribbon()}
   <div class="hw-hero"><div class="hw-ring" style="--p:${gc/5*100}%"><b>${gc}<small>/5</small></b></div>
    <div><h2 class="hw-h">Алтарь</h2><div class="hw-sub">Хранитель записывается, когда выпадает номер с его проклятием. Прогресс не пропадает, даже если номер продан.</div></div></div>
   <div class="hw-gs">${gs}</div>
   <h3 class="hw-h2">Награды</h3>${rewardsHTML()}
   <h3 class="hw-h2">Шансы</h3>
   <div class="hw-odds"><div><span>Проклятие на прокрут</span><b>${bl?HW.chanceBlood:HW.chance}%</b></div>
    ${pw.map((w,i)=>`<div><span>${HW.powers[i+1]} ×${HW.mult[i]}</span><b>${w}%</b></div>`).join('')}
    <div><span>Гарантия через</span><b>${p.candle?'свеча сегодня':left2?left2+' прокр.':'следующий'}</b></div></div></div>`;
}
function rewardsHTML(){
  const R=HW.rewards,gc=gCount(),bal=Math.min(R.g3.max,Math.max(R.g3.min,Math.floor(S.bal*R.g3.pct/100)));
  const cards=[
   ['g3','Три хранителя','💰',`${fmt(bal)} ₽ (${R.g3.pct}% баланса, от ${fmt(R.g3.min)} до ${fmt(R.g3.max)}) и 🎃 ${fmt(R.g3.pum)}`,gc>=3,`${Math.min(gc,3)} / 3`],
   ['g5','Хранитель ночи','🕯',`Титул «${itemName('hw_t_keeper')}», тёмная рамка профиля и 🎃 ${fmt(R.g5.pum)}`,gc>=5,`${gc} / 5`],
   ['gold','Повелитель ночи','👑',`Все пять на силе «Сильное» или «Древнее»: титул «${itemName('hw_t_lord')}» и 🎃 ${fmt(R.gold.pum)}`,gc>=5&&gMin()>=R.gold.minPw,gc>=5?`слабейший: ${HW.powers[gMin()]}`:`${gc} / 5`]];
  return cards.map(([k,n,ic,d,ok,pr])=>{const got=H.claimed.includes(k);
    return `<div class="hw-rw${got?' got':ok?' ready':''}"><i class="hw-ic">${ic}</i><div><b>${n}</b><span>${d}</span></div>${got?'<em>✓ Получено</em>':ok&&claimOpen()?`<button class="btn hw-btn" data-click="hwClaim" data-arg="${k}">Забрать</button>`:`<em>${pr}</em>`}</div>`}).join('');
}
const itemName=id=>HW.titles.find(t=>t.id==id).n;
async function claim(k){
  try{
    const r=await rpc('hw_claim',{kind:k});
    H.claimed.push(k);H.p.pumpkins+=r.pumpkins;await loadPlayer().catch(()=>{});
    burst('#ffb454',24);haptic('heavy');
    banner(r.title?'Титул получен':'Награда получена',(r.rub?'+'+fmt(r.rub)+' ₽ и ':'')+'+🎃 '+fmt(r.pumpkins));draw();
  }catch(e){fail(e)}
}

// ---------- Задания ----------
function drawQuests(){
  const p=H.p,dq=H.dq,live=phase()=='live',left2=HW.exch.limit-p.exch;
  const qs=HW.quests.map((q,i)=>{const v=Math.min(q.need,dq[q.k]||0),done=v>=q.need,got=(dq.c||[]).includes(i+1);
    return `<div class="hw-q${got?' got':''}"><div class="hw-qt"><b>${q.n}</b><span>${v} / ${q.need}</span></div><div class="pb hw-pb"><i style="width:${v/q.need*100}%"></i></div>
     ${got?'<em>✓</em>':`<button class="btn hw-btn" ${done&&live?'':'disabled'} data-click="hwQuest" data-arg="${i+1}">+🎃 ${q.rew}</button>`}</div>`}).join('');
  const ex=[1,10,50].map(n=>`<button class="btn hw-btn" ${live&&n<=left2&&S.bal>=n*HW.exch.rate?'':'disabled'} data-click="hwExch" data-arg="${n}">+${n} 🎃<small>${fmt(n*HW.exch.rate)} ₽</small></button>`).join('');
  const gift=p.daily?`<button class="btn hw-btn hot" ${live?'':'disabled'} data-click="hwDaily">Забрать +${fmt(HW.daily+HW.streakStep*Math.min(p.streak,HW.streakMax))} 🎃</button>`:`<em>✓ Получено, завтра больше</em>`;
  return `<div class="hw-quests">${ribbon()}
   <div class="hw-hd"><h2 class="hw-h">📜 Задания</h2><b>до ${left(toMidnight())}</b></div>
   <div class="hw-card"><div class="hw-qt"><b>🎁 Подарок дня</b><span>Серия: ${p.streak}</span></div>
    <div class="hw-sub">${HW.daily} 🎃 в день и ещё +${HW.streakStep} за каждый день серии подряд, до +${HW.streakStep*HW.streakMax}.</div>${gift}</div>
   <h3 class="hw-h2">Задания дня</h3>${qs}
   <h3 class="hw-h2">Обмен рублей</h3>
   <div class="hw-card"><div class="hw-sub">1 🎃 = ${fmt(HW.exch.rate)} ₽. Сегодня можно ещё ${left2} 🎃. Обратно тыковки в рубли не меняются.</div>
    <div class="hw-exch">${ex}</div><div class="hw-sub">Ваш баланс: ${fmt(S.bal)} ₽</div></div></div>`;
}
async function daily(){
  try{
    const r=await rpc('hw_daily');
    H.p.pumpkins=+r.pumpkins;H.p.daily=false;H.p.streak=r.streak;
    burst('#ffb454',14);haptic('light');banner('Подарок дня','+🎃 '+fmt(r.gain)+' · серия '+r.streak);draw();
  }catch(e){fail(e)}
}
async function quest(i){
  try{
    const r=await rpc('hw_quest_claim',{i:+i});
    H.p.pumpkins=+r.pumpkins;H.dq=r.dq;burst('#ffb454',10);haptic('light');banner('Задание выполнено','+🎃 '+r.gain);draw();
  }catch(e){fail(e)}
}
async function exch(n){
  try{
    const r=await rpc('hw_exchange',{amount:+n});
    H.p.pumpkins=+r.pumpkins;H.p.exch=r.exch;S.bal=+r.balance;
    burst('#ff8a1f',10);haptic('light');banner('Обмен выполнен','+🎃 '+n);draw();
  }catch(e){fail(e)}
}

// ---------- Профиль ----------
function drawProf(){
  const p=H.p,u=tgUser(),nm=pName(),keeper=H.claimed.includes('g5'),
    av=u&&u.photo_url?`<img class="pav" src="${esc(u.photo_url)}" alt="">`:`<div class="pav">${esc([...nm][0].toUpperCase())}</div>`,
    tot=H.plates.reduce((s,x)=>s+x.pv,0),
    mine=HW.titles.filter(t=>(S.owned||[]).includes(t.id)),cur=S.equip&&S.equip.title;
  return `<div class="hw-prof"><div class="hw-card${keeper?' hw-keeper':''}"><div class="phd">${av}<div><b class="pn${nickCls(S.equip.nick)}">${esc(nm)}</b>${titleHTML(cur)}<span class="tl">Уровень ${p.lvl}</span></div></div>
    <div class="sub" style="font-size:16px;gap:14px;align-items:center"><div class="pb hw-pb" style="flex:1"><i style="width:${Math.min(100,p.xp/need()*100)}%"></i></div><span>${fmt(p.xp)} / ${fmt(need())}</span></div>
    <button class="btn hw-btn" style="width:100%;margin-top:14px" data-click="nickDlg">Сменить имя</button></div>
   <div class="hw-st"><div><b>${fmt(p.pumpkins)}</b><span>Тыковки 🎃</span></div><div><b>${fmt(p.n)}</b><span>Выпало номеров</span></div><div><b>${fmt(p.curses)}</b><span>Проклятий</span></div>
    <div><b>${fmt(p.best)}</b><span>Лучший, 🎃</span></div><div><b>${gCount()} / 5</b><span>Хранителей</span></div><div><b>${fmt(tot)}</b><span>Стоимость коллекции</span></div></div>
   ${mine.length?`<div class="hw-card"><h3 class="hw-h2" style="margin-top:0">Титулы ночи</h3><div class="hw-titles">${mine.map(t=>`<button class="${cur==t.id?'a':''}" style="--tc:${t.c}" data-click="hwTitle" data-arg="${cur==t.id?'':t.id}">${t.n}${cur==t.id?' · надет':''}</button>`).join('')}</div></div>`:''}
   <div class="hw-card"><h3 class="hw-h2" style="margin-top:0">Редкости</h3>${rarBars()}</div></div>`;
}
function rarBars(){
  const c=RAR.map((_,i)=>H.plates.filter(p=>p.cls==i).length),mx=Math.max(1,...c);
  return `<div class="hw-bars">${RAR.map((R,i)=>`<span>${R.n}</span><div class="pb" style="background:${R.c}33"><i style="width:${c[i]/mx*100}%;background:${R.c}"></i></div><span>${c[i]}</span>`).join('')}</div>`;
}
async function equipTitle(id){
  try{await rpc('equip_item',{slot_name:'title',item_id:id||''});await loadPlayer();draw()}catch(e){fail(e)}
}

// ---------- Топ ----------
const topAt={};
async function loadTop(k){
  if(H.top[k]&&Date.now()-topAt[k]<3e4)return;
  try{const d=await rpc('hw_leaderboard',{p_kind:k});H.top[k]=d;topAt[k]=Date.now()}catch(e){console.error(e);H.top[k]={err:1}}
  if(H.tab=='top'&&H.kind==k&&$('hwC'))$('hwC').innerHTML=drawTop(true);
}
const MEDAL=['🥇','🥈','🥉'];
function drawTop(){
  const d=H.top[H.kind];
  const val=r=>H.kind=='best'?'🎃 '+fmt(r.val):H.kind=='guard'?`${r.gn} / 5 · сила ${r.val}`:fmt(r.val)+' ☠';
  const row=(r,me)=>`<div class="hw-tr${me?' me':''}${r.rk<=3?' p'+r.rk:''}"><span class="hw-rk">${MEDAL[r.rk-1]||r.rk}</span><div><b>${esc(r.nick||'Игрок')}</b><span>Ур. ${r.lvl}</span></div><em>${val(r)}</em></div>`;
  let body;
  if(!d)body='<div class="hw-empty">Загрузка…</div>';
  else if(d.err)body='<div class="hw-empty">Не удалось загрузить рейтинг</div>';
  else{
    const meIn=d.top.some(r=>r.me);
    body=(d.top.length?d.top.map(r=>row(r,r.me)).join(''):'<div class="hw-empty">Рейтинг пока пуст</div>')+(d.me&&!meIn?`<div class="hw-gap">· · ·</div>${row(d.me,true)}`:'');
  }
  return `<div class="hw-top-v"><div class="hw-hd"><h2 class="hw-h">🏆 Топ ночи</h2></div>
   <div class="hw-chipsrow">${HW.tops.map(([k,e,n])=>`<button class="${H.kind==k?'a':''}" data-click="hwKind" data-arg="${k}">${e} ${n}</button>`).join('')}</div>
   <div class="hw-trs">${body}</div></div>`;
}

// ---------- Таймеры ----------
// Раз в 30 секунд обновляем только тексты с отсчётом, чтобы не сбрасывать анимацию результата.
// Сменился день по Москве: свеча, подарок, задания и лимит обмена новые, поэтому перечитываем состояние.
setInterval(()=>{
  const v=$('v-hw');if(!v||!v.classList.contains('on')||!H.ok||H.busy)return;
  if(mskDay()!==H.day){load();return}
  const r=$('hwRib');if(r)r.outerHTML=ribbon();
  const c=$('hwCandle');if(c)c.textContent='Снова через '+left(toMidnight());
},30000);

DRAW.hw=draw;
on({hwOpen:openHW,hwReload:()=>{H.err=null;load();draw()},hwTab:a=>{H.tab=a;draw();scrollTo(0,0)},hwGen:gen,hwDaily:daily,hwQuest:a=>quest(a),hwExch:a=>exch(a),
 hwClaim:a=>claim(a),hwSort:a=>{H.sort=a;draw()},hwFlt:a=>{H.flt=a;draw()},hwOpenP:a=>openPlate(+a),hwClose:cm,hwSell:a=>sellAsk(+a),hwSellOk:a=>sellDo(+a),
 hwJunk:junkAsk,hwJunkOk:junkDo,hwTitle:a=>equipTitle(a),hwKind:a=>{H.kind=a;draw()}});

// Музыка экрана: сама включается, когда открыт экран ивента, кнопка звука в шапке (js/ui/hwmusic.js)
hwMusicInit();
