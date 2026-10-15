import {api} from '../api.js';
import {DONATE, FXE, donateTier, donateVal, itemOf} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {burst} from '../ui/fx.js';
import {banner, cm, sm} from '../ui/modal.js';
import {nickCls, plateHTML, titleHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';
import {STAR, price} from '../ui/star.js';
import {namedHTML, namedPlateSpec, namedQuoted} from './named.js';

// Два экрана на одних данных. «Донат-шоп» (dshop): товары за Telegram Stars. «Поддержать» (support): пожертвование без товара,
// цель месяца, титулы благодарности и стена почёта. Цены и выдачу считает сервер (donate.sql), здесь только показ и запуск оплаты.
let TAB='named',D=null,WALL=null,LOADING=0,LOADED=0,TIP=0,BUSY=0;
const SAMPLE={type:'civil',main:'А777АА',reg:'77',country:'RU',cls:1};

const ERR={unsupported:['Оплата недоступна','Откройте игру из Telegram и обновите его до последней версии'],nopack:['Товар недоступен','Он снят с продажи'],amount:['Неверная сумма','Можно от '+DONATE.tip.min+' до '+fmt(DONATE.tip.max)+' ⭐'],
 limit:['Уже куплено','Этот товар покупается один раз'],owned:['Уже есть','Все предметы из набора у вас'],many:['Слишком много счетов','Оплатите или подождите немного'],
 taken:['Текст уже занят','Выберите другой'],blocked:['Текст не подошёл','Придумайте другой'],'bad text':['Текст не подошёл','От 2 до 10 знаков: буквы, цифры, пробел, дефис'],'bad region':['Нет такого региона','Введите код региона'],plate:['Номер не подошёл','Проверьте текст и регион'],
 telegram:['Telegram не ответил','Попробуйте ещё раз через минуту'],failed:['Оплата не прошла','Звёзды не списаны'],server:['Ошибка сервера','Попробуйте позже']};

// Данные экрана: один запрос на открытие, не чаще раза в 20 с. Падение сети не ломает экран: покажем каталог без «куплено».
async function ensure(force){
  if(LOADING||(!force&&Date.now()-LOADED<20000))return;
  LOADING=1;
  try{[D,WALL]=await Promise.all([api.donateState(),api.donateWall()]);LOADED=Date.now()}
  catch(e){console.error(e);LOADED=Date.now()-15000}
  finally{LOADING=0}
  render(true)}
const bought=id=>(D&&D.bought&&D.bought[id])|0;
const total=()=>D?D.donated:S.don;
const packOf=id=>DONATE.packs.find(p=>p.id==id);

// ---------- Описание товара ----------
function gives(p,x2){
  const v=donateVal(p,x2),o=[];
  if(v.usd)o.push(`<b>+${fmt(v.usd)} $</b>${x2?` <i>(${fmt(v.usd/2)} × 2)</i>`:''}`);
  if(v.rub)o.push(`<b>+${fmt(v.rub)} ₽</b>${x2?` <i>(${fmt(v.rub/2)} × 2)</i>`:''}`);
  if(v.days)o.push(`Тройной пасс <b>${v.days} дн.</b>`);
  if(v.luck)o.push(`Удача <b>${v.luck}</b> прокрутов`);
  if(v.luck2)o.push(`Удача <b>×2</b> навсегда`);
  for(const id of v.items){const it=itemOf(id);if(it)o.push(`${slotName(it.slot)} «${it.n}»${S.owned.includes(id)?' <i>(уже есть)</i>':''}`)}
  return o}
const slotName=s=>({skin:'Рамка',nick:'Ник',bg:'Фон',drop:'Эффект',title:'Титул'})[s]||'Предмет';
// Каталог: у каждой вкладки своя раскладка. Бусты строками, наборы крупными плитками, косметика сеткой с настоящим превью.
const SAMPLE2={type:'civil',main:'К001КК',reg:'77',country:'RU',cls:1};
const IC={boost:'#6b46d6',bundle:'#c47a12',item:'#c23d7a'};
const sumItems=ids=>DONATE.packs.filter(x=>x.k=='item'&&ids.includes(x.g.items[0])).reduce((a,x)=>a+x.st,0);
function buyBtn(p){   // цена, либо состояние «куплено» / «надеть»
  const n=bought(p.id),it=p.k=='item'?itemOf(p.g.items[0]):null;
  const done=(p.max&&n>=p.max)||(it&&S.owned.includes(it.id));
  if(it&&done)return S.equip[it.slot]==it.id?`<button class="dn-ghost" disabled>Надето</button>`:`<button class="dn-ghost" data-click="dnEq" data-arg="${it.slot}:${it.id}">Надеть</button>`;
  if(done)return `<button class="dn-ghost" disabled>Куплено</button>`;
  return `<button class="dn-pay" data-click="dnAsk" data-arg="${p.id}" aria-label="Купить ${esc(p.t)} за ${p.st} звёзд">${price(p.st)}</button>`}
function preview(it){
  if(it.slot=='skin')return `<div class="dn-pv">${plateHTML(SAMPLE,'',it.id)}</div>`;
  if(it.slot=='nick')return `<div class="dn-pv"><b class="${nickCls(it.id).trim()}">${esc(S.nick||'Ваш ник')}</b></div>`;
  if(it.slot=='bg')return `<div class="dn-pv bg scn-${it.id}"></div>`;
  if(it.slot=='drop'){const E=FXE[it.id];return `<div class="dn-pv fx" data-click="fxTest" data-arg="${it.id}" role="button" aria-label="Показать эффект">${E.pal.map(c=>`<i style="background:${c}"></i>`).join('')}<small>нажмите</small></div>`}
  return ''}
const rowBoost=p=>`<div class="dn-row2"><div class="dn-tileic" style="--ic:${IC[p.k]}">${p.ic}</div><div class="tx"><b>${p.t}</b><span>${p.d||''}</span></div>${buyBtn(p)}</div>`;
function tileBundle(p){
  const v=donateVal(p,0),chips=[];
  if(v.days)chips.push(`Пасс ${v.days} дн.`);if(v.luck)chips.push(`Удача ${v.luck}`);if(v.luck2)chips.push('Удача ×2 навсегда');if(v.items.length)chips.push(`Предметов: ${v.items.length}`);
  const sep=v.items.length?sumItems(v.items):0;
  return `<div class="dn-bun"><div class="dn-bh"><div class="dn-tileic" style="--ic:${IC.bundle}">${p.ic}</div><div class="tx"><b>${p.t}</b><span>${p.d||''}</span></div></div>
   <div class="dn-chips">${chips.map(c=>`<i>${c}</i>`).join('')}</div>
   <div class="dn-bf">${sep?`<div class="dn-was"><s>${price(sep)}</s><em>−${Math.round((1-p.st/sep)*100)}%</em></div>`:'<div></div>'}${buyBtn(p)}</div></div>`}
const tileItem=p=>{const it=itemOf(p.g.items[0]);return `<div class="dn-tile">${preview(it)}<div class="tx"><b>${slotName(it.slot)} «${it.n}»</b><span>${it.d}</span></div>${buyBtn(p)}</div>`};
// Витрина: единственный яркий элемент страницы. Показывает реальные предметы набора на реальном фоне набора
function spotlight(){
  const p=packOf('founder');if(!p||bought('founder')>=p.max)return '';
  const sep=sumItems(p.g.items),pct=Math.round((1-p.st/sep)*100);
  return `<div class="dn-spot scn-bgdn_nebula"><div class="dn-fan">${plateHTML(SAMPLE,'dn-f1','dn_obsidian')}${plateHTML(SAMPLE2,'dn-f2','dn_prism')}</div>
   <h2>${p.t}</h2><p>Обе рамки, оба ника, фон и эффект, а ещё тройной пасс на неделю и удача.</p>
   <div class="dn-sp-f"><div class="dn-was"><s>${price(sep)}</s><em>−${pct}%</em></div><button class="dn-cta" data-click="dnAsk" data-arg="founder">Получить за ${price(p.st)}</button></div></div>`}
export function drawDshop(){
  ensure();
  const list=DONATE.packs.filter(p=>p.k==TAB);
  const body=TAB=='named'?namedHTML(DONATE.packs.find(p=>p.id=='named').max-bought('named')):TAB=='boost'?list.map(rowBoost).join(''):TAB=='bundle'?list.map(tileBundle).join(''):`<div class="dn-grid">${list.map(tileItem).join('')}</div>`;
  $('dshopC').innerHTML=`<div class="dn-trust">${STAR}<span>Оплата звёздами Telegram. Покупка зачисляется сразу.</span></div>${TAB=='named'?spotlight():''}
   <div class="dn-seg" role="tablist">${DONATE.tabs.map(([k,n])=>`<button role="tab" aria-selected="${TAB==k}" class="${TAB==k?'a':''}" data-click="dnTab" data-arg="${k}">${n}</button>`).join('')}</div>${body}
   <button class="dn-link" data-click="go" data-arg="support"><b>Хотите просто поддержать?</b><span>Раздел без покупок: звёзды на сервер и новые функции</span><i>›</i></button>${history()}`}
function history(){
  const o=D&&D.orders||[];if(!o.length)return '';
  const st={paid:'Оплачено',refunded:'Возврат',review:'На проверке'};
  return `<h4 class="dn-h">Мои покупки</h4><div class="dn-hist">${o.map(x=>{const p=packOf(x.pack);return `<div><span>${p?p.t:x.pack=='tip'?'Поддержка проекта':x.pack}</span>${price(x.stars)}<small>${st[x.status]||x.status}, ${new Date(x.at).toLocaleDateString('ru-RU')}</small></div>`}).join('')}</div>
   <p class="dn-note">Не пришла покупка? Напишите боту команду /paysupport</p>`}

// ---------- Подтверждение и оплата ----------
function ask(id,amount){
  const p=id=='tip'?{id:'tip',t:'Поддержка проекта',ic:'💛',st:amount,g:{}}:packOf(id);if(!p)return;
  const q=id=='named'?namedQuoted():null;
  if(id=='named'&&!q){banner('Сначала проверьте номер','Введите номер и регион');return}
  const x2=p.x2&&bought(p.id)==0,g=id=='tip'?[]:q?[`Текст на плашке: <b>${esc(q.main)}</b>`,'Навсегда в вашей коллекции','Продать, обменять и передать нельзя']:gives(p,x2);
  sm(`<div class="dn-sheet">${q?`<div class="nm-pv">${plateHTML(q)}</div>`:`<div class="dn-big">${p.ic}</div>`}<h2>${p.t}</h2>
   ${g.length?`<ul class="dn-g">${g.map(x=>`<li>${x}</li>`).join('')}</ul>`:`<p class="tl" style="text-align:center">Добровольное пожертвование. Игровых бонусов нет, только титул благодарности за накопленную сумму</p>`}
   <div class="dn-sum"><span>К оплате</span><b>${STAR} ${fmt(p.st)}</b></div>
   <button class="big2 dn-buy" data-click="dnGo" data-arg="${id}:${p.st}"><span>Оплатить ${STAR} ${fmt(p.st)}</span></button>
   <button class="big2 alt" data-click="cm" style="margin-top:8px">Отмена</button>
   <p class="tl dn-note">Оплата проходит в Telegram. Товар цифровой, зачисляется автоматически</p></div>`)}
async function go(a){
  if(BUSY)return;
  const [id,st]=String(a).split(':');
  const plate=id=='named'?namedPlateSpec():undefined;
  if(id=='named'&&!plate){cm();banner('Сначала проверьте номер','Введите номер и регион');return}
  BUSY=1;
  sm(`<div class="dn-sheet"><div class="dn-big dn-spin">${STAR}</div><h2>Ждём оплату…</h2><p class="tl" style="text-align:center">Завершите платёж в окне Telegram</p></div>`);
  try{
    const r=await api.donateBuy(id,id=='tip'?+st:undefined,plate);
    if(r.ok){success(id,r.res);return}
    cm();
    if(r.wait){banner('Платёж обрабатывается','Покупка появится в течение минуты');return}
    if(r.err=='cancelled')return;
    const e=ERR[r.err]||ERR.server;banner(e[0],e[1])}
  finally{BUSY=0;ensure(true)}}
function success(id,res){
  haptic('success');burst('#f5b82e',40,'sparks');
  const lines=[];
  if(res.usd)lines.push(`+${fmt(res.usd)} $${res.doubled?' <i>(×2 за первую покупку)</i>':''}`);
  if(res.rub)lines.push(`+${fmt(res.rub)} ₽${res.doubled&&!res.usd?' <i>(×2 за первую покупку)</i>':''}`);
  if(res.pass_days)lines.push(`Тройной пасс на ${res.pass_days} дн.`);
  if(res.luck)lines.push(`Удача: +${res.luck} прокрутов`);
  if(res.luck2)lines.push('Удача ×2 навсегда');
  for(const x of res.items||[]){const it=itemOf(x);if(it)lines.push(`${slotName(it.slot)} «${it.n}»`)}
  const tiers=(res.tiers||[]).map(x=>itemOf(x)).filter(Boolean);
  sm(`<div class="dn-sheet"><div class="dn-big">${id=='tip'?'💛':'✅'}</div><h2>${id=='tip'?'Спасибо!':res.plate?'Номер ваш!':'Покупка зачислена'}</h2>${res.plate?`<div class="nm-pv">${plateHTML({...res.plate,bound:true})}</div><p class="tl" style="text-align:center">🔒 Именной номер навсегда в вашей коллекции</p>`:''}
   ${lines.length?`<ul class="dn-g">${lines.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}
   ${tiers.map(t=>`<div class="dn-new">Новый титул: ${titleHTML(t.id)}</div>`).join('')}
   <p class="tl" style="text-align:center">Всего вы поддержали проект на ${STAR} ${fmt(res.donated)}</p>
   <button class="big2" data-click="cm">Отлично</button></div>`)}

// ---------- Поддержать проект ----------
function goalCard(){
  const g=D&&D.goal;if(!g)return '';
  const pc=Math.min(100,Math.round(g.raised/g.target*100));
  return `<div class="dn-panel dn-goal"><div class="dn-gh"><b>Цель месяца: ${esc(g.title)}</b><span>${pc}%</span></div>
   <div class="dn-bar"><i style="width:${pc}%"></i></div>
   <div class="dn-gf"><span>${STAR} ${fmt(g.raised)} из ${fmt(g.target)}</span><span>${g.backers?`Поддержали: ${fmt(g.backers)}`:'Станьте первым в этом месяце'}</span></div></div>`}
function tiersCard(){
  const t=total(),cur=donateTier(t),next=DONATE.tiers.find(x=>x.need>t);
  return `<div class="dn-panel"><h3 class="dn-t">Титулы благодарности</h3><p class="dn-hint">Выдаются автоматически за общую сумму ваших звёзд в игре. Вы поддержали на ${price(t)}</p>
   ${DONATE.tiers.map(x=>{const own=S.owned.includes(x.id),eq=S.equip.title==x.id;
    return `<div class="dn-tier${own?' own':''}">${titleHTML(x.id)}<small>от ${STAR} ${fmt(x.need)}</small>${own?(eq?`<em>Надето</em>`:`<button class="tg" data-click="dnEq" data-arg="title:${x.id}">Надеть</button>`):`<em>ещё ${fmt(x.need-t)}</em>`}</div>`}).join('')}
   ${next&&cur?`<div class="tl" style="margin-top:8px">До «${next.t}»: ${STAR} ${fmt(next.need-t)}</div>`:''}</div>`}
function wallCard(){
  const w=WALL||[];
  return `<div class="dn-panel"><h3 class="dn-t">Стена почёта</h3>${w.length?w.map((x,i)=>{const t=DONATE.tiers.find(y=>y.n==x.tier);
   return `<div class="dn-w"><span class="dn-rk">${i+1}</span><b>${esc(x.nick)}</b>${t?`<span class="ttl" style="--tc:${t.c}">${t.t}</span>`:''}<small>${STAR} ${fmt(x.donated)}</small></div>`}).join(''):`<div class="tl">Пока пусто. Станьте первым!</div>`}
   <label class="dn-pub"><input type="checkbox" ${S.dpub?'checked':''} data-change="dnPub"> Показывать меня на стене</label></div>`}
export function drawSupport(){
  ensure();
  const keep=$('tipIn')?$('tipIn').value:'';
  $('supC').innerHTML=`<div class="dn-panel dn-ph"><div class="dn-tileic" style="--ic:#c23d7a">💛</div><div class="tx"><b>Спасибо, что вы здесь</b><span>Игру делает один человек. Звёзды идут на сервер, хостинг и новые функции. Покупать ничего не нужно: это просто «спасибо».</span></div></div>
   ${goalCard()}
   <div class="dn-panel"><h3 class="dn-t">Закинуть звёздочки</h3><p class="dn-hint">Любая сумма помогает</p>
    <div class="dn-tips">${DONATE.tip.amounts.map(a=>`<button data-click="dnTip" data-arg="${a}">${price(a)}</button>`).join('')}</div>
    <div class="dn-cust"><input id="tipIn" class="dn-in" type="number" inputmode="numeric" min="${DONATE.tip.min}" max="${DONATE.tip.max}" placeholder="Своя сумма" data-input="dnTipIn"><button id="tipBtn" class="dn-cta" data-click="dnTipGo">Отправить</button></div></div>
   ${tiersCard()}${wallCard()}`;
  if(keep){$('tipIn').value=keep;$('tipBtn').innerHTML=TIP>=DONATE.tip.min?`Отправить ${price(Math.min(TIP,DONATE.tip.max))}`:'Отправить'}}

on({
 dnTab:a=>{TAB=a;render(true)},
 dnAsk:a=>ask(a),
 dnGo:go,
 dnTip:a=>ask('tip',+a),
 dnTipIn:(a,el)=>{TIP=Math.floor(+el.value)||0;$('tipBtn').innerHTML=TIP>=DONATE.tip.min?`Отправить ${price(Math.min(TIP,DONATE.tip.max))}`:'Отправить'},
 dnTipGo:()=>{
  if(TIP<DONATE.tip.min||TIP>DONATE.tip.max){banner('Неверная сумма','От '+DONATE.tip.min+' до '+fmt(DONATE.tip.max)+' ⭐');return}
  ask('tip',TIP)},
 dnEq:async a=>{const [slot,id]=String(a).split(':');await api.equipItem(slot,id);haptic('light');render(true)},
 dnPub:async(a,el)=>{try{await api.donatePublic(el.checked)}catch(e){el.checked=!el.checked;throw e}ensure(true)}});
DRAW.dshop=drawDshop;DRAW.support=drawSupport;
