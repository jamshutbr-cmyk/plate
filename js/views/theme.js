import {RAR, THEMES} from '../config.js';
import {api} from '../api.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {dots} from '../ui/plate.js';
import {$} from '../util.js';

// Выбор темы.
export function drawTheme(){$('themeC').innerHTML=Object.keys(THEMES).map(k=>{const t=THEMES[k],v=t.v,on=S.theme==k;return `<div class="th" style="background:linear-gradient(135deg,${v.card},${v.bg});color:${v.tx};border-color:${on?v.ac:v.off}" data-click="setTheme" data-arg="${k}"><div><b>${t.n}</b><div class="dots">${RAR.map((R,i)=>`<i style="background:${i?R.c:v.mut}"></i>`).join('')}</div></div><span class="mp" style="background:linear-gradient(${v.pl1},${v.pl2});transform:rotate(-4deg)"><span>А777АА</span><em>77</em></span><s style="${on?`background:${v.ac};border-color:${v.ac};color:#fff`:`border-color:${v.off}`}">${on?'✓':''}</s></div>`}).join('')}
export function setTheme(k){api.setSettings({theme:k});render()}
DRAW.theme=drawTheme;
on({setTheme});
