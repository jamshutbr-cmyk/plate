import {api} from '../api.js';
import {PRESTIGE, SELL_PCT, perkCost, rebNeed, rebStars} from '../config.js';
import {haptic} from '../platform.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {sel} from '../ui/uistate.js';
import {burst, chime} from '../ui/fx.js';
import {banner, cm, sm} from '../ui/modal.js';
import {$, esc, fmt} from '../util.js';

// Перерождение: сброс забега за звёзды и постоянные бонусы. Условия, награды и цены считает ТОЛЬКО сервер
// (supabase/prestige.sql); PRESTIGE и хелперы в config.js нужны лишь для показа.
const ERRS={level:'Уровень ещё мал',listings:'Сначала снимите лоты с рынка',deposits:'Сначала заберите вклады в банке',stars:'Не хватает звёзд',max:'Бонус уже на максимуме'};
const fail=r=>{banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');haptic('rigid');render()};
const effect=(k,lv)=>k=='sell'?`${SELL_PCT+lv}%`:k=='cash'?`${fmt(50000+PRESTIGE.cashStep*lv)}\u00a0₽`:`${PRESTIGE.usdStep*lv}\u00a0$`;

const lvWord=n=>n%10==1&&n%100!=11?'уровень':n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?'уровня':'уровней';
const GLYPH={sell:'%',cash:'₽',usd:'$'};
const C=2*Math.PI*72;   // длина окружности кольца (r=72)
export function drawPrestige(){
 const need=rebNeed(S.rb),ok=S.lvl>=need,gain=rebStars(S.lvl),frac=Math.min(1,S.lvl/need);
 const perks=PRESTIGE.perks.map(p=>{
  const lv=S.perks[p.k]||0,mx=lv>=p.max,c=perkCost(lv);
  const pips=Array.from({length:p.max},(_,i)=>`<i class="${i<lv?'f':''}"></i>`).join('');
  return `<div class="pr-perk"><div class="pr-ic">${GLYPH[p.k]}</div><div class="pr-nm">${esc(p.n)}</div>
   <div class="pr-ef">${esc(p.d)}.<br>Сейчас: <b>${effect(p.k,lv)}</b>${mx?'':` <i>→ ${effect(p.k,lv+1)}</i>`}</div>
   ${mx?'<button class="pr-buy mx" disabled>Максимум</button>':`<button class="pr-buy" ${S.stars<c?'disabled ':''}data-click="buyPerk" data-arg="${p.k}">${c} ★</button>`}
   <div class="pr-pips">${pips}</div></div>`}).join('');
 $('prestC').innerHTML=`<div class="pr-hero">
  <div class="pr-ring${ok?' ok':''}"><svg viewBox="0 0 176 176"><defs><linearGradient id="prg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd45a"/><stop offset="1" stop-color="#d9981a"/></linearGradient></defs><circle class="tr" cx="88" cy="88" r="72"/><circle class="fl" cx="88" cy="88" r="72" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-frac)).toFixed(1)}"/></svg>
   <div class="pr-mid"><b>${S.lvl}</b><span>${ok?'порог '+need+' пройден':'из '+need+' уровней'}</span></div></div>
  <p class="pr-sub">${ok?`Можно переродиться и получить <b>${gain} ★</b>. Чем выше уровень, тем больше звёзд.`:`Ещё <b>${need-S.lvl}</b> ${lvWord(need-S.lvl)} до перерождения. Следующий порог будет на ${PRESTIGE.lvlStep} выше.`}</p>
  <button class="pr-cta${ok?' rdy':''}" ${ok?'':'disabled '}data-click="askRebirth">Переродиться${ok?`<em>+${gain} ★</em>`:''}</button></div>
 <div class="pr-stat"><div class="st"><b>★ ${S.stars}</b><span>звёзд на счету</span></div><div><b>${S.rb}</b><span>${S.rb==1?'перерождение':'перерождений'} сделано</span></div></div>
 <h3 class="pr-h">Бонусы за звёзды</h3>${perks}
 <div class="pr-rules"><div class="lose"><h4>Сбрасывается</h4><ul><li>номера и сейф</li><li>деньги и доллары</li><li>уровень и опыт</li><li>вместимость, автопродажа</li><li>вклады и лоты</li></ul></div><div class="keep"><h4>Остаётся</h4><ul><li>статистика и достижения</li><li>альбом регионов</li><li>машины</li><li>покупки в магазине</li><li>ежедневный бонус</li></ul></div></div>`}

export function askRebirth(){
 sm(`<div class="dlg"><h3>Переродиться?</h3><p class="tl">Номера, деньги, $, уровень и вклады обнулятся. Вы получите ${rebStars(S.lvl)} ★.</p><button class="btn red" data-click="doRebirth">Переродиться</button><button class="btn" data-click="cm">Отмена</button></div>`)}
export async function doRebirth(){
 cm();const r=await api.rebirth();
 if(r.err)return fail(r);
 sel.clear();$('stage').innerHTML='';burst('#f5b82e',24);chime(1);haptic('success');banner('Новое рождение','+'+r.stars+' ★');go('prestige')}
export async function buyPerk(k){
 const r=await api.buyPerk(k);
 if(r.err)return fail(r);
 burst('#f5b82e',12);chime(1);haptic('success');render()}

DRAW.prestige=drawPrestige;
on({askRebirth,doRebirth,buyPerk,cm});
