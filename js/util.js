// Мелкие помощники без зависимостей.
export const $=id=>document.getElementById(id),rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)];
export const fmt=n=>Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g,' ');
export const xf=n=>'×'+(n>=100?fmt(n):n.toFixed(2));
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Цена лота из ввода игрока: «1500000», «1 500 000», «1.5м», «250к», «2млрд». 0, если не разобрать.
export function parseAsk(s){
  const m=String(s||'').trim().toLowerCase().replace(/\s+/g,'').match(/^(\d+(?:[.,]\d+)?)(к|k|тыс|м|m|млн|млрд|b|б)?$/);
  if(!m)return 0;
  const k={'':1,'к':1e3,k:1e3,'тыс':1e3,'м':1e6,m:1e6,'млн':1e6,'млрд':1e9,b:1e9,'б':1e9}[m[2]||''];
  return Math.round(parseFloat(m[1].replace(',','.'))*k)}
