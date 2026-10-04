import {api} from '../api.js';
import {CN, RAR} from '../config.js';
import {BR, RR} from '../data/regions.js';
import {haptic} from '../platform.js';
import {render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {chime} from '../ui/fx.js';
import {banner, cm, sm} from '../ui/modal.js';
import {plateHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Свой номер (вкладка магазина): ввод → цена с сервера → покупка. Формат, редкость и цену считает только Edge Function custom-plate.
const CF={plate:'',reg:''};              // что набрал игрок
let CQ=null,CST='idle',CT=0,CTOK=0,CC=S.country;   // CST: idle | busy | ok | err

const norm=s=>String(s||'').toUpperCase().replace(/[\s-]+/g,'');
// «А777АА» → {letters:'АА'+..., digits:'777'}; для Беларуси «1234 AB». null, пока ввод неполный.
export function parsePlate(s,country){
  const u=norm(s);
  if(country=='RU'){const m=u.match(/^(\D)(\d{3})(\D{2})$/);return m?{letters:m[1]+m[3],digits:m[2]}:null}
  const m=u.match(/^(\d{4})(\D{2})$/);return m?{letters:m[2],digits:m[1]}:null}
const regTable=()=>S.country=='RU'?RR:BR;
const ERR={'unauthorized':'Сессия устарела. Закройте игру и откройте заново','offline':'Нет соединения с интернетом','server':'Сервер не ответил. Попробуйте ещё раз','bad letters':'Допустимые буквы: '+'АВЕКМНОРСТУХ'.split('').join(' ')+' (можно латиницей)','bad digits':'Цифры не должны быть одними нулями','bad region':'Такого кода региона нет'};

function resHTML(){
  const c=S.country;
  if(CST=='idle')return `<div class="tl">${c=='RU'?'Формат: буква, три цифры, две буквы (А777АА)':'Формат: четыре цифры и две буквы (1234 AB)'}, затем код региона.</div>`;
  if(CST=='busy')return `<div class="tl">Считаю цену…</div>`;
  if(CST=='err'){const k=CQ&&CQ.error,retry=k=='server'||k=='offline'||!ERR[k];return `<div class="cerr"><span>${ERR[k]||'Не получилось посчитать цену'}</span>${retry?'<button class="cretry" data-click="cRetry">Повторить</button>':''}</div>`}
  const q=CQ,p=q.plate,R=RAR[p.cls],lack=S.bal<q.cost;
  return `${plateHTML(p)}<div class="fr"><span>Редкость</span><b style="color:${R.c}">${R.n}</b></div><div class="fr"><span>Регион</span><b>${esc(p.rn)}</b></div><div class="fr"><span>Цена номера на рынке</span><b>${fmt(p.price)} ₽</b></div>
   <button class="big2" style="margin-top:12px" data-click="cBuy">Купить · ${fmt(q.cost)} ₽</button>${lack?`<div class="tl" style="margin-top:8px">Не хватает ${fmt(q.cost-S.bal)} ₽</div>`:''}`}
const paint=()=>{const e=$('cres');if(e)e.innerHTML=resHTML()};

export function customHTML(){
  const c=S.country;
  if(c!==CC){CC=c;CF.plate='';CF.reg='';CQ=null;CST='idle'}   // сменили страну: формат другой, ввод сбрасываем
  return `<div class="card"><h3>Свой номер</h3><p>Соберите номер сами. Цена зависит от красоты комбинации и престижности региона. Номер всегда гражданский и сразу попадает в коллекцию. Страна: ${CN[c].n}.</p>
  <div class="cfm"><input class="gq" placeholder="${c=='RU'?'А777АА':'1234 AB'}" maxlength="9" value="${esc(CF.plate)}" data-input="cIn" data-arg="plate" autocomplete="off" autocapitalize="characters">
  <input class="gq" placeholder="Код региона, например ${c=='RU'?'77':'7'}" inputmode="numeric" maxlength="3" value="${esc(CF.reg)}" data-input="cIn" data-arg="reg" autocomplete="off"></div>
  <div id="cres">${resHTML()}</div></div>`}

// Запрос цены с задержкой: набор не должен слать запрос на каждую букву, а устаревший ответ отбрасывается
function quote(){
  clearTimeout(CT);CQ=null;
  const pr=parsePlate(CF.plate,S.country),rg=CF.reg.trim();
  if(!pr||!rg){CST='idle';paint();return}
  if(!regTable()[rg]){CST='err';CQ={error:'bad region'};paint();return}
  CST='busy';paint();
  const tok=++CTOK;
  CT=setTimeout(async()=>{
    let r;try{r=await api.customQuote(pr.letters,pr.digits,rg)}catch(e){console.warn(e);r={error:navigator.onLine===false?'offline':'server'}}
    if(tok!=CTOK)return;
    if(r.quote){CST='ok';CQ=r.quote}else{CST='err';CQ=r}
    paint()},350)}
function cIn(k,el){CF[k]=el.value;quote()}
const cRetry=()=>quote();

function cBuy(){
  if(CST!='ok'||!CQ)return;
  const q=CQ;
  if(S.bal<q.cost){banner('Не хватает денег','Нужно '+fmt(q.cost)+' ₽');return}
  if(S.col.length>=S.capC){banner('Коллекция заполнена','Продайте номера или расширьте её');return}
  sm(`<div class="dlg"><h3>Купить номер?</h3>${plateHTML(q.plate)}<p class="tl" style="margin:12px 0">${esc(q.plate.main)} · регион ${esc(q.plate.reg)} за ${fmt(q.cost)} ₽</p><button class="btn" data-click="cBuyOk">Купить</button><button class="btn" data-click="cm">Отмена</button></div>`)}
async function cBuyOk(){
  cm();
  const pr=parsePlate(CF.plate,S.country);if(!pr||!CQ)return;
  const r=await api.customBuy(pr.letters,pr.digits,CF.reg.trim());
  if(r.error){banner('Не получилось',r.error=='money'?'Не хватает денег':r.error=='full'?'Коллекция заполнена':'Попробуйте ещё раз');render(true);return}
  CF.plate='';CF.reg='';CQ=null;CST='idle';
  banner('Номер куплен',r.plate.main+' · '+fmt(r.cost)+' ₽');chime(r.plate.cls);haptic('success');render(true)}
on({cIn:(a,el)=>cIn(a,el),cBuy,cBuyOk,cRetry});
