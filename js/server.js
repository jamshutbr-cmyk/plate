import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import {SUPABASE_ANON_KEY, SUPABASE_URL} from './env.js';
import {TG, tgUser} from './platform.js';
import {S, applyPlates, applyPlayer, applyTriple} from './state.js';

// Связь с Supabase: вход через Telegram и загрузка данных в кэш S. Единственное место, где создаётся клиент.
// Любой запрос к серверу обрывается через 15 с: иначе при перегрузке игра висит на «Загрузке…» бесконечно
const tfetch=(u,o={})=>{const c=new AbortController(),t=setTimeout(()=>c.abort(),15000);if(o.signal)o.signal.addEventListener('abort',()=>c.abort());return fetch(u,{...o,signal:c.signal}).finally(()=>clearTimeout(t))};
export const sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true},global:{fetch:tfetch}});
// Пауза фоновых опросов после сбоев сервера (5xx / нет связи): 15 с, 30 с, 60 с … до 5 минут. Успешный ответ сбрасывает.
const DOWN={n:0,until:0};
export const serverDown=()=>Date.now()<DOWN.until;
const markOk=()=>{DOWN.n=0;DOWN.until=0};
const markBad=()=>{DOWN.n=Math.min(DOWN.n+1,5);DOWN.until=Date.now()+15000*2**(DOWN.n-1)};

// Вход: initData из Telegram → Edge Function tg-auth → сессия Supabase (JWT). Вне Telegram войти нельзя.
export async function login(){
  const initData=TG&&TG.initData;
  if(!initData)throw new Error('Откройте игру из Telegram');
  const u=tgUser();
  const res=await tfetch(SUPABASE_URL+'/functions/v1/tg-auth',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_ANON_KEY},body:JSON.stringify({initData})});
  if(res.status===403){const j=await res.json().catch(()=>({}));if(j.error==='not_subscribed')throw Object.assign(new Error('not_subscribed'),{code:'not_subscribed'})}
  if(!res.ok)throw new Error('Не удалось войти ('+res.status+')');
  const s=await res.json();
  const {error}=await sb.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});
  if(error)throw error;
}
export async function loadPlayer(){const {data,error}=await sb.from('players').select('*').single();if(error)throw error;applyPlayer(data)}
// Только нужные колонки (без owner): список номеров скачивается часто, каждый байт идёт в egress
const PLATE_COLS='id,country,type,main,reg,region_name,cls,mu,price,in_safe,created_at';
export async function loadPlates(){const {data,error}=await sb.from('plates').select(PLATE_COLS).order('id');if(error)throw error;applyPlates(data)}
// Пасс, окно продажи и пакет. Если миграция triple_roll.sql ещё не применена, функция тихо выключена.
export async function loadTriple(){
  try{
    const [a,b,c]=await Promise.all([sb.from('passes').select('*').maybeSingle(),sb.rpc('triple_window'),sb.from('pending_rolls').select('*').order('id')]);
    if(a.error||b.error||c.error)throw a.error||b.error||c.error;
    applyTriple(a.data,b.data,c.data)}
  catch(e){applyTriple(null,null,[])}}
// Игрок и номера без пасса/окна продажи (три лишних запроса): для действий, где они не меняются (продажа, рынок, обмен)
export const loadState=()=>Promise.all([loadPlayer(),loadPlates()]);
export const loadAll=()=>Promise.all([loadPlayer(),loadPlates(),loadTriple()]);
export async function rpc(name,args){const {data,error,status}=await sb.rpc(name,args);if(error){if(status===0||status>=500)markBad();throw error}markOk();return data}
