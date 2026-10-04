import {api} from '../api.js';
import {CN, RAR, RESCUE_MS, TYPES} from '../config.js';
import {fake, genCost} from '../engine.js';
import {haptic, hapticDrop} from '../platform.js';
import {painters, render} from '../router.js';
import {S, flags} from '../state.js';
import {beep, burst, count, dropSound, riser, ripple} from '../ui/fx.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {dots, plateHTML} from '../ui/plate.js';
import {$, fmt} from '../util.js';

// Главный экран: тап = генерация номера.
let busy=false;
async function runAuto(){const r=await api.autosell();if(r)banner('Автопродажа','Продано '+r.n+' · '+fmt(r.gain)+' ₽')}
export async function gen(e){
  if(busy)return;ripple(e);busy=true;
  try{
    if(S.as.lvl&&(S.col.length>=S.capC||(S.as.lvl>=9&&S.as.low&&S.bal<genCost())))await runAuto();
    if(S.col.length>=S.capC){stageMsg('Коллекция заполнена ('+S.capC+'). Продайте номера или уберите в сейф.');return}
    if(S.bal<genCost()){stageMsg(brokeMsg());return}
    const r=await api.generatePlate();if(!r)return;const {p,un}=r;
    if(S.reel!==false)await new Promise(done=>reel(p,done));
    show(p,un);
    if(flags.lvup){flags.lvup=0;setTimeout(()=>banner('Новый уровень','Уровень '+S.lvl+' · +'+10*S.lvl+' $'),un?2900:300)}
    if(S.as.every&&S.as.lvl>=6){await runAuto();render(true)}
  }finally{busy=false}}
export function reel(p,done){
  const D=[...Array(9).fill(55),80,110,160,230,330,450],st=$('stage');let i=0;
  (function step(){
    if(i>=D.length){done();return}
    const q=i==D.length-1?p:fake();document.documentElement.style.setProperty('--rc',RAR[q.cls].c);
    $('glow').classList.add('on');
    st.innerHTML=`<div class="tl">Генерация…</div>${plateHTML(q,'blur')}`;beep(260+i*38,.05,'square',.025);haptic('tick');if(p.cls>=3&&i==D.length-6)riser(1.3);
    setTimeout(step,D[i++])})()}
export function tilt(e){const pl=$('stage').querySelector('.plate.in');if(!pl)return;const r=$('stage').getBoundingClientRect(),dx=(e.clientX-r.left)/r.width-.5,dy=(e.clientY-r.top)/r.height-.5;pl.style.animation='none';pl.style.transition='transform .12s';pl.style.transform=`perspective(700px) rotateY(${dx*18}deg) rotateX(${-dy*18}deg)`}
export function show(p,unlock){
  const R=RAR[p.cls];document.documentElement.style.setProperty('--rc',R.c);
  const g=$('glow');g.classList.remove('on');void g.offsetWidth;g.classList.add('on');
  $('stage').innerHTML=`<div class="badge" style="color:${R.c}"><div>${R.n}${dots(p.cls)}</div><b id="pp">0 ₽</b></div>${plateHTML(p,'in')}<div class="tl">${CN[p.country].n} · ${p.reg} · ${p.rn} · ${TYPES.find(t=>t.k==p.type).n}</div>${p.cls>=2?`<div class="tl" style="color:${R.c};font-weight:700">+${[0,0,2,10,100][p.cls]} $</div>`:''}<div class="hint" style="font-size:14px;margin-top:12px">Нажмите ещё раз (−${fmt(genCost())} ₽)</div>`;
  count($('pp'),p.price);render(true);dropSound(p.cls);if(p.cls>=3){const b=$('big');b.textContent=R.n.toUpperCase()+'!';b.classList.remove('on');void b.offsetWidth;b.classList.add('on')}
  if(unlock)banner('Открыто новое',unlock);
  hapticDrop(p.cls);
  if(p.cls>=2)setTimeout(()=>burst(R.c,p.cls*14),500);
  if(p.cls==4&&S.fx<2){document.body.classList.remove('shake');void document.body.offsetWidth;document.body.classList.add('shake');$('flash').classList.remove('on');void $('flash').offsetWidth;$('flash').classList.add('on')}}
export function stageMsg(t){$('stage').innerHTML=`<div class="hint">${t}</div>`}
export function brokeMsg(){if(!S.col.length&&!S.safe.length){const m=Math.ceil((RESCUE_MS-(Date.now()-(S.rs||0)))/60000);return 'Деньги закончились, номеров нет. Помощь на одну генерацию будет через '+Math.max(1,m)+' мин.'}return 'Не хватает денег. Продайте номера из коллекции.'}
let bailBusy=false;
// Помощь при банкротстве: просим сервер только когда по кэшу она может быть положена (не на каждой отрисовке)
function maybeBailout(){
  if(bailBusy||S.bal>=genCost()||S.col.length||S.safe.length||Date.now()-(S.rs||0)<RESCUE_MS)return;
  bailBusy=true;
  api.bailout().then(ok=>{if(ok){render(true);setTimeout(()=>banner('Банкротство','Выдано '+fmt(genCost())+' ₽ на одну генерацию'),400)}}).finally(()=>{bailBusy=false})}
function mainPaint(keepStage){
  maybeBailout();
  document.querySelectorAll('.bal').forEach(e=>e.textContent=fmt(S.bal)+' ₽   '+fmt(S.usd)+' $');
  $('chip').innerHTML=`<i class="flag fl-${S.country}"></i> ${CN[S.country].n}`;
  const ph=document.querySelector('#stage .ph span');if(ph)ph.textContent='Генерация · '+fmt(genCost())+' ₽';
  const ST=S.stats;$('st').textContent=`Выпало: ${ST.n} · Лучший: ${fmt(ST.best)} ₽`;
  if(!keepStage&&!$('stage').innerHTML.trim())$('stage').innerHTML=`<div class="ph"><b>Нажмите в любом месте</b><span>Генерация · ${fmt(genCost())} ₽</span></div>`;
}
painters.push(mainPaint);
export async function daily(){const r=await api.claimDaily();if(!r)return;render(true);setTimeout(()=>banner('Ежедневный бонус · день '+r.ds,r.text),500)}
on({gen:(a,el,e)=>gen(e),tilt:(a,el,e)=>tilt(e)});
