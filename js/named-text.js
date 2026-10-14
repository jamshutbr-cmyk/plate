import {DONATE} from './config.js';

// Нормальный вид текста именного номера: как на сервере (supabase/functions/_shared/moderation.ts → normalizeNamed).
// null, пока длина или символы не подходят. Модерацию (запрещённые слова) делает только сервер.
export const normText=s=>{
  const {min,max}=DONATE.named,u=String(s||'').toUpperCase().replace(/Ё/g,'Е').replace(/\s+/g,' ').trim();
  return u.length>=min&&u.length<=max&&/^[0-9A-ZА-Я]+(?:[ -][0-9A-ZА-Я]+)*$/.test(u)?u:null};
