import {painters} from '../router.js';
import {S} from '../state.js';
import {$} from '../util.js';

// Фон сцены из магазина: класс scn-<id> на главном экране; сам фон рисует css/shop.css через --scn.
function paintScene(){
  const v=$('v-main');if(!v)return;
  const want=S.equip&&S.equip.bg?'scn-'+S.equip.bg:'';
  [...v.classList].filter(k=>k.startsWith('scn-')&&k!=want).forEach(k=>v.classList.remove(k));
  if(want)v.classList.add(want)}
painters.push(paintScene);
