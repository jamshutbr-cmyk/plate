import {AUTO, CASES, CCO, CST, COST, RAR, RESCUE_MS, SCO, SST, TYPES, itemOf} from './config.js';
import {genCost, trackSession} from './engine.js';
import {loadAll, loadPlates, loadPlayer, loadState, rpc, sb} from './server.js';
import {S, SESS, applyPlayer, flags} from './state.js';
import {fmt} from './util.js';
import {TG} from './platform.js';

// Слой действий: ВСЁ, что меняет состояние игры, живёт здесь. Каждое действие — запрос к серверу (async),
// после ответа обновляется кэш S. Сетевые и серверные ошибки бросаются как исключения: их ловит main.js.
// Бизнес-отказы (не хватает денег и т.п.) возвращаются значением, как раньше.
const REB_ERR=[['level too low','level'],['has listings','listings'],['has deposits','deposits'],['not enough stars','stars'],['max','max']];
async function errCode(er){try{const j=await er.context.json();return j.error||j.code||j.message||'server'}catch(_){return (er&&er.message)||'network'}}
const notEnough=e=>/not enough/i.test((e&&e.message)||'');
let setPend={},setT;
// Банковская операция: ошибку сервера превращаем в {err:'код'}, успех — в {ok:1,res}, затем сверяем кэш игрока
const BANK_ERR=[['not enough usd','usd'],['not enough rub','rub'],['limit','limit'],['too many','many'],['not ready','ready'],['finished','finished'],['gone','gone'],['bad amount','amount'],['already owned','owned'],['sold out','soldout']];
async function bankCall(f){
 let res;
 try{res=await f()}
 catch(e){const m=(e&&e.message)||'',h=BANK_ERR.find(x=>m.includes(x[0]));if(h){await loadPlayer();return {err:h[1]}}throw e}
 await loadPlayer();return {ok:1,res}}

// Кланы (clans.sql): сервер бросает исключения с короткими кодами, здесь они превращаются в {err:'код'}. Порядок важен: 'not in clan' раньше 'in clan'.
const CLAN_ERR=[['not in clan','noclan'],['in clan','inclan'],['level too low','level'],['min level','minlvl'],['bad name','name'],['bad tag','tag'],['name taken','nametaken'],['tag taken','tagtaken'],
 ['forbidden word','word'],['cooldown','cooldown'],['not enough rub','rub'],['not enough usd','usd'],['bad amount','amount'],['treasury low','treasury'],['overdue','overdue'],['max level','maxlvl'],
 ['full','full'],['closed','closed'],['too many requests','manyreq'],['role limit','rolelimit'],['not allowed','denied'],['bad settings','settings'],['bad link','link'],['gone','gone'],['leader','leader'],['region limit','reglimit'],['bad region','badregion'],['already owned','owned'],['not owned','notowned'],['bad item','baditem'],['bad text','text']];
async function clanCall(f,money){
 let res;
 try{res=await f()}
 catch(e){const m=(e&&e.message)||'',h=CLAN_ERR.find(x=>m.includes(x[0]));if(h){await loadPlayer();return {err:h[1]}}throw e}
 if(money)await loadPlayer();return {ok:1,res}}

export const api={
 // Донат (supabase/donate.sql, функции donate-invoice и tg-webhook). Деньги принимает Telegram: клиент только открывает счёт и ждёт, пока сервер зачислит покупку.
 async donateState(){return rpc('donate_state')},
 async donateWall(){return rpc('donate_wall')},
 async donatePublic(v){await rpc('donate_set_public',{v});S.dpub=!!v;return v},
 async namedQuote(text,reg){const {data,error}=await sb.functions.invoke('named-plate',{body:{text,reg}});if(error)throw error;return data},
 async donateBuy(pack,amount,plate){
  if(!TG||!TG.openInvoice)return {err:'unsupported'};
  const {data,error}=await sb.functions.invoke('donate-invoice',{body:{pack,amount,...(plate||{})}});
  if(error)return {err:await errCode(error)};
  const status=await new Promise(res=>{try{TG.openInvoice(data.link,res)}catch(e){res('failed')}});
  if(status=='cancelled')return {err:'cancelled'};
  if(status!='paid'&&status!='pending')return {err:'failed'};
  // Зачисляет вебхук, обычно за секунду-две: ждём до ~30 с
  for(let i=0;i<16;i++){
   const r=await rpc('donate_order_status',{p_order:data.order}).catch(()=>null);
   if(r&&r.status=='paid'){await loadPlayer();if(pack=='named')await loadPlates();return {ok:1,res:r.result}}
   await new Promise(f=>setTimeout(f,i<4?1000:2000))}
  await loadPlayer().catch(()=>{});return {wait:1}},
 // Тройная прокрутка (supabase/triple_roll.sql): покупка пасса, бросок пакета, решение по номерам
 async buyPass(){const {error}=await sb.functions.invoke('buy-pass');if(error){const err=await errCode(error);await loadAll().catch(()=>{});return {err}}await loadAll();return {ok:1}},
 // При любой ошибке (в т.ч. обрыв связи, когда сервер мог успеть выполнить запрос) сверяем кэш с сервером: баланс и пакет не должны оставаться устаревшими
 async multiRoll(n){const {error}=await sb.functions.invoke('multi-roll',{body:{n}});if(error){const err=await errCode(error);await loadAll().catch(()=>{});return {err}}await loadAll();return {ok:1}},
 // 'none' = пакет уже закрыт (повторный тап или первый запрос дошёл, а ответ потерялся): это не ошибка, кэш просто догоняем
 async resolveRolls(decisions){const {data,error}=await sb.functions.invoke('resolve-rolls',{body:{decisions}});if(error){const err=await errCode(error);await loadAll().catch(()=>{});return err=='none'?{done:1}:{err}}await loadAll();return data},
 async autoResolve(){const {data,error}=await sb.functions.invoke('resolve-rolls',{body:{auto:true}});if(error)return null;await loadAll();return data&&data.auto?data:null},
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
  if(S.as.lvl)return {err:1,need:0};
  if(S.usd<AUTO.cost)return {err:1,need:AUTO.cost};
  try{await rpc('buy_autosell')}catch(e){if(notEnough(e))return {err:1,need:AUTO.cost};throw e}
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
 async autoSet(k,v){await rpc('autosell_set',{k,v:+v});await loadPlayer()},
 // Одна продажа по правилу. Проданные номера и баланс сервер возвращает в ответе, поэтому список и игрока заново не грузим (раньше после каждого тапа был loadState)
 async autosell(){
  if(!S.as.lvl||!S.as.on)return null;
  const r=await rpc('autosell');if(!r)return null;
  const gone=new Set((r.ids||[]).map(String));
  S.col=S.col.filter(p=>!gone.has(String(p.id)));S.bal=+r.bal;
  return {n:r.n,gain:+r.gain}},
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
 async bankDepositCancel(id){return await bankCall(()=>rpc('bank_deposit_cancel',{p_id:id}))},
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
  await loadState();return {ok:1,main:r.main,ask:+r.ask}},
 async marketAck(upto){await rpc('market_ack_sales',{p_upto:upto})},
 // Аукцион (auction.sql): ставка замораживается на балансе, расчёт и возврат делает сервер. Отказы возвращаются как {err:'код'}
 async auctionCreate(plateId,start,hours){
  try{await rpc('auction_create',{p_plate:plateId,p_start:start,p_hours:hours})}
  catch(e){const m=(e&&e.message)||'';
   if(/bad price/.test(m))return {err:'price'};
   if(/bad duration/.test(m))return {err:'duration'};
   if(/too many/.test(m))return {err:'lots'};
   if(/bad plate/.test(m)){await loadPlates();return {err:'plate'}}
   throw e}
  await loadPlates();return {ok:1}},
 async auctionCancel(id){
  try{await rpc('auction_cancel',{p_id:id})}
  catch(e){const m=(e&&e.message)||'';
   if(/has bids/.test(m))return {err:'bids'};
   if(/gone/.test(m))return {err:'gone'};
   throw e}
  await loadPlates();return {ok:1}},
 async auctionBid(id,amount){
  let r;
  try{r=await rpc('auction_bid',{p_id:id,p_amount:amount})}
  catch(e){const m=(e&&e.message)||'';
   if(/not enough/i.test(m)){await loadPlayer();return {err:'money'}}
   if(/collection full/.test(m))return {err:'full'};
   if(/too low/.test(m))return {err:'low'};
   if(/already top/.test(m))return {err:'top'};
   if(/own lot/.test(m))return {err:'own'};
   if(/gone/.test(m))return {err:'gone'};
   if(/bad price/.test(m))return {err:'price'};
   throw e}
  await loadPlayer();                 // ставка меняет только баланс (номера не трогает)
  if(r.ended)return {err:'ended'};
  return {ok:1,bid:+r.bid,ends:+r.ends_at,extended:!!r.extended}},
 async auctionAck(upto){await rpc('auction_ack',{p_upto:upto})},
 // Кланы (clans.sql): правила, цены и права проверяет сервер. Отказы возвращаются как {err:'код'}; money: после действия сверить баланс
 // Свой номер за рубли: Edge Function custom-plate (supabase/functions/custom-plate): quote — расчёт цены, buy — покупка
 async customQuote(letters,digits,reg){const {data,error}=await sb.functions.invoke('custom-plate',{body:{action:'quote',letters,digits,reg}});if(error)throw error;return data},
 async customBuy(letters,digits,reg){const {data,error}=await sb.functions.invoke('custom-plate',{body:{action:'buy',letters,digits,reg}});if(error)return {error:await errCode(error)};await loadState();return data},
 async clanState(){return await rpc('clan_state')},
 async clanPing(){try{await rpc('clan_ping')}catch(e){}},
 async clanSearch(q,off){return await rpc('clan_search',{p_q:q||'',p_off:off||0})},
 async clanLeaderboard(kind){return await rpc('clan_leaderboard',{p_kind:kind})},
 async clanCreate(name,tag,mode,minLvl){return await clanCall(()=>rpc('clan_create',{p_name:name,p_tag:tag,p_mode:mode,p_min_lvl:minLvl}),1)},
 async clanJoin(id){return await clanCall(()=>rpc('clan_join',{p_clan:id}))},
 async clanCancelRequest(id){return await clanCall(()=>rpc('clan_cancel_request',{p_clan:id}))},
 async clanLeave(){return await clanCall(()=>rpc('clan_leave'))},
 async clanDisband(){return await clanCall(()=>rpc('clan_disband'))},
 async clanDonate(amount){return await clanCall(()=>rpc('clan_donate',{p_amount:amount}),1)},
 async clanUpgrade(){return await clanCall(()=>rpc('clan_upgrade'))},
 async clanResolve(pid,accept){return await clanCall(()=>rpc('clan_resolve',{p_player:pid,p_accept:!!accept}))},
 async clanKick(pid){return await clanCall(()=>rpc('clan_kick',{p_player:pid}))},
 async clanSetRole(pid,role){return await clanCall(()=>rpc('clan_set_role',{p_player:pid,p_role:role}))},
 async clanTransfer(pid){return await clanCall(()=>rpc('clan_transfer',{p_player:pid}))},
 async clanExt(){return await rpc('clan_ext')},
 async clanView(id){return await rpc('clan_view',{p_clan:id})},
 async clanBid(country,region,amount){return await clanCall(()=>rpc('clan_region_bid',{p_country:country,p_region:region,p_amount:amount}))},
 async clanBuy(item){return await clanCall(()=>rpc('clan_shop_buy',{p_item:item}))},
 async clanStyle(frame,fx){return await clanCall(()=>rpc('clan_set_style',{p_frame:frame||'',p_fx:fx||''}))},
 async clanTitle(item){return await clanCall(()=>rpc('clan_equip_title',{p_item:item||''}),1)},
 async labState(){return rpc('lab_state')},
 async reportBug(cat,body,link){const {data,error}=await sb.functions.invoke('report-bug',{body:{cat,body,link}});if(error)return {err:await errCode(error)};return data},
 async clanDescr(t){return await clanCall(()=>rpc('clan_set_descr',{p_text:t||''}))},
 async clanMotd(t){return await clanCall(()=>rpc('clan_set_motd',{p_text:t||''}))},
 async clanSettings(mode,minLvl,tg){return await clanCall(()=>rpc('clan_settings',{p_mode:mode,p_min_lvl:minLvl,p_tg:tg||''}))},
 // Страна и регион генерации: set_gen_prefs (schema.sql). Сервер сам сбросит регион, если его нет в стране.
 async setGenPrefs(c,r){await rpc('set_gen_prefs',{c,r:r||''});await loadPlayer()},
 async syncPlayer(){await loadPlayer()},   // сверить кэш с сервером (например, после обрыва связи во время открытия)
 setSettings(patch){
  Object.assign(S,patch);Object.assign(setPend,patch);clearTimeout(setT);
  setT=setTimeout(()=>{const b=setPend;setPend={};rpc('set_settings',{s:b}).catch(e=>console.warn('settings',e))},400)},
 // Перерождение (prestige.sql). Отказы сервера возвращаются как {err:'код'}
 async rebirth(){
  let r;try{r=await rpc('rebirth')}catch(e){const m=(e&&e.message)||'',h=REB_ERR.find(x=>m.includes(x[0]));if(h){await loadPlayer();return {err:h[1]}}throw e}
  await loadAll();Object.assign(SESS,{n:0,best:0,cls:[0,0,0,0,0,0],f:{}});return {ok:1,stars:r.stars}},
 async buyPerk(k){
  try{await rpc('buy_perk',{k})}catch(e){const m=(e&&e.message)||'',h=REB_ERR.find(x=>m.includes(x[0]));if(h){await loadPlayer();return {err:h[1]}}throw e}
  await loadPlayer();return {ok:1}},
 async resetProgress(){
  await rpc('reset_progress');await loadAll();
  Object.assign(SESS,{n:0,best:0,cls:[0,0,0,0,0,0],f:{}})}
};
