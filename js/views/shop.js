import {api} from '../api.js';
import {EQUIP_SLOTS, FXE, SHOP, SLOTS, itemOf} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {burst} from '../ui/fx.js';
import {banner} from '../ui/modal.js';
import {nickCls, plateHTML, titleHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Магазин: рамки, титулы и эффекты выпадения за рубли. Цены и права проверяет сервер (buy_item / equip_item).
let TAB='skin';
const TABS=SLOTS;
const SAMPLE={type:'civil',main:'А777АА',reg:'77',country:'RU',cls:1};
function preview(slot,it){
  if(slot=='skin')return `<div class="sp">${plateHTML(SAMPLE,'',it.id)}</div>`;
  if(slot=='nick')return `<div class="sp"><b class="${nickCls(it.id).trim()}" style="font-size:24px">${esc(S.nick||'Ваш ник')}</b></div>`;
  if(slot=='bg')return `<div class="sp"><div class="bgp scn-${it.id}"></div></div>`;
  if(slot=='show')return `<div class="sp scs">${plateHTML(SAMPLE)}</div>`;
  if(slot=='title')return `<div class="sp">${titleHTML(it.id)}</div>`;
  return `<div class="sp fxp">${FXE[it.id].pal.map(c=>`<i style="background:${c}"></i>`).join('')}<button class="tg off" data-click="fxTest" data-arg="${it.id}">Показать</button></div>`}
const card=(slot,it)=>{
  const own=S.owned.includes(it.id),eq=S.equip[slot]==it.id;
  const btn=slot=='show'?(own?`<button class="big2" data-click="go" data-arg="profile">Открыть профиль</button>`:`<button class="big2" data-click="shopBuy" data-arg="${it.id}">Купить · ${fmt(it.p)} ₽</button>`):eq?`<button class="big2 alt" data-click="shopEq" data-arg="${slot}:">Снять</button>`
   :own?`<button class="big2" data-click="shopEq" data-arg="${slot}:${it.id}">Надеть</button>`
   :`<button class="big2" data-click="shopBuy" data-arg="${it.id}">Купить · ${fmt(it.p)} ₽</button>`;
  return `<div class="card"><h3>${it.n}<span class="tl">${eq?'Надето':own?'Куплено':''}</span></h3>${it.d?`<div class="tl" style="margin-bottom:10px">${it.d}</div>`:''}${preview(slot,it)}${btn}</div>`};
export function drawShop(){
  $('shopC').innerHTML=`<div class="sub" style="margin:0 6px 4px"><span>Баланс</span><b style="color:var(--tx)">${fmt(S.bal)} ₽</b></div>
   <div class="chips">${TABS.map(([k,n])=>`<button class="${TAB==k?'a':''}" data-click="shopTab" data-arg="${k}">${n}</button>`).join('')}</div>`
   +SHOP[TAB].map(it=>card(TAB,it)).join('')}
export async function shopBuy(id){
  const it=itemOf(id);if(!it)return;
  const r=await api.buyItem(id);
  if(r.err){banner('Не хватает денег','Нужно '+fmt(r.need)+' ₽');return}
  if(EQUIP_SLOTS.includes(it.slot))await api.equipItem(it.slot,id);   // купленное сразу надеваем
  banner('Куплено',it.n);haptic('success');render(true)}
export async function shopEq(a){const [slot,id]=String(a).split(':');await api.equipItem(slot,id);render(true)}
DRAW.shop=drawShop;
on({shopTab:a=>{TAB=a;render(true)},shopBuy,shopEq,fxTest:a=>burst('#fff',24,a)});
