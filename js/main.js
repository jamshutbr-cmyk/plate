// Точка входа: подключает экраны (они сами регистрируют себя и свои действия), входит через Telegram и запускает игру.
import './views/main.js';
import './views/list.js';
import './views/catalog.js';
import './views/upgrades.js';
import './views/stats.js';
import './views/theme.js';
import './views/settings.js';
import './views/profile.js';
import './views/gen.js';
import {login, loadAll} from './server.js';
import {render} from './router.js';
import {bind, on} from './ui/actions.js';
import {banner} from './ui/modal.js';
import {daily} from './views/main.js';
import {$} from './util.js';

bind();
on({retry:()=>location.reload()});
// Сетевые и серверные ошибки из любых действий: одна плашка вместо падения интерфейса
window.addEventListener('unhandledrejection',e=>{console.error(e.reason);banner('Нет связи с сервером','Повторите действие')});

async function boot(){
  try{await login();await loadAll()}
  catch(e){console.error(e);$('boot').innerHTML=`<div class="bootmsg"><b>Не удалось войти</b><span>${(e&&e.message)||'Ошибка'}</span><button class="btn" data-click="retry">Повторить</button></div>`;return}
  $('boot').remove();render();daily();
}
boot();
