import {api} from '../api.js';
import {THEMES} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {beep, musicSync} from '../ui/fx.js';
import {cm, sm} from '../ui/modal.js';
import {sel} from '../ui/uistate.js';
import {$} from '../util.js';

// Настройки и сброс. Всё хранится на сервере (settings игрока); экспорта/импорта сохранения больше нет: прогресс в облаке.
export function drawSet(){const tg=(k)=>`<button class="tg ${S[k]?'':'off'}" data-click="togg" data-arg="${k}">${S[k]?'Вкл':'Выкл'}</button>`;
 $('setC').innerHTML=`<div class="setr" style="cursor:pointer" data-click="go" data-arg="theme"><span>Тема</span><span class="tg off">${(THEMES[S.theme]||THEMES.dark).n} ›</span></div>
 <div class="setr"><span>Язык</span><span style="color:var(--mut);font-size:14px">Русский (других пока нет)</span></div>
 <div class="setr"><span>Звук</span><button class="tg ${S.mute?'off':''}" data-click="togg" data-arg="mute">${S.mute?'Выкл':'Вкл'}</button><input type="range" min="0" max="100" value="${S.vol}" data-input="setVol" data-change="volBeep"></div>
 <div class="setr"><span>Музыка</span>${tg('music')}</div>
 <div class="setr"><span>Вибрация</span>${tg('vib')}</div>
 <div class="setr"><span>Анимация прокрутки при генерации</span>${tg('reel')}</div>
 <div class="setr"><span>Качество эффектов</span><button class="tg off" data-click="cycleFx">${['Высокое','Среднее','Низкое'][S.fx]} ▾</button></div>
  <button class="btn red" style="width:100%" data-click="resetGame">Сбросить прогресс</button>`}
export function resetGame(){sm(`<div class="dlg"><h3>Сбросить весь прогресс?</h3><button class="btn red" data-click="doReset">Сбросить</button><button class="btn" data-click="cm">Отмена</button></div>`)}
export async function doReset(){cm();await api.resetProgress();sel.clear();$('stage').innerHTML='';go('main')}
export function togg(k){api.setSettings({[k]:!S[k]});render()}
export function setVol(v){api.setSettings({vol:+v});musicSync()}
export function cycleFx(){api.setSettings({fx:(S.fx+1)%3});render()}
DRAW.set=drawSet;
on({togg:a=>togg(a),setVol:(a,el)=>setVol(el.value),volBeep:()=>beep(880,.15,'sine',.1),cycleFx,resetGame,doReset});
