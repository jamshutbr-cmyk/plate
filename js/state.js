import {START} from './config.js';

// Состояние игрока. Один объект S, который меняется «на месте» (его нельзя переприсваивать).
// Это КЭШ данных с сервера: источник правды — Supabase. Локально ничего не сохраняется.
export function fresh(){return {since:Date.now(),nick:'',bal:START,usd:0,col:[],safe:[],country:'RU',reg:'',seen:[],capC:100,capS:5,xp:0,lvl:1,theme:'dark',vol:100,vib:true,reel:true,fx:0,mute:false,music:false,dl:0,ds:0,rs:0,stats:{n:0,best:0,cls:[0,0,0,0,0],f:{}},as:{lvl:0,on:true,t1:true,t2:true,sp:true,old:false,cheap:false,ceil:0,every:false,low:false}}}
export const S=fresh();
export const SESS={n:0,best:0,cls:[0,0,0,0,0],f:{}};   // статистика «за сессию», живёт только в памяти
export const flags={lvup:0};   // одноразовые флаги интерфейса (например «новый уровень»)

const ms=t=>t?Date.parse(t):0;
// Строка таблицы players → поля S (без col/safe)
export function playerToState(r){
  const d=fresh(),st=r.settings||{};
  return {since:ms(r.created_at)||Date.now(),nick:r.nick||'',bal:+r.balance,usd:r.usd,xp:r.xp,lvl:r.lvl,capC:r.cap_c,capS:r.cap_s,
    dl:ms(r.daily_last),ds:r.daily_streak,rs:ms(r.rescue_last),country:r.country,reg:r.reg||'',seen:r.seen||[],
    stats:Object.assign(d.stats,r.stats),as:Object.assign(d.as,r.autosell),
    theme:st.theme??d.theme,vol:st.vol??d.vol,vib:st.vib??d.vib,reel:st.reel??d.reel,fx:st.fx??d.fx,mute:st.mute??d.mute,music:st.music??d.music}}
// Строка таблицы plates → номер в формате клиента
export function plateFromRow(r){return {id:r.id,country:r.country,type:r.type,main:r.main,reg:r.reg,rn:r.region_name,cls:r.cls,mu:r.mu,price:+r.price,ts:ms(r.created_at)}}
export function applyPlayer(r){Object.assign(S,playerToState(r))}
export function applyPlates(rows){S.col=rows.filter(r=>!r.in_safe).map(plateFromRow);S.safe=rows.filter(r=>r.in_safe).map(plateFromRow)}
export function replaceState(x){for(const k of Object.keys(S))delete S[k];Object.assign(S,x)}
// Открытые регионы лежат в S.seen как 'r:RU:77' (пишет серверный триггер track_region_seen)
export const regKey=(c,code)=>'r:'+c+':'+code;
export const seenRegions=c=>S.seen.filter(k=>k.startsWith('r:'+(c?c+':':''))).length;
export function all(){return [...S.col,...S.safe]}
export function find(id){return all().find(p=>p.id==id)}
