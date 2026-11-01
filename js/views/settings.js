import {api} from '../api.js';
import {THEMES} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {icon} from '../ui/design.js';
import {on} from '../ui/actions.js';
import {beep, musicSync} from '../ui/fx.js';
import {cm, sm} from '../ui/modal.js';
import {sel} from '../ui/uistate.js';
import {$} from '../util.js';

// Настройки и сброс. Всё хранится на сервере (settings игрока); экспорта/импорта сохранения больше нет: прогресс в облаке.
let settingsTab='feel';
export function drawSet(){const sw=(k,reverse=false)=>{const active=reverse?!S[k]:!!S[k];return `<button class="control-switch ${active?'on':''}" data-click="togg" data-arg="${k}" role="switch" aria-checked="${active}" aria-label="${{mute:'Звук',music:'Музыка',vib:'Вибрация',reel:'Анимация генерации'}[k]}"><i></i><span>${active?'Вкл':'Выкл'}</span></button>`};
 const row=(i,t,d,ctl)=>`<div class="control-row"><span>${icon(i)}</span><div><b>${t}</b><small>${d}</small></div>${ctl}</div>`;
 let pane=settingsTab==='feel'?row('sound','Звук игры','Сигналы новых находок',sw('mute',true))+`<div class="control-volume"><label for="controlVolume">Громкость<span>${S.vol}%</span></label><input id="controlVolume" type="range" min="0" max="100" value="${S.vol}" data-input="setVol" data-change="volBeep" aria-label="Громкость звука"></div>`+row('music','Музыка','Фоновое сопровождение',sw('music'))+row('haptic','Тактильный отклик','Вибрация поддерживаемого устройства',sw('vib')):settingsTab==='visual'?row('theme','Внешний вид',(THEMES[S.theme]||THEMES.light).n,`<button class="v3-round" data-click="go" data-arg="theme" aria-label="Выбрать тему">${icon('arrow')}</button>`)+row('refresh','Прокрутка','Анимация открытия комбинации',sw('reel'))+row('gen','Эффекты','Выбери комфортное качество',`<button class="control-choice" data-click="cycleFx">${['Высокое','Среднее','Низкое'][S.fx]} ↻</button>`):`<div class="control-account"><span class="v3-kicker">ТВОЙ ПРОГРЕСС</span><h2>Привязан к игре.<br>Не к этому экрану.</h2><p>Игровые активы и настройки хранятся на сервере после входа через Telegram. Локальная демонстрация не записывает их в аккаунт.</p><button class="v3-text" data-click="go" data-arg="profile">Открыть паспорт ${icon('profile')}</button></div>`+row('cat','Язык','Русский',`<span class="control-readonly">RU</span>`)+`<div class="control-danger"><h3>Начать заново</h3><p>Удалит игровой прогресс. Действие требует отдельного подтверждения.</p><button data-click="resetGame">Сбросить прогресс ${icon('refresh')}</button></div>`;
 $('setC').innerHTML=`<div class="control-intro"><span class="v3-kicker">PLATE / CONTROL CENTRE</span><h1>На твоей<br><em>волне.</em></h1></div><div class="control-navigation">${[['feel','Ощущения','studio'],['visual','Изображение','theme'],['account','Аккаунт','profile']].map(([k,n,i])=>`<button class="${settingsTab===k?'a':''}" data-click="controlTab" data-arg="${k}">${icon(i)}<span>${n}</span></button>`).join('')}</div><div class="control-pane">${pane}</div>`;
}
export function resetGame(){sm(`<div class="dlg"><h3>Сбросить весь прогресс?</h3><button class="btn red" data-click="doReset">Сбросить</button><button class="btn" data-click="cm">Отмена</button></div>`)}
export async function doReset(){cm();await api.resetProgress();sel.clear();$('stage').innerHTML='';go('main')}
export function togg(k){api.setSettings({[k]:!S[k]});render()}
export function setVol(v){api.setSettings({vol:+v});const label=document.querySelector('.control-volume label span');if(label)label.textContent=v+'%';musicSync()}
export function cycleFx(){api.setSettings({fx:(S.fx+1)%3});render()}
DRAW.set=drawSet;
on({controlTab:a=>{settingsTab=a;render(true)},togg:a=>togg(a),setVol:(a,el)=>setVol(el.value),volBeep:()=>beep(880,.15,'sine',.1),cycleFx,resetGame,doReset});
