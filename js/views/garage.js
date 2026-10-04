import {TYPES} from '../config.js';
import {CARS} from '../data/cars.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {plateHTML} from '../ui/plate.js';
import {$, fmt} from '../util.js';

// Гараж: выбираем машину и вешаем на неё номер из коллекции или сейфа.
// Это только оформление, поэтому выбор хранится на устройстве, на сервер не уходит.
const KEY='garage:v1',MAXP=60;
const G={car:CARS[0].id,on:{}};
let F='all';   // фильтр списка по типу номера, на устройстве не сохраняется
let Z=false;   // «крупно»: приближение к номеру, на устройстве не сохраняется
try{Object.assign(G,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(G))}catch(e){}};

export function drawGarage(){
  const have=c=>S.cars.includes(c.id),mine=CARS.filter(have),car=mine.find(c=>c.id==G.car)||mine[0],every=S.col.concat(S.safe).sort((a,b)=>b.price-a.price),all=every.filter(x=>F=='all'||x.type==F);
  if(!car){$('garC').innerHTML=`<div class="gcs">${CARS.map(c=>`<button class="lk" data-click="garLock" data-arg="${c.id}"><img src="${c.img}" alt=""><i>🔒</i>???</button>`).join('')}</div>
  <div class="card" style="text-align:center"><h3 style="justify-content:center">Гараж пуст</h3><p>Машины выпадают из кейсов. Откройте кейс, и первая машина появится здесь.</p><button class="big2" data-click="go" data-arg="cases">К кейсам</button></div>`;return}
  const p=every.find(x=>x.id==G.on[car.id]),bg=S.equip&&S.equip.bg?' scn-'+S.equip.bg:'';
  $('garC').innerHTML=`<div class="gcs">${CARS.map(c=>have(c)?`<button class="${c.id==car.id?'a':''}" data-click="garCar" data-arg="${c.id}"><img src="${c.img}" alt="">${c.n}</button>`:`<button class="lk" data-click="garLock" data-arg="${c.id}"><img src="${c.img}" alt=""><i>🔒</i>???</button>`).join('')}</div>
  <div class="gst${bg}"><div class="gcar${Z?' z':''}" style="aspect-ratio:${car.ar};transform-origin:${car.x}% ${car.y}%" data-click="garZoom"><img src="${car.img}" alt="${car.n}">${p?`<div class="gpl pfit" style="left:${car.x}%;top:${car.y}%;width:${car.w*1.04}%" data-sy="${car.sy||1}"><div class="pin">${plateHTML(p)}</div></div>`:''}</div></div>
  <div class="grow"><button class="btn" data-click="garZoom">${Z?'Вся машина':'Крупно'}</button>${mine.length<CARS.length?'<button class="btn" data-click="go" data-arg="cases">Кейсы</button>':''}${p?'<button class="btn" data-click="garClear">Снять номер</button>':''}</div>
  <div class="sub" style="margin:16px 0 8px"><span>${every.length?'Выберите номер для машины':'Коллекция пуста'}</span>${all.length>MAXP?`<span>Самые дорогие ${MAXP}</span>`:''}</div>
  ${every.length?`<div class="chips gfl">${[{k:'all',n:'Все'}].concat(TYPES.map(t=>({k:t.k,n:t.n}))).map(t=>`<button class="${t.k==F?'a':''}" data-click="garF" data-arg="${t.k}">${t.n}</button>`).join('')}</div>`:''}
  ${all.length?`<div class="gpick">${all.slice(0,MAXP).map(x=>`<div class="gp${p&&x.id==p.id?' a':''}" data-click="garPlate" data-arg="${x.id}"><div class="pfit"><div class="pin">${plateHTML(x)}</div></div><div class="gpr">${fmt(x.price)} ₽</div></div>`).join('')}</div>`:`<div class="sub"><span>${every.length?'Таких номеров нет':'Сгенерируйте номера, и их можно будет повесить на машину.'}</span></div>`}`}
// Номер рисуется в полный размер (как в игре) и целиком уменьшается, чтобы скругления и рамка не искажались
const BASE=520;
function fit(){document.querySelectorAll('#garC .pfit').forEach(w=>{const i=w.firstElementChild,k=w.clientWidth/BASE,sy=+w.dataset.sy||1;i.style.transform='scale('+k+','+k*sy+')';w.style.height=i.offsetHeight*k*sy+'px'})}
window.addEventListener('resize',fit);
// Выбранная машина всегда по центру ленты, сколько бы их ни было
function centerCar(){const a=document.querySelector('#garC .gcs .a');if(a){const c=a.parentNode;c.scrollLeft=a.offsetLeft-(c.clientWidth-a.offsetWidth)/2}}
DRAW.garage=()=>{drawGarage();fit();centerCar()};   // fit/centerCar при пустом гараже ничего не находят и ничего не делают
on({garF:a=>{F=a;render()},garZoom:()=>{Z=!Z;render()},garCar:a=>{if(!S.cars.includes(a))return;G.car=a;save();render()},garLock:()=>banner('Машина закрыта','Выпадает из кейсов'),garPlate:a=>{G.on[G.car]=+a;save();render()},garClear:()=>{delete G.on[G.car];save();render()}});
