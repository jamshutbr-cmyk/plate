// Делегирование событий вместо onclick="...": в разметке пишем data-click="имя" data-arg="значение",
// а обработчики регистрируем явно через on({...}). Функции больше не торчат в window.
// Обработчик получает (arg, элемент, событие). Если вернёт false, событие отменяется (preventDefault).
const H={};
export function on(map){Object.assign(H,map)}
export const ids=a=>String(a).split(',').filter(Boolean).map(Number);

const TYPES=['click','pointerdown','pointerup','pointerleave','pointercancel','pointermove','input','change','contextmenu'];
export function bind(root=document){
  for(const t of TYPES)root.addEventListener(t,e=>{
    const el=e.target.closest&&e.target.closest('[data-'+t+']');if(!el)return;
    if(t=='pointerleave'&&e.target!==el)return;   // pointerleave не всплывает: реагируем только на сам элемент
    const name=el.dataset[t],fn=H[name];
    if(!fn){console.warn('нет действия:',name);return}
    if(fn(el.dataset.arg,el,e)===false)e.preventDefault()},t=='pointerleave');
}
