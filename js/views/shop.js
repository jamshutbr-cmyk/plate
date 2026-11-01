import {api} from '../api.js';
import {EQUIP_SLOTS, FXE, PATRON, SHOP, SLOTS, itemOf} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {burst} from '../ui/fx.js';
import {icon} from '../ui/design.js';
import {banner,cm,sm} from '../ui/modal.js';
import {nickCls, plateHTML, titleHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';
import {tripleBanner, tripleCard} from './multi.js';

// Магазин: рамки, титулы и эффекты выпадения за рубли. Цены и права проверяет сервер (buy_item / equip_item).
let TAB='skin';const SELECTED={};
const TABS=SLOTS;
const MATERIALS={carbon:'#23272f',silver:'#e1e5eb',bronze:'#d2b090',gold:'#f0d886',rose:'#efd6d6',emerald:'#133f35',ruby:'#642b33',sapphire:'#223b61',sunset:'#edc3cb',neon:'#142c34',midnight:'#1d2432',aurora:'#c8e1df',holo:'#ded8ef'};
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
// Выдаваемые титулы (не продаются): показываем только тем, кому выдали
const grantedCards=()=>PATRON.titles.filter(it=>S.owned.includes(it.id)).map(it=>{
  const eq=S.equip.title==it.id;
  return `<div class="card"><h3>${it.n}<span class="tl">${eq?'Надето':'Особый'}</span></h3><div class="tl" style="margin-bottom:10px">${it.d}</div><div class="sp">${titleHTML(it.id)}</div>${eq?`<button class="big2 alt" data-click="shopEq" data-arg="title:">Снять</button>`:`<button class="big2" data-click="shopEq" data-arg="title:${it.id}">Надеть</button>`}</div>`}).join('');
export function drawShop(){
 if(TAB==='triple'){$('shopC').innerHTML=`<div class="atelier-tabs">${TABS.map(([k,n])=>`<button class="${TAB===k?'a':''}" data-click="shopTab" data-arg="${k}">${n}</button>`).join('')}</div>${tripleCard()}`;return}
 const items=SHOP[TAB],it=items.find(x=>x.id===SELECTED[TAB])||items[0];SELECTED[TAB]=it.id;const own=S.owned.includes(it.id),eq=S.equip[TAB]===it.id;
 const action=TAB==='show'&&own?`<button class="v3-primary" data-click="go" data-arg="profile">Открыть профиль →</button>`:eq?`<button class="atelier-unwear" data-click="shopEq" data-arg="${TAB}:">Снять оформление</button>`:own?`<button class="v3-primary" data-click="shopEq" data-arg="${TAB}:${it.id}">Применить ${icon('check')}</button>`:`<button class="v3-primary" data-click="atelierAsk" data-arg="${it.id}">Выбрать · ${fmt(it.p)} ₽ ${icon('arrow')}</button>`;
 $('shopC').innerHTML=`<div class="atelier-intro"><span class="v3-kicker">PLATE / DESIGN ATELIER</span><h1>Не такой,<br><em>как у всех.</em></h1><span>Твой баланс ${fmt(S.bal)} ₽</span></div><div class="atelier-layout"><div class="atelier-tabs" role="tablist">${TABS.map(([k,n],i)=>`<button role="tab" aria-selected="${TAB===k}" class="${TAB===k?'a':''}" data-click="shopTab" data-arg="${k}"><span>0${i+1}</span>${n}</button>`).join('')}</div><div class="atelier-content"><section class="atelier-view"><div class="atelier-view-top"><span>ПРЕДПРОСМОТР / ${TABS.find(x=>x[0]===TAB)?.[1]}</span><b>${eq?'ПРИМЕНЕНО':own?'В КОЛЛЕКЦИИ':'ПРИМЕРКА'}</b></div>${preview(TAB,it)}<div class="atelier-caption"><h2>${it.n}</h2><span>${String(items.indexOf(it)+1).padStart(2,'0')} / ${items.length}</span></div></section><div class="atelier-product-info"><p>${it.d||'Деталь, которая делает коллекцию твоей.'}</p>${action}</div><div class="atelier-options" role="listbox" aria-label="Варианты оформления">${items.map((x,i)=>`<button role="option" aria-selected="${x.id===it.id}" class="${x.id===it.id?'a':''}" data-click="atelierSelect" data-arg="${x.id}"><i style="--option-color:${MATERIALS[x.id]||'#a8b3bf'}">${TAB==='skin'?'<span></span>':icon(({nick:'profile',bg:'theme',show:'col',title:'ach',drop:'studio'})[TAB]||'shop')}</i><span><b>${x.n}</b><small>${S.owned.includes(x.id)?S.equip[TAB]===x.id?'Применено':'Уже твоё':fmt(x.p)+' ₽'}</small></span><em>${x.id===it.id?'✓':'+'}</em></button>`).join('')}</div>${TAB==='title'?grantedCards():''}</div></div>`;
}
export async function shopBuy(id){
  const it=itemOf(id);if(!it)return;
  const r=await api.buyItem(id);
  if(r.err){banner('Не хватает денег','Нужно '+fmt(r.need)+' ₽');return}
  if(EQUIP_SLOTS.includes(it.slot))await api.equipItem(it.slot,id);   // купленное сразу надеваем
  banner('Куплено',it.n);haptic('success');render(true)}
export async function shopEq(a){const [slot,id]=String(a).split(':');await api.equipItem(slot,id);render(true)}
DRAW.shop=drawShop;
on({atelierSelect:a=>{SELECTED[TAB]=a;render(true)},atelierAsk:a=>{const it=itemOf(a);if(!it)return;sm(`<div class="v3-tools"><span class="v3-kicker">АТЕЛЬЕ / ПРИОБРЕТЕНИЕ</span><h2>${it.n}</h2><p>${it.d||'Оформление для твоей коллекции.'}</p><div class="v3-price-review"><span>Стоимость</span><b>${fmt(it.p)} ₽</b></div><button class="v3-primary" data-click="atelierConfirm" data-arg="${a}">Купить и применить</button></div>`)},atelierConfirm:a=>{cm();return shopBuy(a)},shopTab:a=>{TAB=a;render(true)},shopBuy,shopEq,fxTest:a=>burst('#fff',24,a)});
