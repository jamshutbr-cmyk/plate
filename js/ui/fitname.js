// Подгонка текста именного номера под ширину плашки. Текст придуман игроком и может быть длиннее шести знаков (BMW M5 F10),
// а ширина плашки в списке, витрине и окнах разная. Меряем реальную ширину текста и сжимаем шрифт ровно настолько, чтобы влез.
// Разметку рисуют разные экраны через innerHTML, поэтому следим за DOM сами: новые .pm > .nm подгоняются при появлении и при смене размера.
const ro=typeof ResizeObserver=='function'?new ResizeObserver(es=>{for(const e of es)fit(e.target)}):null;
function fit(pm){
  const s=pm.querySelector(':scope>.nm');if(!s)return;
  const w=pm.clientWidth;if(!w)return;                       // скрыт: подгоним, когда появится (ResizeObserver)
  const cs=getComputedStyle(pm),avail=w-(parseFloat(cs.paddingLeft)||0)-(parseFloat(cs.paddingRight)||0)-2;
  s.style.fontSize='1em';
  const sw=s.getBoundingClientRect().width;
  s.style.fontSize=(sw>avail?Math.max(.3,avail/sw*.96):1).toFixed(3)+'em'}
function scan(root){
  if(!root||root.nodeType!=1)return;
  const list=root.matches&&root.matches('.pm')?[root]:[];
  root.querySelectorAll&&root.querySelectorAll('.pm').forEach(p=>list.push(p));
  for(const pm of list){if(!pm.querySelector(':scope>.nm'))continue;fit(pm);if(ro&&!pm._fit){pm._fit=1;ro.observe(pm)}}}
export function initFitName(){
  new MutationObserver(ms=>{for(const m of ms)m.addedNodes.forEach(scan)}).observe(document.body,{childList:true,subtree:true});
  scan(document.body);
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>scan(document.body)).catch(()=>{})}
