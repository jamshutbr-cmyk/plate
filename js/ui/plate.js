import {CN, NOREG, RAR, SAMP, itemOf} from '../config.js';
import {S} from '../state.js';
import {esc} from '../util.js';

// HTML номерной плашки и точек редкости. skin — рамка из магазина: по умолчанию надетая у нас, '' = без рамки (чужие номера).
// У военных, дипломатических и ретро номеров блока региона нет (класс nr): регион остаётся в данных и в цене, но на плашке его не рисуем.
// Длинный текст (именной номер, p.bound, до 10 знаков, а также любой номер длиннее шести знаков) кладём в <span class="nm">: его по ширине плашки подгоняет js/ui/fitname.js.
// Признак длины, а не p.bound: в чужой витрине (get_showcase) и в других ответах сервера bound не приходит, и тогда текст рисовался на полный размер и обрезался по краям.
// Для именного номера задаём стартовый размер в em (до подгонки текст не вылезает), для остальных стартуем с 1em: подгонка только сожмёт, если не влезает.
// Текст экранируем: он придуман игроком.
const pmText=p=>{
  const t=String(p.main==null?'':p.main);
  if(t.length<=6)return esc(t);
  // именной: стартовый размер в em; обычный длинный (BY, дипломатический): класс f, обычная строчная вёрстка, пока текст влезает, вид не меняется
  return p.bound?`<span class="nm" style="font-size:${Math.max(.3,5.2/t.length).toFixed(2)}em">${esc(t)}</span>`:`<span class="nm f">${esc(t)}</span>`}
export function plateHTML(p,c='',skin=S.equip.skin){const nr=NOREG.includes(p.type);return `<div class="plate t-${p.type}${nr?' nr':''}${p.cls!=null?' rz'+p.cls:''}${skin?' sk-'+skin:''} ${c}"><div class="pm">${pmText(p)}</div>${nr?'':`<div class="pr">${p.reg}<small>${CN[p.country].cc} <i class="flag fl-${p.country}"></i></small></div>`}</div>`}
// Образец номера типа k для списков (каталог, альбом, шансы): cls — редкость 0..4, если у типа есть такой образец
export function sampleMain(c,k,cls=0){return c=='BY'?SAMP.BY[cls]:(SAMP.RU[k]||SAMP.RU.civil)[cls]}
export function dots(r){return `<div class="dots">${RAR.map((_,i)=>`<i style="${i<=r?'background:'+RAR[r].c:''}"></i>`).join('')}</div>`}
// Титул игрока (плашка с цветом). Пусто, если титула нет.
export function titleHTML(id){const it=id&&itemOf(id);return it&&it.c?`<span class="ttl" style="--tc:${it.c}">${it.n}</span>`:''}

// Класс эффекта ника из магазина (id надетого предмета или пусто).
export const nickCls=id=>id?' nk nk-'+id:'';
