import {CN, NOREG, RAR, SAMP, itemOf} from '../config.js';
import {S} from '../state.js';
import {esc} from '../util.js';

// HTML номерной плашки и точек редкости. skin — рамка из магазина: по умолчанию надетая у нас, '' = без рамки (чужие номера).
// У военных, дипломатических и ретро номеров блока региона нет (класс nr): регион остаётся в данных и в цене, но на плашке его не рисуем.
export function plateHTML(p,c='',skin=S.equip.skin){
 const nr=NOREG.includes(p.type),personal=!!p.bound||p.type==='named';
 // Fit personal inscriptions by glyph width; never abbreviate an owned name.
 const units=[...String(p.main||'')].reduce((n,ch)=>n+(/[WMШЩЖЮМ]/i.test(ch)?1:/[IІ1 .-]/i.test(ch)?.38:.73),0);
 const size=Math.min(16,57/Math.max(1,units)).toFixed(2);
 return `<div class="plate plate-crafted t-${esc(p.type)}${nr?' nr':''}${p.cls!=null?' rz'+Number(p.cls):''}${skin?' sk-'+esc(skin):''}${personal?' is-personal':''} ${esc(c)}"${personal?` style="--personal-size:${size}cqw"`:''}>${skin&&/^(ev|med)_f_/.test(skin)?'<i class="xf"></i>':''}${skin&&skin.startsWith('med_f_')?'<i class="xl"></i>':''}<i class="plate-surface" aria-hidden="true"></i><div class="pm">${esc(p.main)}</div>${nr?'':`<div class="pr">${esc(p.reg)}<small>${CN[p.country]?.cc||''} <i class="flag fl-${esc(p.country)}"></i></small></div>`}</div>`
}
// Образец номера типа k для списков (каталог, альбом, шансы): cls — редкость 0..4, если у типа есть такой образец
export function sampleMain(c,k,cls=0){return c=='BY'?SAMP.BY[cls]:(SAMP.RU[k]||SAMP.RU.civil)[cls]}
export function dots(r){return `<div class="dots">${RAR.map((_,i)=>`<i style="${i<=r?'background:'+RAR[r].c:''}"></i>`).join('')}</div>`}
// Титул игрока (плашка с цветом). Пусто, если титула нет.
export function titleHTML(id){const it=id&&itemOf(id);return it&&it.c?`<span class="ttl ${esc(id)}" style="--tc:${it.c}">${it.n}</span>`:''}

// Класс эффекта ника из магазина (id надетого предмета или пусто).
export const nickCls=id=>id?' nk nk-'+id:'';
