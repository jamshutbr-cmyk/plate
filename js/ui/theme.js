import {THEMES} from '../config.js';
import {S} from '../state.js';
import {musicSync} from './fx.js';

// Применение цветовой темы.
export function applyTheme(){const v=(THEMES[S.theme]||THEMES.dark).v;for(const k in v)document.documentElement.style.setProperty('--'+k,v[k]);document.body.classList.remove('fx0','fx1','fx2');document.body.classList.add('fx'+(S.fx||0));musicSync()}
