import {createClient} from 'https://esm.sh/@supabase/supabase-js@2';
import {SUPABASE_ANON_KEY, SUPABASE_URL} from './env.js';
import {TG, tgUser} from './platform.js';
import {S, applyPlates, applyPlayer} from './state.js';

// Связь с Supabase: вход через Telegram и загрузка данных в кэш S. Единственное место, где создаётся клиент.
export const sb=createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true}});

// Вход: initData из Telegram → Edge Function tg-auth → сессия Supabase (JWT). Вне Telegram войти нельзя.
export async function login(){
  const initData=TG&&TG.initData;
  if(!initData)throw new Error('Откройте игру из Telegram');
  const u=tgUser();
  const {data:{session}}=await sb.auth.getSession();
  if(session&&u&&session.user?.user_metadata?.tg_id===u.id)return;
  const res=await fetch(SUPABASE_URL+'/functions/v1/tg-auth',{method:'POST',headers:{'Content-Type':'application/json',apikey:SUPABASE_ANON_KEY},body:JSON.stringify({initData})});
  if(!res.ok)throw new Error('Не удалось войти ('+res.status+')');
  const s=await res.json();
  const {error}=await sb.auth.setSession({access_token:s.access_token,refresh_token:s.refresh_token});
  if(error)throw error;
}
export async function loadPlayer(){const {data,error}=await sb.from('players').select('*').single();if(error)throw error;applyPlayer(data)}
export async function loadPlates(){const {data,error}=await sb.from('plates').select('*').order('id');if(error)throw error;applyPlates(data)}
export const loadAll=()=>Promise.all([loadPlayer(),loadPlates()]);
export async function rpc(name,args){const {data,error}=await sb.rpc(name,args);if(error)throw error;return data}
