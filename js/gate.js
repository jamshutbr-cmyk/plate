// Экран обязательной подписки на Telegram-канал. Показывается, когда tg-auth вернул not_subscribed.
import {TG_CHANNEL} from './env.js';
import {TG, haptic} from './platform.js';
import {login} from './server.js';

const LINK='https://t.me/'+TG_CHANNEL;
export function gateHTML(){
  return `<div class="g-wrap">
    <div class="g-tag"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7.5a4 4 0 0 1 8 0V11"/></svg>Доступ по подписке</div>
    <div class="g-hero">
      <div class="plate g-pl"><div class="pm">ПОДПИСКА</div><div class="pr">TG<small><i class="flag fl-RU"></i></small></div></div>
      <h1>Подпишитесь на канал, чтобы играть</h1>
      <p>Подпишитесь и вернитесь сюда: после проверки игра откроется.</p>
      <details class="g-why"><summary>Зачем нужна подписка<svg class="g-ar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg></summary><ul><li><b>Защита от ботов.</b> Автоматические и пустые аккаунты не смогут массово заходить в игру.</li><li><b>Без накрутки.</b> Один живой игрок — один аккаунт, поэтому рейтинг и рынок не засоряются.</li><li><b>Честная конкуренция.</b> Топ игроков и торговля строятся на равных условиях для всех.</li></ul></details>
    </div>
    <div class="g-actions">
      <div class="g-ch" data-g="join">
        <span class="g-av"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="#1a1204" d="M21.9 4.1 18.7 19.3c-.2 1-.9 1.3-1.7.8l-4.8-3.6-2.3 2.3c-.3.3-.5.5-1 .5l.3-4.9 8.9-8c.4-.3-.1-.5-.6-.2L6.5 13l-4.7-1.5c-1-.3-1-1 .2-1.5L20.4 3c.9-.3 1.6.2 1.5 1.1Z"/></svg></span>
        <span class="g-nm"><b>Новости игры</b><em>@${TG_CHANNEL}</em></span>
        <svg class="g-ar" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>
      </div>
      <button class="g-join" data-g="join">Подписаться на канал</button>
      <button class="g-check" data-g="check">Я подписался</button>
      <div class="g-err" id="g-err" role="alert" aria-live="polite"></div>
    </div>
  </div>`;
}
export function showGate(retry){
  document.getElementById('boot')?.remove();
  let g=document.getElementById('gate');
  if(!g){g=document.createElement('div');g.id='gate';g.innerHTML=gateHTML();document.body.appendChild(g)}
  const err=g.querySelector('#g-err'),chk=g.querySelector('[data-g=check]');
  g.querySelector('.g-why').ontoggle=()=>haptic('light');
  g.querySelectorAll('[data-g=join]').forEach(b=>b.onclick=()=>{haptic('light');TG&&TG.openTelegramLink?TG.openTelegramLink(LINK):window.open(LINK,'_blank')});
  chk.onclick=async()=>{
    chk.disabled=true;chk.textContent='Проверяем…';err.textContent='';
    try{await login();haptic('success');retry()}
    catch(e){
      chk.disabled=false;chk.textContent='Я подписался';
      err.textContent=e&&e.code==='not_subscribed'?'Подписка не найдена. Подпишитесь и нажмите снова':'Ошибка соединения, попробуйте ещё раз';
      g.querySelector('.g-actions').classList.remove('bad');void g.offsetWidth;g.querySelector('.g-actions').classList.add('bad');
    }
  };
}
