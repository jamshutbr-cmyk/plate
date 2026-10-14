import {api} from '../api.js';
import {CN, DONATE} from '../config.js';
import {BR, RR} from '../data/regions.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {plateHTML} from '../ui/plate.js';
import {normText} from '../named-text.js';
import {STAR, price} from '../ui/star.js';
import {$, esc, fmt} from '../util.js';

// Именной номер за ⭐: на плашке любой текст (2-10 знаков: буквы, цифры, пробел, дефис). Сервер проверяет текст (модерация),
// регион и что текст свободен. Номер привязан к аккаунту (plates.bound): продать, обменять, выставить на рынок или передать нельзя.
const NF={text:'',reg:''};              // что набрал игрок
let NQ=null,NST='idle',NT=0,NTOK=0,NC=S.country;   // NST: idle | busy | ok | err
const {min:NMIN,max:NMAX}=DONATE.named;

const regTable=()=>S.country=='RU'?RR:BR;
const ERR={unauthorized:'Сессия устарела. Закройте игру и откройте заново',offline:'Нет соединения с интернетом',server:'Сервер не ответил. Попробуйте ещё раз',
 'bad text':`Нужно от ${NMIN} до ${NMAX} знаков: русские или латинские буквы, цифры, пробел и дефис`,'blocked':'Такой текст нельзя. Придумайте другой','bad region':'Такого региона нет. Введите код, например 77',
 'taken':'Этот текст уже занят другим игроком. Попробуйте другой'};
const errText=k=>ERR[k]||'Не получилось проверить номер';

// Для оплаты: null, пока номер не проверен сервером
export const namedPlateSpec=()=>NST=='ok'&&NQ?{text:NQ.plate.main,reg:NQ.plate.reg}:null;
export const namedQuoted=()=>NST=='ok'&&NQ?{...NQ.plate,bound:true}:null;
export const mineNamed=()=>[...S.col,...S.safe].filter(p=>p.bound);

function resHTML(left){
  if(left<=0)return '';
  if(NST=='idle')return `<p class="dn-hint">Введите текст и код региона. Регион нужен только для флага на плашке.</p>`;
  if(NST=='busy')return `<p class="dn-hint">Проверяю…</p>`;
  if(NST=='err')return `<p class="dn-err" role="alert">${esc(errText(NQ&&NQ.error))}</p>`;
  const p={...NQ.plate,bound:true};
  return `<div class="dn-stand">${plateHTML(p)}<small>${esc(p.rn)}</small></div>
   <ul class="dn-facts"><li>Навсегда в вашей коллекции</li><li>Продать, обменять и передать нельзя</li><li>Остаётся после перерождения</li></ul>
   <button class="dn-cta" data-click="dnAsk" data-arg="named">Купить за ${price(DONATE.packs.find(x=>x.id=='named').st)}</button>`}
const paint=left=>{const e=$('nmres');if(e)e.innerHTML=resHTML(left)};
let LEFT=3;

export function namedHTML(left){
  LEFT=left;
  const c=S.country,mine=mineNamed(),max=DONATE.packs.find(x=>x.id=='named').max;
  if(c!==NC){NC=c;NF.reg='';NQ=null;NST='idle'}   // сменили страну: коды регионов другие
  return `<div class="dn-panel"><div class="dn-ph"><div class="dn-tileic" style="--ic:#2f5fd0">🪪</div><div class="tx"><b>Именной номер</b>
   <span>Любой текст на плашке: имя, ник, слово. Один текст у одного игрока. Осталось ${Math.max(0,left)} из ${max}</span></div></div>
   ${left>0?`<label class="dn-lb" for="nmT">Текст на плашке<i id="nmcnt">${NF.text.length}/${NMAX}</i></label>
   <input id="nmT" class="dn-in" placeholder="Например, ${c=='RU'?'АЛЕКСЕЙ':'MAX'}" maxlength="${NMAX}" value="${esc(NF.text)}" data-input="nmIn" data-arg="text" autocomplete="off" autocapitalize="characters">
   <label class="dn-lb" for="nmR">Регион для флага</label>
   <input id="nmR" class="dn-in" placeholder="Код региона, например ${c=='RU'?'77':'7'}" inputmode="numeric" maxlength="3" value="${esc(NF.reg)}" data-input="nmIn" data-arg="reg" autocomplete="off">
   <div id="nmres" aria-live="polite">${resHTML(left)}</div>`:`<p class="dn-hint">Вы собрали все доступные именные номера.</p>`}</div>
   ${mine.length?`<h4 class="dn-h">Мои именные номера</h4><div class="dn-panel dn-mine">${mine.map(p=>`<div>${plateHTML(p)}<small>${esc(p.rn)}</small></div>`).join('')}</div>`:''}`}

// Запрос с задержкой: набор не шлёт запрос на каждую букву, устаревший ответ отбрасывается
function quote(){
  clearTimeout(NT);NQ=null;
  const tx=normText(NF.text),rg=NF.reg.trim();
  if(!NF.text.trim()||!rg){NST='idle';paint(LEFT);return}
  if(!tx){NST='err';NQ={error:'bad text'};paint(LEFT);return}
  if(!regTable()[rg]){NST='err';NQ={error:'bad region'};paint(LEFT);return}
  NST='busy';paint(LEFT);
  const tok=++NTOK;
  NT=setTimeout(async()=>{
    let r;try{r=await api.namedQuote(tx,rg)}catch(e){console.warn(e);r={error:navigator.onLine===false?'offline':'server'}}
    if(tok!=NTOK)return;
    if(r.quote){NST='ok';NQ=r.quote}else{NST='err';NQ=r}
    paint(LEFT)},350)}
on({nmIn:(k,el)=>{NF[k]=el.value;if(k=='text'){const e=$('nmcnt');if(e)e.textContent=el.value.length+'/'+NMAX}quote()}});
