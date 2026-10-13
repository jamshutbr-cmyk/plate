// Экран «Аккаунт заблокирован». Показывается, когда tg-auth или любое действие вернуло banned.
// Использует разметку и стили экрана подписки (gate.css), чтобы не плодить CSS.
import {TG_CHANNEL} from './env.js';
import {TG, haptic} from './platform.js';
import {esc} from './util.js';

const LINK='https://t.me/'+TG_CHANNEL;
// until: ISO-дата, 'infinity' или пусто (бессрочно)
export function banUntilText(until){
  const t=until?Date.parse(until):NaN;
  return Number.isNaN(t)?'Блокировка бессрочная':'Блокировка до '+new Date(t).toLocaleString('ru-RU',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});
}
export function banHTML(info){
  const reason=info&&info.reason?esc(info.reason):'Нарушение правил игры';
  return `<div class="g-wrap">
    <div class="g-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/></svg>Доступ закрыт</div>
    <div class="g-hero">
      <div class="plate g-pl"><div class="pm">БАН</div><div class="pr">XXX<small><i class="flag fl-RU"></i></small></div></div>
      <h1>Аккаунт заблокирован</h1>
      <p><b>Причина:</b> ${reason}</p>
      <p>${esc(banUntilText(info&&info.until))}</p>
      <p>Если считаете, что это ошибка, напишите в канал игры.</p>
    </div>
    <div class="g-actions">
      <button class="g-join" data-b="ch">Канал игры</button>
    </div>
  </div>`;
}
export function showBan(info){
  document.getElementById('boot')?.remove();
  let g=document.getElementById('gate');
  if(!g){g=document.createElement('div');g.id='gate';document.body.appendChild(g)}
  g.innerHTML=banHTML(info);
  g.querySelector('[data-b=ch]').onclick=()=>{haptic('light');TG&&TG.openTelegramLink?TG.openTelegramLink(LINK):window.open(LINK,'_blank')};
}
