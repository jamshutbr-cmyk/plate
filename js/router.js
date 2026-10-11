import {on} from './ui/actions.js';
import {applyTheme} from './ui/theme.js';
import {LST, sel} from './ui/uistate.js';
import {$} from './util.js';

// Навигация и перерисовка. Экраны сами регистрируют свои «рисовалки» в DRAW (ключ = id экрана без «v-»).
export const DRAW={};
export const painters=[];   // рисуются всегда (баланс, чип страны и т. п.)
export function render(keepStage){applyTheme();for(const p of painters)p(keepStage);for(const k in DRAW)if($('v-'+k).classList.contains('on'))DRAW[k]()}
export function go(v){
  document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));
  if(v=='col'||v=='safe'){LST.ls=v;sel.clear();v='list'}
  $('v-'+v).classList.add('on');$('glow').classList.toggle('on',v=='main'&&false);render()}
on({go:a=>go(a)});
