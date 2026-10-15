import {CN, NOREG, RAR, SAMP, itemOf} from '../config.js';
import {S} from '../state.js';
import {esc} from '../util.js';

// HTML номерной плашки и точек редкости. skin — рамка из магазина: по умолчанию надетая у нас, '' = без рамки (чужие номера).
// У военных, дипломатических и ретро номеров блока региона нет (класс nr): регион остаётся в данных и в цене, но на плашке его не рисуем.
// Текст именного номера (p.bound) бывает длиннее обычных шести знаков: уменьшаем в em, чтобы влез при любом размере плашки (список, окно, превью).
// Текст экранируем: он придуман игроком.
const pmText=p=>p.bound&&p.main.length>6?`<span class="nm" style="font-size:${Math.max(.3,5.2/p.main.length).toFixed(2)}em">${esc(p.main)}</span>`:esc(p.main);
export function plateHTML(p,c='',skin=S.equip.skin){const nr=NOREG.includes(p.type);return `<div class="plate t-${p.type}${nr?' nr':''}${p.cls!=null?' rz'+p.cls:''}${skin?' sk-'+skin:''} ${c}"><div class="pm">${pmText(p)}</div>${nr?'':`<div class="pr">${p.reg}<small>${CN[p.country].cc} <i class="flag fl-${p.country}"></i></small></div>`}</div>`}
// Образец номера типа k для списков (каталог, альбом, шансы): cls — редкость 0..4, если у типа есть такой образец
export function sampleMain(c,k,cls=0){return c=='BY'?SAMP.BY[cls]:(SAMP.RU[k]||SAMP.RU.civil)[cls]}
export function dots(r){return `<div class="dots">${RAR.map((_,i)=>`<i style="${i<=r?'background:'+RAR[r].c:''}"></i>`).join('')}</div>`}
// Титул игрока (плашка с цветом). Пусто, если титула нет.
export function titleHTML(id){const it=id&&itemOf(id);return it&&it.c?`<span class="ttl" style="--tc:${it.c}">${it.n}</span>`:''}

// Класс эффекта ника из магазина (id надетого предмета или пусто).
export const nickCls=id=>id?' nk nk-'+id:'';
