import {api} from '../api.js';
import {CLAN_REG, CLAN_SHOP} from '../config.js';
import {haptic} from '../platform.js';
import {regList} from '../data/regions.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {$, esc, fmt, parseAsk} from '../util.js';

// Кланы, этап 2: вкладки «Регионы» (торги за регион, бонус к выпадению) и «Магазин» (рамки, эффекты тега, титулы за деньги казны).
// Правила и цены считает ТОЛЬКО сервер (supabase/clan_regions.sql); здесь показ и действия. Подключается из clans.js через mount().
let X=null;                                   // контекст из clans.js: геттеры состояния и общие помощники
let RC='RU',RQ='',PICK=null,BA='';            // страна списка, поиск региона, выбранный регион {c,r}, сумма ставки

const short=n=>n>=1e9?+(n/1e9).toFixed(2)+' млрд':n>=1e6?+(n/1e6).toFixed(1)+' млн':fmt(n);
const NAMES=c=>regList(c).map(x=>x.n);
const boardOf=(c,r)=>(X.ex().board||[]).find(b=>b.c==c&&b.r==r)||null;
const bonus=b=>b&&b.hm?CLAN_REG.def/100:1;
const leadEff=b=>b&&b.la?b.la*(b.h&&b.h==b.l?CLAN_REG.def/100:1):0;

export const styleCls=(fr,fx)=>`${fr?' '+fr.replace('_','-'):''}${fx?' '+fx.replace('_','-'):''}`;

// ---------- Регионы ----------
function mineRows(){
  const ex=X.ex(),held=ex.held||[],bids=(ex.board||[]).filter(b=>b.m);
  const h=held.map(o=>`<div class="cl-rg"><div class="cl-i"><b>${esc(o.r)}</b><span>${o.c} · удерживаем</span></div><em class="cl-x3">×${CLAN_REG.boost}</em></div>`).join('');
  const t=bids.map(b=>{
    const ok=b.lm;
    return `<div class="cl-rg"><div class="cl-i"><b>${esc(b.r)}</b><span>ставка ${short(b.m)}${ok?'':`, лидер ${esc(b.l||'')} ${short(b.la)}`}</span></div><em class="cl-st ${ok?'ok':'bad'}">${ok?'лидируем':'перебили'}</em></div>`}).join('');
  return {h,t,hn:held.length,tn:bids.length}}

function picker(){
  const q=RQ.trim().toLowerCase(),list=NAMES(RC).filter(n=>!q||n.toLowerCase().includes(q)).slice(0,40);
  const row=n=>{
    const b=boardOf(RC,n),sel=PICK&&PICK.c==RC&&PICK.r==n;
    const sub=b?`${b.h?`держит ${esc(b.h)}${b.hm?' (вы)':''}`:'свободен'}${b.l?`, лидер ${esc(b.l)} ${short(b.la)}`:''}`:'свободен';
    return `<button class="cl-pk${sel?' a':''}" data-click="clPick" data-arg="${esc(n)}"><b>${esc(n)}</b><span>${sub}</span></button>`};
  return list.length?list.map(row).join(''):'<p class="cl-fine">Такого региона нет.</p>'}

function bidPanel(c){
  if(!PICK)return '';
  const b=boardOf(PICK.c,PICK.r),mine=b&&b.m||0;
  return `<div class="cl-bid"><h3>${esc(PICK.r)}</h3>
    <p class="cl-fine">${b&&b.l?`Лидер: ${esc(b.l)}, ${short(b.la)}${b.hm?'. Регион сейчас ваш, +25% к ставке':''}.`:'Пока без ставок.'}${mine?` Ваша ставка: ${short(mine)}.`:''}</p>
    <div class="cl-chips">${[1e7,5e7,1e8,5e8].filter(v=>v<=c.treasury).map(v=>`<button data-click="clBidChip" data-arg="${v}">${short(v)}</button>`).join('')}</div>
    <input class="gq" id="clBA" inputmode="text" placeholder="Сумма, например 50м" maxlength="16" autocomplete="off" value="${esc(BA)}" data-input="clBA">
    <div class="cl-prev" id="clBP"></div>
    <button class="cl-go wide" id="clBG" disabled data-click="clBid">Поставить из казны</button></div>`}

export function tabRegions(c,mgr){
  const {h,t,hn,tn}=mineRows(),ex=X.ex(),top=(ex.board||[]).filter(b=>b.l).slice(0,5);
  return X.sec(`<h3>Регионы клана, ${hn} из ${c.lvl}</h3>
      <p class="cl-fine">Участникам клана номера этих регионов выпадают в ${CLAN_REG.boost} раза чаще.</p>
      ${h||'<p class="cl-fine cl-nx">Пока ничего не удерживаем.</p>'}`)
    +X.sec(`<h3>Торги этой недели${tn?', '+tn+' из '+c.lvl:''}</h3>${t||'<p class="cl-fine">Ставок нет.</p>'}
      <p class="cl-fine cl-nx">Итоги в понедельник, через ${X.cd(X.seasonEnd())}</p>`)
    +(mgr?X.sec(`<h3>Новая ставка</h3><p class="cl-fine">Ставка сгорает. Хозяин региона получает +25% к своей ставке.</p>
      <div class="cl-seg" style="margin-top:14px">${[['RU','Россия'],['BY','Беларусь']].map(([k,n])=>`<button class="${RC==k?'a':''}" data-click="clRC" data-arg="${k}">${n}</button>`).join('')}</div>
      <input class="gq" id="clRQ" placeholder="Найти регион" maxlength="30" autocomplete="off" value="${esc(RQ)}" data-input="clRQ">
      <div class="cl-pks" id="clPks">${picker()}</div>${bidPanel(c)}`,'burn')
      :X.sec(`<p class="cl-fine">Ставки делает глава или заместитель.</p>`))
    +(top.length?X.sec(`<h3>Лидеры недели</h3>${top.map(b=>`<div class="cl-rg"><div class="cl-i"><b>${esc(b.r)}</b><span>${esc(b.l)}</span></div><b class="cl-am2">${short(b.la)}</b></div>`).join('')}`,'last'):'')}

export function bidPrev(c){
  const p=$('clBP'),g=$('clBG');if(!p||!g||!PICK||!c)return;
  const n=Math.floor(parseAsk(BA)),b=boardOf(PICK.c,PICK.r),mine=b&&b.m||0,eff=(mine+n)*bonus(b),lead=b&&!b.lm?leadEff(b):0;
  const ok=n>=CLAN_REG.bidMin&&n<=c.treasury&&!c.lapsed;
  p.className='cl-prev'+(ok?' ok':'');
  p.textContent=!BA.trim()||n<CLAN_REG.bidMin?`От ${fmt(CLAN_REG.bidMin)} ₽`:n>c.treasury?'В казне не хватает':c.lapsed?'Сначала погасите содержание':lead&&eff<=lead?`До лидера не хватает ${short(Math.ceil(lead/bonus(b))-mine-n+1)}`:'Вы станете лидером';
  g.disabled=!ok}

// ---------- Магазин ----------
const OWN=id=>(X.ex().shop||[]).includes(id);
function itemRow(it,c,mgr){
  const st=X.ex().style||{},own=OWN(it.id),low=c.lvl<it.lvl,eq=it.slot=='frame'?st.frame==it.id:st.fx==it.id;
  const pv=it.slot=='title'?`<span class="ttl" style="--tc:${it.c}">${esc(it.n)}</span>`:X.plate(c.tag,c.lvl,'cl-md-p'+styleCls(it.slot=='frame'?it.id:'',it.slot=='fx'?it.id:''));
  const price=low?'с '+it.lvl+' ур.':short(it.p);
  const buy=mgr?`<button class="cl-go sm" ${low||c.treasury<it.p||c.lapsed?'disabled ':''}data-click="clBuy" data-arg="${it.id}">${price}</button>`:`<span class="cl-fine">${price}</span>`;
  let btn;
  if(it.slot=='title'){const me=X.myTitle()==it.id;btn=own?`<button class="cl-ghost sm" data-click="clTitle" data-arg="${me?'':it.id}">${me?'Снять':'Надеть'}</button>`:buy}
  else btn=own?(mgr?`<button class="cl-ghost sm" data-click="clWear" data-arg="${it.id}">${eq?'Снять':'Надеть'}</button>`:`<span class="cl-fine">${eq?'надето':'куплено'}</span>`):buy;
  return `<div class="cl-sh"><div class="cl-shp">${pv}</div><div class="cl-i">${it.slot=='title'?'':`<b>${esc(it.n)}</b><span>${esc(it.d)}</span>`}</div>${btn}</div>`}

export function tabShop(c,mgr){
  const g=s=>CLAN_SHOP.filter(i=>i.slot==s).map(i=>itemRow(i,c,mgr)).join('');
  return X.sec(`<h3>Рамки тега</h3><p class="cl-fine">Видны всем рядом с ником.</p>${g('frame')}`)
    +X.sec(`<h3>Эффекты тега</h3>${g('fx')}`)
    +X.sec(`<h3>Клановые титулы</h3><p class="cl-fine">Купленное кланом надевает любой участник. Если выйти, титул пропадает.</p>${g('title')}`,'last')}

// ---------- Действия ----------
export function mount(ctx){
  X=ctx;
  on({
    clRC:k=>{RC=k;PICK=null;X.render()},
    clRQ:(_,el)=>{RQ=el.value;const box=$('clPks');if(box)box.innerHTML=picker()},
    clPick:n=>{PICK={c:RC,r:n};X.render()},
    clBA:(_,el)=>{BA=el.value;bidPrev(X.clan())},
    clBidChip:v=>{BA=String(v);X.render()},
    clBid:()=>{
      const c=X.clan(),n=Math.floor(parseAsk(BA));if(!PICK||!(n>=CLAN_REG.bidMin&&n<=c.treasury))return;
      X.dlg('Поставить '+fmt(n)+' ₽ на '+esc(PICK.r)+'?','Деньги уйдут из казны и сгорят, даже если ставку перебьют. Итоги подведут в понедельник.','clBidGo',n,'Поставить',0)},
    clBidGo:n=>X.act(async()=>{
      X.cm();const r=await api.clanBid(PICK.c,PICK.r,+n);
      if(r.err)return X.fail(r);
      BA='';X.win();banner('Ставка принята','−'+fmt(+n)+' ₽ · '+PICK.r);await X.reload()}),
    clBuy:id=>{
      const it=CLAN_SHOP.find(x=>x.id==id);if(!it)return;
      X.dlg('Купить «'+esc(it.n)+'»?','Из казны спишется '+fmt(it.p)+' ₽. Деньги сгорят, товар останется у клана навсегда.','clBuyGo',id,'Купить',0)},
    clBuyGo:id=>X.act(async()=>{
      X.cm();const r=await api.clanBuy(id);
      if(r.err)return X.fail(r);
      X.win();banner('Куплено','Теперь это есть у клана');await X.reload()}),
    clWear:id=>X.act(async()=>{
      const it=CLAN_SHOP.find(x=>x.id==id),st={...(X.ex().style||{})},k=it.slot=='frame'?'frame':'fx';
      st[k]=st[k]==id?'':id;
      const r=await api.clanStyle(st.frame,st.fx);
      if(r.err)return X.fail(r);
      haptic('success');await X.reload()}),
    clTitle:id=>X.act(async()=>{
      const r=await api.clanTitle(id);
      if(r.err)return X.fail(r);
      haptic('success');await X.reload()})
  });
}
