import {CN, RAR} from '../config.js';
import {$} from '../util.js';

// HTML номерной плашки и точек редкости.
export function plateHTML(p,c=''){return `<div class="plate t-${p.type}${p.cls!=null?' rz'+p.cls:''} ${c}"><div class="pm">${p.main}</div><div class="pr">${p.reg}<small>${CN[p.country].cc} <i class="flag fl-${p.country}"></i></small></div></div>`}
export function dots(r){return `<div class="dots">${RAR.map((_,i)=>`<i style="${i<=r?'background:'+RAR[r].c:''}"></i>`).join('')}</div>`}
