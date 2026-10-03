import {FL, RAR} from '../config.js';
import {DRAW, render} from '../router.js';
import {S, SESS} from '../state.js';
import {on} from '../ui/actions.js';
import {$, fmt} from '../util.js';

// Статистика.
let STAB=0;
export function drawStat(){const st=STAB?SESS:S.stats,mx=Math.max(1,...st.cls),need=S.lvl*1250;
 $('statC').innerHTML=`<div class="chips"><button class="${STAB?'':'a'}" data-click="setStab" data-arg="0">Общая</button><button class="${STAB?'a':''}" data-click="setStab" data-arg="1">За сессию</button></div>${STAB?'':`<div class="sub" style="font-size:18px;gap:14px;align-items:center"><span style="color:var(--tx)">Уровень ${S.lvl}</span><div class="pb" style="flex:1"><i style="width:${S.xp/need*100}%"></i></div><span>${fmt(S.xp)} / ${fmt(need)}</span></div>`}<div class="st2"><div><b>${fmt(st.n)}</b><span>Всего сгенерировано</span></div><div><b>${fmt(st.best)} ₽</b><span>Самый дорогой номер</span></div></div><div class="bars">${RAR.map((R,i)=>`<span>${R.n}</span><div class="pb" style="background:${R.c}33"><i style="width:${st.cls[i]/mx*100}%;background:${R.c}"></i></div><span class="tl" style="text-align:right">${st.cls[i]}</span>`).join('')}</div>${FL.map((t,i)=>`<div class="fr"><span>${t}</span><b>${st.f[i]||0}</b></div>`).join('')}`}
export function setStab(v){STAB=v;render()}
DRAW.stat=drawStat;
on({setStab:a=>setStab(+a)});
