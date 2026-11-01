import {sb,loadAll} from '../server.js';
import {on} from './actions.js';
import {sm,cm,banner} from './modal.js';
import {icon} from './design.js';
const intents=new Map();let account='';
async function scope(){const {data}=await sb.auth.getSession();const next=data?.session?.user?.id||'';if(next!==account){intents.clear();until=0;account=next;}return account;}
const storeKey=k=>'plate:fairplay:'+account+':'+k;
function remember(k,item){intents.set(k,item);try{sessionStorage.setItem(storeKey(k),JSON.stringify(item))}catch(_){}}
function forget(k){intents.delete(k);try{sessionStorage.removeItem(storeKey(k))}catch(_){}}
function clearRequests(){intents.clear();try{for(const k of Object.keys(sessionStorage))if(k.startsWith('plate:fairplay:'+account+':'))sessionStorage.removeItem(k)}catch(_){}}
let until=0,verification=null,widget=null;
const codes=new Set(['invalid_request','request_mismatch','request_pending','operation_in_progress','fairplay_pause','hour_budget','day_budget','rate_limited','fairplay_unavailable']);
const seconds=ms=>Math.max(1,Math.ceil(ms/1000));
function show(d){verification=d;const wait=seconds(d.retry_after_ms||1000);sm(`<div class="fairplay-sheet"><span class="v3-kicker">PLATE / FAIR PLAY</span><div class="fairplay-emblem">${icon('clans')}</div><h2>${d.error==='fairplay_unavailable'?'Защита временно недоступна':d.error==='request_pending'?'Проверяем результат':'Небольшая пауза'}</h2><p>${d.error==='fairplay_unavailable'?'Операция не выполнена. Повторите позже — приложение не обходит серверную защиту.':d.error==='request_pending'?'Предыдущий запрос ещё обрабатывается или его ответ потерялся. Сначала сверим коллекцию и баланс, чтобы не списать средства повторно.':`Сервер ограничил частоту операций. Это не бан и не обвинение в нарушении. Повторите через ${wait} сек.`}</p>${d.challenge&&d.verification_available?'<div id="fairplayWidget"></div><button class="v3-primary" data-click="fairplayVerify">Пройти дополнительную проверку</button>':''}<button class="v3-text" data-click="fairplaySync">Сверить состояние ${icon('refresh')}</button><button class="v3-text" data-click="cm">Вернуться</button><small>Ритм нажатий сам по себе не используется как основание для блокировки.</small></div>`)}
export async function guardedInvoke(name,body={}){
 if(Date.now()<until){show({error:'rate_limited',retry_after_ms:until-Date.now()});return {error:{fairplay:true}}}
 await scope();const key=name+':'+(body.n||1);let item=intents.get(key);
 try{item??=JSON.parse(sessionStorage.getItem(storeKey(key))||'null')}catch(_){}
 if(item&&Date.now()-item.at>86400000){show({error:'request_pending'});return {error:{fairplay:true}}}
 if(!item){item={id:crypto.randomUUID(),at:Date.now()};remember(key,item)}
 let result;try{result=await sb.functions.invoke(name,{body:{...body,request_id:item.id}})}catch(error){return {error}}
 if(!result.error){forget(key);return result}
 let detail;try{detail=await result.error.context.clone().json()}catch(_){}
 if(detail&&codes.has(detail.error)){
  until=Date.now()+Math.min(86400000,Math.max(1000,+detail.retry_after_ms||1000));
  if(!['operation_in_progress','request_pending','fairplay_unavailable'].includes(detail.error))forget(key);
  if(detail.error==='request_pending')await loadAll().catch(()=>{});
  show(detail);return {error:{fairplay:true,detail}};
 }
 // Network uncertainty keeps the SAME request UUID on manual retry. Known business errors discard it.
 if(detail&&['full','money','bad count','no pass','banned','no player','season','unauthorized'].includes(detail.error))forget(key);
 return result;
}
async function fairplayVerify(){if(!verification?.site_key)return;try{
 if(!globalThis.turnstile){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.onload=resolve;s.onerror=reject;document.head.append(s)})}
 const host=document.getElementById('fairplayWidget');if(!host)return;if(widget!=null)try{turnstile.remove(widget)}catch(_){}
 widget=turnstile.render(host,{sitekey:verification.site_key,action:'plate-fairplay',cData:verification.verification_account,callback:async token=>{const {data,error}=await sb.functions.invoke('fairplay-verify',{body:{token}});if(error||!data?.ok){banner('Проверка не завершена','Можно дождаться окончания паузы.');return}until=0;verification=null;cm();banner('Проверка пройдена','Можно продолжить игру.')}});
 }catch(_){banner('Проверка недоступна','Дождитесь окончания паузы. Это не блокировка аккаунта.')}}
on({fairplayVerify,fairplaySync:async()=>{await loadAll();clearRequests();cm();banner('Состояние обновлено','Баланс и коллекция сверены с сервером.')}});
