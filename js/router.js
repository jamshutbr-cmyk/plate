import {on} from './ui/actions.js';
import {applyTheme} from './ui/theme.js';
import {LST, sel} from './ui/uistate.js';
import {$} from './util.js';

// Навигация и перерисовка. Экраны сами регистрируют свои «рисовалки» в DRAW (ключ = id экрана без «v-»).
export const DRAW={};
export const painters=[];   // рисуются всегда (баланс, чип страны и т. п.)
export function render(keepStage){applyTheme();for(const p of painters)p(keepStage);for(const k in DRAW)if($('v-'+k).classList.contains('on'))DRAW[k]()}
// Прокрутка при смене экрана. Страница одна (прокручивается окно), поэтому без этого новый экран открывался с той же позицией,
// что была в прошлом: из длинного меню — «посередине». Теперь: открыли раздел — всегда с начала; вернулись из раздела в меню —
// на то место меню, где были (чтобы не листать заново). go() на тот же экран (после покупки, выставления и т. п.) прокрутку не трогает.
const POS={};
export function go(v){
  const sy=window.scrollY,prev=document.querySelector('.view.on'),pid=prev?prev.id.slice(2):'',pls=LST.ls;   // позицию читаем ДО скрытия экранов (иначе страница схлопывается и scrollY = 0)
  if(pid)POS[pid]=sy;
  document.querySelectorAll('.view').forEach(e=>e.classList.remove('on'));
  if(v=='col'||v=='safe'){LST.ls=v;sel.clear();v='list'}
  const changed=v!=pid||(v=='list'&&pls!=LST.ls);
  const y=changed?(v=='menu'&&pid&&pid!='main'?POS.menu||0:0):sy;
  $('v-'+v).classList.add('on');$('glow').classList.toggle('on',v=='main'&&false);
  window.scrollTo(0,y);render();window.scrollTo(0,y)}
on({go:a=>go(a)});
