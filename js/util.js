// Мелкие помощники без зависимостей.
export const $=id=>document.getElementById(id),rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)];
export const fmt=n=>Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g,' ');
// Шанс в %: до двух знаков, запятая, минимум один знак после неё (92,86 / 4,0 / 0,07)
export const pct=x=>{let s=(+x.toFixed(2)).toString();if(!s.includes('.'))s+='.0';return s.replace('.',',')};
export const xf=n=>'×'+(n>=100?fmt(n):n.toFixed(2));
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Цена лота из ввода игрока: «1500000», «1 500 000», «1.5м», «250к», «2млрд». 0, если не разобрать.
export function parseAsk(s){
  const m=String(s||'').trim().toLowerCase().replace(/\s+/g,'').match(/^(\d+(?:[.,]\d+)?)(к|k|тыс|м|m|млн|млрд|b|б)?$/);
  if(!m)return 0;
  const k={'':1,'к':1e3,k:1e3,'тыс':1e3,'м':1e6,m:1e6,'млн':1e6,'млрд':1e9,b:1e9,'б':1e9}[m[2]||''];
  return Math.round(parseFloat(m[1].replace(',','.'))*k)}

// Подмена содержимого списка без прыжка прокрутки. Фоновое обновление (опрос рынка, таймеры) часто приносит те же данные:
// тогда список не трогаем вовсе (пересборка посреди инерционной прокрутки на телефоне сбрасывает её вверх).
// Если данные изменились, на время замены держим прежнюю высоту блока и возвращаем scrollY.
const LAST=new WeakMap();
const sig=html=>html.replace(/(data-end="[^"]*">)[^<]*/g,'$1').replace(/ hot"/g,'"');   // без бегущих секунд таймера
export function setHTML(el,html){
  const k=sig(html);
  if(LAST.get(el)===k&&el.firstChild)return;
  LAST.set(el,k);
  const y=window.scrollY;
  el.style.minHeight=el.offsetHeight+'px';
  el.innerHTML=html;
  if(window.scrollY!==y)window.scrollTo(0,y);
  requestAnimationFrame(()=>{el.style.minHeight=''});
}
