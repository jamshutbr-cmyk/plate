import {api} from '../api.js';
import {BANK, CAR_CLS, RAR, depPayout, dupRefund} from '../config.js';
import {carById, caseOdds} from '../data/cars.js';
import {haptic} from '../platform.js';
import {beep, burst, chime, dropSound, riser} from '../ui/fx.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {banner, cm, sm} from '../ui/modal.js';
import {titleHTML} from '../ui/plate.js';
import {$, esc, fmt, parseAsk} from '../util.js';

// Банк: обмен ₽ ↔ $, вклады, усиления, кейсы и титулы за $.
// Курсы, проценты, цены и лимиты считает ТОЛЬКО сервер (supabase/bank.sql); BANK в config.js нужен лишь для показа.
// Форма вклада не перерисовывается таймером: он трогает только текст отсчёта и состояние кнопок «Забрать».
let TAB='ex',BS=null,AT=0,LOAD=false,ERR=false;   // вкладка, состояние банка с сервера, время загрузки, идёт ли загрузка, ошибка
let CUR='rub',DAYS=1,TXT='',BUSY=false,XD='buy',FRESH=false;   // FRESH: следующая отрисовка — смена вкладки, нужна плавная анимация           // форма вклада: валюта, срок, введённый текст; BUSY — защита от двойного нажатия
let OFF=0,TM=null;                                // сдвиг часов сервера, таймер отсчёта

const TABS=[['ex','⇄','Обмен'],['dep','📈','Вклады'],['up','⚡','Усиления'],['cs','🎁','Кейсы'],['ti','👑','Титулы']];
const ERRS={usd:'Не хватает долларов',rub:'Не хватает рублей',limit:'Достигнут максимум',many:'Не больше '+BANK.maxDep+' вкладов сразу',ready:'Вклад ещё не созрел',gone:'Вклад уже забран',amount:'Недопустимая сумма',owned:'Уже куплено',soldout:'Тираж распродан'};
const fail=r=>{banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');haptic('rigid');return load().then(()=>render(true))};
const pct=x=>(Math.round(x*10)/10).toString().replace('.',',');
const cur=c=>c=='rub'?'₽':'$';
const dn=d=>d+' '+(d==1?'день':'дня');
const win=(c='#22c55e')=>{burst(c,16);chime(1);haptic('success')};   // монетки и звонкий звук при успешной операции
const box=(c,h,k='')=>`<div class="bk-card ${k}"${c?` style="--cc:${c}"`:''}>${h}</div>`;
const head=(ic,t,d,c)=>`<div class="bk-h" style="--cc:${c||'#3b82f6'}"><div class="bk-ic">${ic}</div><div><h3>${t}</h3><div class="tl">${d}</div></div></div>`;
const meter=(v,m,n,c)=>`<div class="bk-meter" style="--cc:${c}">${Array.from({length:n},(_,i)=>`<i class="${i<Math.round(v/m*n)?'f':''}"></i>`).join('')}</div>`;

async function load(){
  LOAD=true;
  try{BS=await api.bankState();OFF=BS.now-Date.now();ERR=false}
  catch(e){console.error(e);ERR=true}
  finally{LOAD=false;AT=Date.now()}}

// ---------- отсчёт ----------
const left=end=>Math.max(0,end-(Date.now()+OFF));
function fmtLeft(ms){
  const s=Math.ceil(ms/1000),d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60),x=s%60,z=n=>String(n).padStart(2,'0');
  return (d?d+' д ':'')+z(h)+':'+z(m)+':'+z(x)}
const done=d=>Math.min(100,Math.max(0,(Date.now()+OFF-d.start)/(d.ends-d.start)*100));
function tick(){
  if(!$('v-bank').classList.contains('on')){clearInterval(TM);TM=null;return}
  document.querySelectorAll('#bankC .bk-t').forEach(e=>{const l=left(+e.dataset.end);e.textContent=l?'Осталось '+fmtLeft(l):'Готов к получению'});
  document.querySelectorAll('#bankC .bk-claim').forEach(e=>{const r=left(+e.dataset.end)==0;e.disabled=!r;e.classList.toggle('rdy',r)});
  document.querySelectorAll('#bankC .bk-ring .v').forEach(e=>{const d=BS.deposits.find(x=>x.id==e.dataset.id);if(d)e.style.strokeDashoffset=119.4*(1-done(d)/100)})}

// ---------- вкладки ----------
const hero=()=>`<div class="bk-hero"><i class="bk-fl a"></i><i class="bk-fl b"></i><i class="bk-fl c"></i><div class="bk-coin">$</div><div class="bk-bals"><div><small>Рубли</small><b>${fmt(S.bal)} ₽</b></div><div><small>Доллары</small><b class="g">${fmt(S.usd)} $</b></div></div>
  <div class="bk-rate"><span>Покупка 1 $ = ${fmt(BANK.usdBuy)} ₽</span><span>Продажа 1 $ = ${fmt(BANK.usdSell)} ₽</span></div></div>`;

function tabEx(){
  const buy=XD=='buy',sums=[1,5,10,50],all=Math.min(S.usd,BANK.exMax);
  const q=sums.map(n=>{const dis=buy?S.bal<n*BANK.usdBuy:S.usd<n;
    return `<button ${dis?'disabled':''} data-click="bkEx" data-arg="${XD}:${n}"><b>${n} $</b><small>${buy?'−':'+'}${fmt(n*(buy?BANK.usdBuy:BANK.usdSell))} ₽</small></button>`}).join('');
  return box('',`<div class="bk-flow ${XD}"><span>${buy?'₽':'$'}</span><i>→</i><span>${buy?'$':'₽'}</span><small>1 $ = ${fmt(buy?BANK.usdBuy:BANK.usdSell)} ₽</small></div><div class="bk-sw ${XD}"><button class="${buy?'a':''}" data-click="bkXd" data-arg="buy">Купить $</button><button class="${buy?'':'a'}" data-click="bkXd" data-arg="sell">Продать $</button></div>
    <div class="bk-q ${XD}">${q}</div>`
    +(buy?'':`<button class="bk-all" ${all<1?'disabled':''} data-click="bkEx" data-arg="sell:${all}">Продать все${all?' · '+fmt(all)+' $ → '+fmt(all*BANK.usdSell)+' ₽':''}</button>`))
    +`<p class="bk-note">Продавать невыгоднее, чем покупать: курс продажи ниже. За одну операцию не больше ${fmt(BANK.exMax)} $.</p>`}

function depForm(){
  const d=CUR=='rub'?BANK.depRub:BANK.depUsd,n=Math.floor(parseAsk(TXT)),ok=depOk(d,n);
  return box('',head('🏦','Новый вклад','Заберёте вместе с процентами по окончании срока','#22c55e')
   +`<div class="bk-sw"><button class="${CUR=='rub'?'a':''}" data-click="bkCur" data-arg="rub">Рубли ₽</button><button class="${CUR=='usd'?'a':''}" data-click="bkCur" data-arg="usd">Доллары $</button></div>
   <div class="bk-terms">${[1,3,7].map(x=>`<button class="${DAYS==x?'a':''}" data-click="bkDays" data-arg="${x}"><b>${x}</b><small>${x==1?'день':'дня'}</small><em>+${d.pct[x]}%</em></button>`).join('')}</div>
   <div class="bk-chips">${chips(d).map(([l,v])=>`<button data-click="bkChip" data-arg="${v}">${l}</button>`).join('')}</div>
   <input class="gq" id="bkAmt" inputmode="text" placeholder="Сумма, ${cur(CUR)}" maxlength="16" autocomplete="off" value="${esc(TXT)}" data-input="bkAmtIn">
   <div class="bk-prev${ok?' ok':''}" id="bkPrev">${depPrev(d,n)}</div>
   <button class="btn bk-go" id="bkGo" ${ok?'':'disabled'} data-click="bkOpen">Открыть вклад</button>`)}
const chips=d=>{const mx=Math.min(CUR=='rub'?S.bal:S.usd,d.max),a=CUR=='rub'?[['100к',1e5],['1м',1e6],['10м',1e7],['100м',1e8]]:[['10',10],['50',50],['100',100],['1000',1000]];
  return [...a.filter(([,v])=>v<=d.max),['Макс',Math.floor(mx)]]};
const depOk=(d,n)=>n>=d.min&&n<=d.max&&BS.deposits.length<BANK.maxDep&&depPayout(CUR,n,DAYS)>n;
function depPrev(d,n){
  if(BS.deposits.length>=BANK.maxDep)return 'Уже открыто '+BANK.maxDep+' вклада: заберите один из них';
  if(!TXT.trim())return `От ${fmt(d.min)} до ${fmt(d.max)} ${cur(CUR)}. Можно писать «1.5м», «250к»`;
  if(!(n>=d.min&&n<=d.max))return `Сумма от ${fmt(d.min)} до ${fmt(d.max)} ${cur(CUR)}`;
  const p=depPayout(CUR,n,DAYS);
  if(p<=n)return 'Сумма слишком мала: проценты не дадут и 1 '+cur(CUR)+'. Возьмите больше или другой срок';
  return `Вложите ${fmt(n)} ${cur(CUR)} → получите ${fmt(p)} ${cur(CUR)} (+${fmt(p-n)}) через ${dn(DAYS)}`}

function tabDep(){
  const list=BS.deposits.map(d=>{
    const l=left(d.ends);
    return `<div class="bk-card bk-dep ${d.cur}"><div class="bk-top"><div class="bk-ring" style="--cc:${d.cur=='rub'?'#3b82f6':'#22c55e'}"><svg viewBox="0 0 44 44"><circle cx="22" cy="22" r="19" class="t"/><circle cx="22" cy="22" r="19" class="v" data-id="${d.id}" style="stroke-dashoffset:${119.4*(1-done(d)/100)}"/></svg><b>${cur(d.cur)}</b></div>
     <div class="bk-sum"><small>Вложено</small><b>${fmt(d.amount)} ${cur(d.cur)}</b></div><div class="bk-sum" style="text-align:right"><small>Получите</small><b class="pay">${fmt(d.payout)} ${cur(d.cur)}</b></div></div>
     <div class="bk-t" data-end="${d.ends}">${l?'Осталось '+fmtLeft(l):'Готов к получению'}</div>
     <button class="btn bk-claim${l?'':' rdy'}" data-end="${d.ends}" ${l?'disabled':''} data-click="bkClaim" data-arg="${d.id}">Забрать</button></div>`}).join('');
  return depForm()+`<h3 class="tsec">Ваши вклады · ${BS.deposits.length} из ${BANK.maxDep}</h3>`+(list||`<p class="bk-note">Вкладов пока нет.</p>`)
    +`<p class="bk-note">Забрать вклад можно только после окончания срока.</p>`}

function tabUp(){
  const L=BANK.luck,M=BANK.lots,lf=BS.luck+L.rolls>L.cap,mx=BS.extra_lots+M.step>M.max;
  return box('#f5b82e',head('🍀','Буст удачи',`Ближайшие ${L.rolls} прокрутов: ${L.best} номера на выбор, достаётся самый дорогой`,'#f5b82e')
   +`<div class="bk-row" style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="tl" style="margin:0">Прокрутов с бустом</span><b>${BS.luck} из ${L.cap}</b></div>${meter(BS.luck,L.cap,20,'#f5b82e')}
   <button class="btn bk-buy" ${lf||S.usd<L.cost?'disabled':''} data-click="bkLuck">${lf?'Накоплен максимум':'+'+L.rolls+' прокрутов · '+L.cost+' $'}</button>`)
   +box('#4ade80',head('🏪','Слоты рынка',`+${M.step} лотов за покупку на рынке игроков`,'#4ade80')
   +`<div class="bk-row" style="display:flex;justify-content:space-between;margin-bottom:6px"><span class="tl" style="margin:0">Дополнительные слоты</span><b>+${BS.extra_lots} из ${M.max}</b></div>${meter(BS.extra_lots,M.max,M.max/M.step,'#4ade80')}
   <button class="btn bk-buy" ${mx||S.usd<M.cost?'disabled':''} data-click="bkLots">${mx?'Куплено всё':'+'+M.step+' лотов · '+M.cost+' $'}</button>`)}

const crate=(c,w=96)=>`<svg viewBox="0 0 120 80" width="${w}"><ellipse cx="60" cy="74" rx="46" ry="5" fill="${c}" opacity=".28"/><rect x="14" y="28" width="92" height="44" rx="8" fill="#1d2236" stroke="${c}" stroke-width="3"/><rect x="54" y="16" width="12" height="56" fill="${c}" opacity=".45"/><rect x="10" y="16" width="100" height="18" rx="6" fill="${c}" opacity=".9"/><circle cx="60" cy="48" r="7" fill="#0c1020" stroke="#fff" stroke-opacity=".6" stroke-width="2"/></svg>`;
function tabCs(){
  return BANK.cases.map(c=>{
    const od=caseOdds(c.w),rows=c.w.map((w,r)=>w?`<div class="cso-r"><i style="background:${RAR[r].c}"></i><span>${CAR_CLS[r]}</span><em><u style="width:${Math.max(2,od[r])}%;background:${RAR[r].c}"></u></em><b>${pct(od[r])}%</b></div>`:'').join('');
    return `<div class="card cs-card" style="--cc:${c.col}"><div style="text-align:center">${crate(c.col)}</div><h3>${c.n}<span class="bk-chip" style="--cc:${c.col}">${c.usd} $</span></h3><div class="tl" style="margin-bottom:10px">${c.d}</div><div class="cs-od">${rows}</div>
     <button class="big2${S.usd>=c.usd?'':' alt'}" data-click="bkCase" data-arg="${c.id}">Открыть · ${c.usd} $</button></div>`}).join('')
   +`<p class="bk-note">Если машина уже есть, вы получаете ${CAR_CLS.map((n,r)=>n.toLowerCase()+' — '+fmt(dupRefund(r))+' ₽').join(', ')}.</p>`}

// Остаток тиража титула: сколько осталось и сколько всего. Данные о продажах приходят с сервера (BS.items).
const stock=it=>{const sold=Math.min(it.max,((BS.items||{})[it.id]||{}).sold||0);return {sold,left:it.max-sold}};
function tabTi(){
  return BANK.items.map(it=>{
    const own=S.owned.includes(it.id),eq=S.equip.title==it.id,{left}=stock(it),out=left<=0&&!own;
    const btn=own?`<button class="btn" style="width:100%" ${eq?'disabled':''} data-click="bkWear" data-arg="${it.id}">${eq?'Надето':'Надеть'}</button>`
      :out?`<button class="btn" style="width:100%" disabled>Распродано</button>`
      :`<button class="btn" style="width:100%" ${S.usd<it.usd?'disabled':''} data-click="bkItemDlg" data-arg="${it.id}">Купить · ${fmt(it.usd)} $</button>`;
    const lim=`<div class="bk-lim${out?' out':left<=Math.ceil(it.max*.1)?' low':''}"><span>${out?'РАСПРОДАНО':'Осталось '+fmt(left)+' из '+fmt(it.max)}</span>${meter(left,it.max,10,out?'#64748b':it.c)}</div>`;
    return box(it.c,`<span class="bk-ttl">${it.n}</span><div class="bk-who"><b>${esc(S.nick||'Игрок')}</b>${titleHTML(it.id)}</div><div class="bk-price">${own?'КУПЛЕНО':out?'ЛИМИТИРОВАННЫЙ ТИРАЖ':'ЛИМИТ · '+fmt(it.usd)+' $'}</div>${lim}<div class="tl">${it.d}</div>${btn}`,'bk-ti'+(out?' sold':''))}).join('')
   +`<p class="bk-note">Титулы выходят ограниченным тиражом на весь сервер. Когда тираж кончится, купить их будет нельзя, только забрать у владельца. За рубли они не продаются.</p>`}

export function drawBank(){
  if(!LOAD&&Date.now()-AT>10000)load().then(()=>render(true));
  let h=hero()+`<div class="bk-tabs">${TABS.map(([k,i,n])=>`<button class="${TAB==k?'a':''}" data-click="bkTab" data-arg="${k}"><i>${i}</i>${n}</button>`).join('')}</div>`;
  if(!BS)h+=`<p class="bk-note">${ERR?'Не удалось загрузить банк':'Загрузка…'}</p>`;
  else h+=`<div class="bk-pane${FRESH?' in':''}">`+{ex:tabEx,dep:tabDep,up:tabUp,cs:tabCs,ti:tabTi}[TAB]()+'</div>';
  FRESH=false;
  $('bankC').innerHTML=h;
  if(TAB=='dep'&&BS&&!TM)TM=setInterval(tick,1000)}

// ---------- действия ----------
const bkTab=a=>{TAB=a;FRESH=true;render(true)};
const bkXd=a=>{XD=a;FRESH=true;render(true)};
function bkChip(a){
  TXT=String(a);const el=$('bkAmt');el.value=TXT;haptic('light');bkAmtIn(a,el)}
const bkCur=a=>{CUR=a;render(true)};
const bkDays=a=>{DAYS=+a;render(true)};
function bkAmtIn(a,el){
  TXT=el.value;
  const d=CUR=='rub'?BANK.depRub:BANK.depUsd,n=Math.floor(parseAsk(TXT));
  const ok=depOk(d,n);
  $('bkPrev').textContent=depPrev(d,n);$('bkPrev').classList.toggle('ok',ok);
  $('bkGo').disabled=!ok}

async function op(f,ok){   // общая обвязка: защита от двойного нажатия, показ ошибки, обновление
  if(BUSY)return;BUSY=true;
  try{
    const r=await f();
    if(r.err){await fail(r);return}
    ok&&ok(r);haptic('success');
    await load();render(true)}
  catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');api.syncPlayer().then(load).then(()=>render(true)).catch(()=>{})}
  finally{BUSY=false}}

const bkEx=a=>{const [d,n]=a.split(':');if(+n<1)return;op(()=>api.bankExchange(d,+n),()=>{win(d=='buy'?'#22c55e':'#f5b82e');banner(d=='buy'?'Куплено':'Продано',d=='buy'?'+'+n+' $ за '+fmt(n*BANK.usdBuy)+' ₽':'+'+fmt(n*BANK.usdSell)+' ₽ за '+n+' $')})};
const bkOpen=()=>{
  const d=CUR=='rub'?BANK.depRub:BANK.depUsd,n=Math.floor(parseAsk(TXT));
  if(!depOk(d,n))return;
  op(()=>api.bankDepositOpen(CUR,n,DAYS),()=>{TXT='';banner('Вклад открыт',fmt(n)+' '+cur(CUR)+' на '+dn(DAYS))})};
const bkClaim=a=>op(()=>api.bankDepositClaim(+a),r=>{win('#f5b82e');banner('Вклад получен','+'+fmt(r.res.payout)+' '+cur(r.res.cur))});
const bkLuck=()=>op(()=>api.bankBuyLuck(),r=>{win('#f5b82e');banner('Буст удачи','Прокрутов с бустом: '+r.res)});
const bkLots=()=>op(()=>api.bankBuyLots(),r=>{win('#4ade80');banner('Слоты рынка','Дополнительно +'+r.res+' лотов')});
async function bkWear(a){try{await api.equipItem('title',a);banner('Титул надет',BANK.items.find(x=>x.id==a).n);render(true)}catch(e){console.error(e);banner('Не получилось','Попробуйте ещё раз')}}

function bkItemDlg(a){
  const it=BANK.items.find(x=>x.id==a);if(!it)return;
  sm(`<div class="dlg"><h3>Купить титул?</h3><div class="bk-res"><span class="bk-ttl" style="--cc:${it.c}">${it.n}</span></div><p class="tl" style="margin:12px 0">${it.d}.<br>Тираж: осталось ${stock(it).left} из ${it.max}. Он будет сразу надет.</p><button class="btn" ${S.usd<it.usd?'disabled':''} data-click="bkItemOk" data-arg="${it.id}">Купить · ${fmt(it.usd)} $</button><button class="btn" data-click="cm">Отмена</button></div>`)}
async function bkItemOk(a){
  cm();
  const it=BANK.items.find(x=>x.id==a);if(!it||BUSY)return;
  BUSY=true;
  try{
    const r=await api.bankBuyItem(a);
    if(r.err&&r.err!='owned'){await fail(r);return}
    await api.equipItem('title',a);
    banner('Титул куплен',it.n);win(it.c);
    await load();render(true)}
  catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');api.syncPlayer().then(load).then(()=>render(true)).catch(()=>{})}
  finally{BUSY=false}}

// Сундук трясётся ~1 с, затем карточка машины: цвет, звук и частицы по классу
async function reveal(c,car,r){
  const col=RAR[car.r].c,k=car.r;
  sm(`<div class="dlg"><div class="bk-open" style="--rc:${c.col}">${crate(c.col,150)}<div class="tl">Открываем «${c.n}»…</div></div></div>`);
  riser(1);haptic('light');
  await new Promise(f=>setTimeout(f,1000));
  if(!$('md').classList.contains('on'))return;
  $('sh').innerHTML=`<div class="dlg bk-rv" style="--rc:${col}"><div class="bk-rl">${CAR_CLS[k]}</div><img src="${car.img}" alt="${esc(car.n)}"><h2>${esc(car.n)}</h2>`
    +(r.dup?`<div class="bk-rd dup">Такая машина уже есть<br><b>Возврат +${fmt(r.refund)} ₽</b></div>`:`<div class="bk-rd">Новая машина в вашем гараже</div>`)
    +`<button class="btn" data-click="cm">Отлично</button></div>`;
  dropSound(k);haptic('success');
  if(S.fx<2){setTimeout(()=>burst(col,k>=2?k*14:8),250);if(k==4){document.body.classList.remove('shake');void document.body.offsetWidth;document.body.classList.add('shake')}}}
async function bkCase(a){
  const c=BANK.cases.find(x=>x.id==a);if(!c||BUSY)return;
  if(S.usd<c.usd){banner('Не хватает долларов','Нужно '+c.usd+' $');haptic('rigid');return}
  BUSY=true;
  try{
    const r=await api.openCaseUsd(a);
    if(r.err){await fail(r);return}
    const car=carById(r.car_id);
    if(!car)banner('Новая машина','Обновите игру, чтобы увидеть её');
    else await reveal(c,car,r);
    await load();render(true)}
  catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие');api.syncPlayer().then(load).then(()=>render(true)).catch(()=>{})}
  finally{BUSY=false}}

DRAW.bank=drawBank;
on({bkTab,bkXd,bkChip,bkCur,bkDays,bkAmtIn,bkEx,bkOpen,bkClaim,bkLuck,bkLots,bkWear,bkItemDlg,bkItemOk,bkCase});
