// Мелкие помощники без зависимостей.
export const $=id=>document.getElementById(id),rnd=n=>Math.floor(Math.random()*n),pick=a=>a[rnd(a.length)];
export const fmt=n=>Math.round(n).toLocaleString('ru-RU').replace(/\u00a0/g,' ');
export const xf=n=>'×'+(n>=100?fmt(n):n.toFixed(2));
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
