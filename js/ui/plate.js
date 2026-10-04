import {CN, RAR, itemOf} from '../config.js';
import {S} from '../state.js';

// HTML номерной плашки и точек редкости. skin — рамка из магазина: по умолчанию надетая у нас, '' = без рамки (чужие номера).
export function plateHTML(p,c='',skin=S.equip.skin){return `<div class="plate t-${p.type}${p.cls!=null?' rz'+p.cls:''}${skin?' sk-'+skin:''} ${c}"><div class="pm">${p.main}</div><div class="pr">${p.reg}<small>${CN[p.country].cc} <i class="flag fl-${p.country}"></i></small></div></div>`}
export function dots(r){return `<div class="dots">${RAR.map((_,i)=>`<i style="${i<=r?'background:'+RAR[r].c:''}"></i>`).join('')}</div>`}
// Титул игрока (плашка с цветом). Пусто, если титула нет.
export function titleHTML(id){const it=id&&itemOf(id);return it&&it.c?`<span class="ttl" style="--tc:${it.c}">${it.n}</span>`:''}
