import {AL, CASES, CCO, CST, COST, RAR, RESCUE_MS, SCO, SST, TYPES, itemOf} from './config.js';
import {genCost, trackSession} from './engine.js';
import {loadAll, loadPlates, loadPlayer, rpc, sb} from './server.js';
import {S, SESS, applyPlayer, flags} from './state.js';
import {fmt} from './util.js';

// Слой действий: ВСЁ, что меняет состояние игры, живёт здесь. Каждое действие — запрос к серверу (async),
// после ответа обновляется кэш S. Сетевые и серверные ошибки бросаются как исключения: их ловит main.js.
// Бизнес-отказы (не хватает денег и т.п.) возвращаются значением, как раньше.
const notEnough=e=>/not enough/i.test((e&&e.message)||'');
let setPend={},setT;
// Банковская операция: ошибку сервера превращаем в {err:'код'}, успех — в {ok:1,res}, затем сверяем кэш игрока
const BANK_ERR=[['not enough usd','usd'],['not enough rub','rub'],['limit','limit'],['too many','many'],['not ready','ready'],['gone','gone'],['bad amount','amount'],['already owned','owned'],['sold out','soldout']];
async function bankCall(f){
 let res;
 try{res=await f()}
 catch(e){const m=(e&&e.message)||'',h=BANK_ERR.find(x=>m.includes(x[0]));if(h){await loadPlayer();return {err:h[1]}}throw e}
 await loadPlayer();return {ok:1,res}}

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
  // Кейсы: класс, машину и возврат за дубликат выбирает сервер (open_case в cases.sql). Клиент только показывает результат.
 async openCase(id){
  const c=CASES.find(x=>x.id==id);if(!c)return {err:1,need:0};
  if(S.bal<c.p)return {err:1,need:c.p};
  let r;try{r=await rpc('open_case',{case_id:id})}catch(e){if(notEnough(e)){await loadPlayer();return {err:1,need:c.p}}throw e}
  S.bal=+r.player.balance;S.cars=r.player.cars;
  return {car_id:r.car_id,dup:!!r.dup,refund:+r.refund}},
  // Банк: цены, проценты и лимиты проверяет сервер (bank.sql). Бизнес-отказы возвращаются как {err:'код'}.
 async bankState(){return await rpc('bank_state')},
 async bankExchange(dir,n){return await bankCall(()=>rpc('bank_exchange',{p_dir:dir,p_amount:n}))},
 async bankDepositOpen(cur,amount,days){return await bankCall(()=>rpc('bank_deposit_open',{p_cur:cur,p_amount:amount,p_days:days}))},
 async bankDepositClaim(id){return await bankCall(()=>rpc('bank_deposit_claim',{p_id:id}))},
 async bankBuyLuck(){return await bankCall(()=>rpc('bank_buy_luck'))},
 async bankBuyLots(){return await bankCall(()=>rpc('bank_buy_lots'))},
 async bankBuyItem(id){return await bankCall(()=>rpc('bank_buy_item',{p_item:id}))},
 async openCaseUsd(id){
  const r=await bankCall(()=>rpc('open_case_usd',{case_id:id}));
  if(r.err)return r;
  return {car_id:r.res.car_id,dup:!!r.res.dup,refund:+r.res.refund}},
  // Рынок игроков: цену, комиссию и права проверяет сервер (market.sql). Номер на время лота уходит из коллекции.
 async marketList(plateId,ask){
  try{await rpc('market_list_plate',{p_plate:plateId,p_ask:ask})}
  catch(e){const m=(e&&e.message)||'';
   if(/bad price/.test(m))return {err:'price'};
   if(/too many/.test(m))return {err:'lots'};
   if(/bad plate/.test(m)){await loadPlates();return {err:'plate'}}
   throw e}
  await loadPlates();return {ok:1}},
 async marketCancel(id){
  try{await rpc('market_cancel',{p_id:id})}
  catch(e){const m=(e&&e.message)||'';
   if(/collection full/.test(m))return {err:'full'};
   if(/gone/.test(m))return {err:'gone'};
   throw e}
  await loadPlates();return {ok:1}},
 async marketBuy(id){
  let r;
  try{r=await rpc('market_buy',{p_id:id})}
  catch(e){const m=(e&&e.message)||'';
   if(/not enough/i.test(m)){await loadPlayer();return {err:'money'}}
   if(/collection full/.test(m))return {err:'full'};
   if(/gone/.test(m))return {err:'gone'};
   if(/own lot/.test(m))return {err:'own'};
   throw e}
  await loadAll();return {ok:1,main:r.main,ask:+r.ask}},
 async marketAck(upto){await rpc('market_ack_sales',{p_upto:upto})},
 // Страна и регион генерации: set_gen_prefs (schema.sql). Сервер сам сбросит регион, если его нет в стране.
 async setGenPrefs(c,r){await rpc('set_gen_prefs',{c,r:r||''});await loadPlayer()},
 async syncPlayer(){await loadPlayer()},   // сверить кэш с сервером (например, после обрыва связи во время открытия)
 setSettings(patch){
  Object.assign(S,patch);Object.assign(setPend,patch);clearTimeout(setT);
  setT=setTimeout(()=>{const b=setPend;setPend={};rpc('set_settings',{s:b}).catch(e=>console.warn('settings',e))},400)},
 async resetProgress(){
  await rpc('reset_progress');await loadAll();
  Object.assign(SESS,{n:0,best:0,cls:[0,0,0,0,0],f:{}})}
};
