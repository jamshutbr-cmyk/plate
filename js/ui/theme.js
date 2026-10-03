import {THEMES} from '../config.js';
import {S} from '../state.js';

// Применение цветовой темы.
export function applyTheme(){const v=(THEMES[S.theme]||THEMES.dark).v;for(const k in v)document.documentElement.style.setProperty('--'+k,v[k])}
