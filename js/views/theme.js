import {THEMES} from '../config.js';
import {api} from '../api.js';
import {DRAW,render} from '../router.js';
import {S} from '../state.js';
import {icon} from '../ui/design.js';
import {plateHTML} from '../ui/plate.js';
import {CARS} from '../data/cars.js';
import {on} from '../ui/actions.js';
import {$} from '../util.js';
// Native radio group. Theme previews never override the readability of labels.
export function drawTheme(){const order=['light','dark',...Object.keys(THEMES).filter(k=>!['light','dark'].includes(k))],selected=THEMES[S.theme]||THEMES.light,v=selected.v,car=CARS.at(-1);
 $('themeC').innerHTML=`<div class="appearance-intro"><span class="v3-kicker">ИЗМЕНИ ОЩУЩЕНИЕ</span><h1>Твой PLATE.<br><em>В твоём свете.</em></h1></div><div class="appearance-layout"><div class="appearance-window" style="--window-bg:${v.bg};--window-card:${v.card};--window-tx:${v.tx};--window-ac:${v.ac}"><div class="appearance-window-top"><span><i></i><i></i><i></i></span><b>PLATE / ${selected.n}</b></div><div class="appearance-window-body"><span class="appearance-mark">P</span><h2>Коллекция<br>с твоим характером.</h2><img src="${car.img}" alt="Автомобиль в выбранной теме"><div>${plateHTML({country:'RU',type:'civil',main:'А777АА',reg:'777'},'','')}</div><button data-click="go" data-arg="studio">Открыть студию ${icon('studio')}</button></div></div><div class="appearance-options" role="radiogroup" aria-label="Выбрать тему"><span class="v3-kicker">ПАЛИТРЫ ИНТЕРФЕЙСА</span>${order.map(k=>{const t=THEMES[k],a=S.theme===k;return `<button class="${a?'a':''}" role="radio" aria-checked="${a}" data-click="setTheme" data-arg="${k}"><span class="appearance-swatch" style="background:${t.v.bg};border-color:${t.v.tx}22"><i style="background:${t.v.card}"></i><em style="background:${t.v.ac}"></em></span><span><b>${t.n}</b><small>${k==='light'?'Свет, бумага и воздух':k==='dark'?'Тише. Глубже. Контрастнее.':'Акцентный характер'}</small></span><strong>${a?'✓':'+'}</strong></button>`}).join('')}<p>Тема применяется сразу во всех пространствах. Настройка сохранится в игровом аккаунте; в демо — до перезагрузки.</p></div></div>`;
}
export function setTheme(k){api.setSettings({theme:k});render(true)}
DRAW.theme=drawTheme;
on({setTheme});
