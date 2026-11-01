import {THEMES} from '../config.js';
import {S} from '../state.js';
import {musicSync} from './fx.js';

// Применение цветовой темы.
let lastChromeColor='';
export function applyTheme(){document.documentElement.dataset.theme=S.theme;const v=(THEMES[S.theme]||THEMES.dark).v;const rgb=(v.ac||'#456cee').replace('#','').match(/.{2}/g).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);document.documentElement.style.setProperty('--on-accent',rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>.179?'#101216':'#ffffff');for(const k in v){document.documentElement.style.setProperty('--'+k,v[k]);document.documentElement.style.setProperty('--app-'+k,v[k])}document.documentElement.style.colorScheme=['light','pink'].includes(S.theme)?'light':'dark';if(lastChromeColor!==v.bg){lastChromeColor=v.bg;try{const tg=globalThis.Telegram?.WebApp;tg?.setHeaderColor?.(v.bg);tg?.setBackgroundColor?.(v.bg);tg?.setBottomBarColor?.(v.bg)}catch(e){}}document.body.classList.remove('fx0','fx1','fx2');document.body.classList.add('fx'+(S.fx||0));musicSync()}
