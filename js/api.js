import {AL, CCO, CST, COST, RAR, RESCUE_MS, SCO, SST, TYPES, itemOf} from './config.js';
import {genCost, trackSession} from './engine.js';
import {loadAll, loadPlates, loadPlayer, rpc, sb} from './server.js';
import {S, SESS, applyPlayer, flags} from './state.js';
import {fmt} from './util.js';

// Слой действий: ВСЁ, что меняет состояние игры, живёт здесь. Каждое действие — запрос к серверу (async),
// после ответа обновляется кэш S. Сетевые и серверные ошибки бросаются как исключения: их ловит main.js.
// Бизнес-отказы (не хватает денег и т.п.) возвращаются значением, как раньше.
const notEnough=e=>/not enough/i.test((e&&e.message)||'');
let setPend={},setT;

export const api={
 async generatePlate(){
  if(S.col.length>=S.capC||S.bal<genCost())return null;
  const {data,error}=await sb.functions.invoke('generate');
  if(error){
   let e=null;try{e=await error.context.json()}catch(_){}
   if(e&&(e.error=='full'||e.error=='money')){await loadAll();return null}   // кэш разошёлся с сервером
   throw error}
  const p=data.plate,pl=data.player;
  S.col.push(p);S.bal=+pl.balance;S.usd=pl.usd;S.xp=pl.xp;S.lvl=pl.lvl;S.stats=pl.stats;S.seen=pl.seen;
  if(data.lvup)flags.lvup=1;
  trackSession(p);
  const un=data.unlock=='cls'?RAR[p.cls].en:data.unlock=='type'?TYPES.find(t=>t.k==p.type).n:null;
  return {p,un}},
 async sellPlates(ids){
  const gain=+await rpc('sell_plates',{ids}),set=new Set(ids);
  S.col=S.col.filter(p=>!set.has(p.id));S.safe=S.safe.filter(p=>!set.has(p.id));S.bal+=gain;return {gain}},
 async movePlates(ids,to){
  const n=await rpc('move_plates',{ids,to_safe:to=='safe'});await loadPlates();return n},
 async buyCapacity(k){
  const c=k=='c',i=(c?CST:SST).indexOf(c?S.capC:S.capS)+1,cost=(c?CCO:SCO)[i-1];
  if(c?S.bal<cost:S.usd<cost)return {err:1,need:cost};
  try{await rpc('buy_capacity',{kind:k})}catch(e){if(notEnough(e))return {err:1,need:cost};throw e}
  await loadPlayer();return {ok:1}},
 async buyAutosell(){
  const n=AL[S.as.lvl];if(!n)return {err:1,need:0};
  if(S.usd<n[1])return {err:1,need:n[1]};
  try{await rpc('buy_autosell')}catch(e){if(notEnough(e))return {err:1,need:n[1]};throw e}
  await loadPlayer();return {ok:1}},
 async claimDaily(){
  const r=await rpc('claim_daily');if(!r)return null;
  await loadPlayer();
  let t='+'+fmt(r.bonus)+' ₽';if(r.usd)t+=' · +'+r.usd+' $';
  return {ds:r.ds,text:t}},
 async setNick(n){S.nick=await rpc('set_nick',{n:String(n||'')});return S.nick},
 async bailout(){
  if(S.bal>=COST||S.col.length||S.safe.length||Date.now()-(S.rs||0)<RESCUE_MS)return false;
  const ok=await rpc('bailout');if(ok)await loadPlayer();return !!ok},
 async autoToggle(k){await rpc('autosell_toggle',{k});await loadPlayer()},
 async autosell(){
  if(!S.as.lvl||!S.as.on)return null;
  const r=await rpc('autosell');if(!r)return null;
  await loadAll();return {n:r.n,gain:+r.gain}},
  // Магазин: цены и права проверяет сервер (buy_item / equip_item в shop.sql)
 async buyItem(id){
  const it=itemOf(id);if(!it)return {err:1,need:0};
  if(S.owned.includes(id))return {ok:1};
  if(S.bal<it.p)return {err:1,need:it.p};
  try{await rpc('buy_item',{item_id:id})}catch(e){if(notEnough(e))return {err:1,need:it.p};throw e}
  await loadPlayer();return {ok:1}},
 async equipItem(slot,id){await rpc('equip_item',{slot_name:slot,item_id:id||''});await loadPlayer()},
 setSettings(patch){
  Object.assign(S,patch);Object.assign(setPend,patch);clearTimeout(setT);
  setT=setTimeout(()=>{const b=setPend;setPend={};rpc('set_settings',{s:b}).catch(e=>console.warn('settings',e))},400)},
 async resetProgress(){
  await rpc('reset_progress');await loadAll();
  Object.assign(SESS,{n:0,best:0,cls:[0,0,0,0,0],f:{}})}
};
