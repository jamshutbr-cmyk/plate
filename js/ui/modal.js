import {$} from '../util.js';
import {on} from './actions.js';

// Плашка-уведомление и модальное окно.
export function banner(t,x){$('bt').textContent=t;$('bn').textContent=x;const b=$('banner');b.classList.add('on');clearTimeout(b._t);b._t=setTimeout(()=>b.classList.remove('on'),2600)}
export function sm(h){$('sh').innerHTML=h;$('md').classList.add('on')}
export function cm(){$('md').classList.remove('on')}
on({cm,backdrop:(a,el,e)=>{if(e.target===el)cm()}});
