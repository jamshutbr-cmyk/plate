import {FL, RAR} from '../config.js';
import {DRAW, render} from '../router.js';
import {S, SESS} from '../state.js';
import {icon} from '../ui/design.js';
import {sm} from '../ui/modal.js';
import {on} from '../ui/actions.js';
import {$, fmt} from '../util.js';

// Статистика.
let STAB=0;
export function drawStat(){const st=STAB?SESS:S.stats,need=S.lvl*1250;
 $('statC').innerHTML=`<div class="analytics-header"><span class="v3-kicker">COLLECTION INSIGHTS</span><h1>Коллекция.<br><em>Без догадок.</em></h1><div class="analytics-period"><button class="${STAB?'':'a'}" data-click="setStab" data-arg="0">Всё время</button><button class="${STAB?'a':''}" data-click="setStab" data-arg="1">Эта сессия</button></div></div><div class="analytics-totals"><div><span>Открытий</span><strong>${fmt(st.n)}</strong><small>${STAB?'С начала текущего сеанса':'За всю историю игры'}</small></div><div><span>Рекорд оценки</span><strong>${fmt(st.best)} <small>₽</small></strong><small>Самая дорогая находка${STAB?' сессии':''}</small></div></div><div class="analytics-breakdown"><div class="v3-section-heading"><h2>Состав находок</h2><span class="v3-kicker">НЕ ВЕРОЯТНОСТИ</span></div><div class="analytics-table-header"><span>РЕДКОСТЬ</span><span>ВЫПАЛО</span></div>${RAR.map((r,i)=>`<button data-click="statInspect" data-arg="${i}"><span><i style="background:${r.c}"></i>${r.n}</span><b>${fmt(st.cls[i]||0)}</b><em>+</em></button>`).join('')}</div><details class="analytics-patterns"><summary>Совпадения и особенности <span>+</span></summary><div>${FL.map((t,i)=>`<div><span>${t}</span><b>${fmt(st.f[i]||0)}</b></div>`).join('')}</div></details>${STAB?'':`<div class="analytics-level"><span>Уровень ${S.lvl}</span><div class="pb"><i style="width:${Math.min(100,S.xp/need*100)}%"></i></div><b>${fmt(S.xp)} / ${fmt(need)} XP</b></div>`}`;
}
export function setStab(v){STAB=v;render()}
DRAW.stat=drawStat;
on({statInspect:a=>{const st=STAB?SESS:S.stats,r=RAR[+a];sm(`<div class="v3-tools"><span class="v3-kicker">${STAB?'ЭТА СЕССИЯ':'ВСЁ ВРЕМЯ'}</span><h2>${r.n}</h2><div class="v3-large-value">${fmt(st.cls[+a]||0)}</div><p>Фактическое число выпавших номеров этой редкости. Проданные или перенесённые номера тоже остаются в истории. Это не текущий состав коллекции и не шанс следующего выпадения.</p><button class="v3-primary" data-click="go" data-arg="cat">Изучить каталог</button></div>`)},setStab:a=>setStab(+a)});
