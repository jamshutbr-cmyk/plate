import {DEMO} from '../mode.js';
import {TYPES,CAR_CLS,RAR} from '../config.js';
import {CARS} from '../data/cars.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {icon} from '../ui/design.js';
import {banner,sm,cm} from '../ui/modal.js';
import {plateHTML} from '../ui/plate.js';
import {$, fmt} from '../util.js';

// Гараж: выбираем машину и вешаем на неё номер из коллекции или сейфа.
// Это только оформление, поэтому выбор хранится на устройстве, на сервер не уходит.
const KEY='garage:v1',MAXP=60;
const G={car:DEMO?'huracan':CARS[0].id,on:DEMO?{huracan:1}:{}};
let F='all';   // фильтр списка по типу номера, на устройстве не сохраняется
let Z=false;   // «крупно»: приближение к номеру, на устройстве не сохраняется
try{if(!DEMO)Object.assign(G,JSON.parse(localStorage.getItem(KEY)||'{}'))}catch(e){}
// Выбранная в гараже машина и номер на ней (для ГАИ): первая из имеющихся, если выбранной нет
export function garageCar(){
  const mine=CARS.filter(c=>S.cars.includes(c.id)),car=mine.find(c=>c.id==G.car)||mine[0];
  if(!car)return null;
  return {car,plate:S.col.concat(S.safe).find(x=>x.id==G.on[car.id])||null}}
const save=()=>{if(DEMO)return;try{localStorage.setItem(KEY,JSON.stringify(G))}catch(e){}};

let motorTab='plates';
function platePicker(){const current=garageCar()?.plate,ls=S.col.concat(S.safe).filter(x=>F==='all'||x.type===F).sort((a,b)=>b.price-a.price);sm(`<div class="v3-tools motor-picker"><span class="v3-kicker">ГАРАЖ / ПРИМЕРКА</span><h2>Последний штрих.</h2><p>Выбери номер — он сразу появится на машине. Выбор оформления хранится на этом устройстве.</p><div class="chips">${[{k:'all',n:'Все'},...TYPES].map(t=>`<button class="${F===t.k?'a':''}" data-click="motorFilter" data-arg="${t.k}">${t.n}</button>`).join('')}</div><div class="motor-picker-list">${ls.length?ls.map(p=>`<button class="${current?.id===p.id?'a':''}" data-click="motorApplyPlate" data-arg="${p.id}">${plateHTML(p)}<span><small>${RAR[p.cls].n}</small><b>${fmt(p.price)} ₽</b><i>${current?.id===p.id?'✓':'+'}</i></span></button>`).join(''):'<p>Номеров этого типа пока нет.</p>'}</div></div>`)}
export function drawGarage(){
 const mine=CARS.filter(c=>S.cars.includes(c.id)),car=mine.find(c=>c.id===G.car)||mine[0];
 if(!car){$('garC').innerHTML=`<div class="motor-empty"><span class="v3-kicker">PRIVATE MOTOR ROOM</span><h1>Здесь будет<br>твой характер.</h1><img src="img/cars/huracan.webp" alt="Ламборгини Хуракан"><p>Автомобили открываются в автогалерее. Начни с первой коллекции.</p><button class="v3-primary" data-click="go" data-arg="cases">Открыть автогалерею ${icon('arrow')}</button></div>`;return}
 G.car=car.id;const p=S.col.concat(S.safe).find(x=>x.id===G.on[car.id]),bg=S.equip.bg?' scn-'+S.equip.bg:'';
 const deck=motorTab==='fleet'?`<div class="motor-fleet">${CARS.map(c=>`<button class="${c.id===car.id?'a':''} ${S.cars.includes(c.id)?'':'locked'}" data-click="${S.cars.includes(c.id)?'garCar':'motorLocked'}" data-arg="${c.id}"><img src="${c.img}" alt="${c.n}"><div><b>${c.n}</b><small>${S.cars.includes(c.id)?CAR_CLS[c.r]:'Открывается в автогалерее'}</small></div><i>${c.id===car.id?'✓':S.cars.includes(c.id)?':pi/external:':'+'}</i></button>`).join('')}</div>`:`<div class="motor-plate-workbench"><div><span class="v3-kicker">УСТАНОВЛЕННЫЙ НОМЕР</span><h2>${p?'Точка в образе.':'Твоей подписи не хватает.'}</h2><p>${p?RAR[p.cls].n+' · '+fmt(p.price)+' ₽':'Добавь любой номер из коллекции или сейфа.'}</p><div class="motor-plate-actions"><button class="v3-primary" data-click="motorChoose">${p?'Сменить номер':'Подобрать номер'} ${icon('col')}</button>${p?'<button class="v3-text" data-click="garClear">Снять</button>':''}</div></div><button class="motor-current-plate" data-click="motorChoose" aria-label="Выбрать номер">${p?plateHTML(p):icon('plus')}</button></div>`;
 $('garC').innerHTML=`<div class="motor-header"><div><span class="v3-kicker">PRIVATE MOTOR ROOM / ${CAR_CLS[car.r].toUpperCase()}</span><h1>${car.n}</h1></div><button class="motor-switch" data-click="motorFleet">${mine.length} машины ${icon('menu')}</button></div><section class="motor-stage"><div class="gst${bg}"><div class="gcar${Z?' z':''}" style="aspect-ratio:${car.ar};transform-origin:${car.x}% ${car.y}%" data-click="garZoom"><img src="${car.img}" alt="${car.n}">${p?`<div class="gpl pfit" style="left:${car.x}%;top:${car.y}%;width:${car.w*1.04}%" data-sy="${car.sy||1}"><div class="pin">${plateHTML(p)}</div></div>`:''}</div></div><div class="motor-controls"><button data-click="motorPrev" aria-label="Предыдущая машина">←</button><span>${String(mine.indexOf(car)+1).padStart(2,'0')} / ${String(mine.length).padStart(2,'0')}</span><button data-click="motorNext" aria-label="Следующая машина">→</button><button class="motor-zoom" data-click="garZoom">${Z?'Весь автомобиль':'Рассмотреть номер'} ${icon(Z?'garage':'search')}</button></div></section><div class="motor-tabs"><button class="${motorTab==='plates'?'a':''}" data-click="motorTab" data-arg="plates">Персонализация</button><button class="${motorTab==='fleet'?'a':''}" data-click="motorTab" data-arg="fleet">Автопарк <span>${mine.length}/${CARS.length}</span></button><button data-click="go" data-arg="cases">Добавить машину ${icon('plus')}</button></div>${deck}`;
}
const changeCar=step=>{const mine=CARS.filter(c=>S.cars.includes(c.id));if(!mine.length)return;let i=mine.findIndex(c=>c.id===G.car);G.car=mine[(i+step+mine.length)%mine.length].id;Z=false;save();render(true)};
on({motorTab:a=>{motorTab=a;render(true)},motorFleet:()=>{motorTab='fleet';render(true)},motorPrev:()=>changeCar(-1),motorNext:()=>changeCar(1),motorChoose:platePicker,motorFilter:a=>{F=a;platePicker()},motorApplyPlate:a=>{G.on[G.car]=+a;save();cm();render(true)},motorLocked:a=>{const c=CARS.find(x=>x.id===a);sm(`<div class="v3-tools dealer-car-detail"><img src="${c.img}" alt="${c.n}"><span class="v3-kicker">ЕЩЁ НЕ В КОЛЛЕКЦИИ / ${CAR_CLS[c.r]}</span><h2>${c.n}</h2><p>Эту машину можно получить из коллекций автогалереи. Конкретный результат открытия случаен.</p><button class="v3-primary" data-click="go" data-arg="cases">Посмотреть коллекции →</button></div>`)}});
// Номер рисуется в полный размер (как в игре) и целиком уменьшается, чтобы скругления и рамка не искажались
const BASE=520;
export function fit(root='#garC'){document.querySelectorAll(root+' .pfit').forEach(w=>{const i=w.firstElementChild,k=w.clientWidth/BASE,sy=+w.dataset.sy||1;i.style.transform='scale('+k+','+k*sy+')';w.style.height=i.offsetHeight*k*sy+'px'})}
window.addEventListener('resize',()=>fit());
// Выбранная машина всегда по центру ленты, сколько бы их ни было
function centerCar(){const a=document.querySelector('#garC .gcs .a');if(a){const c=a.parentNode;c.scrollLeft=a.offsetLeft-(c.clientWidth-a.offsetWidth)/2}}
DRAW.garage=()=>{drawGarage();fit();centerCar()};   // fit/centerCar при пустом гараже ничего не находят и ничего не делают
on({garF:a=>{F=a;render()},garZoom:()=>{Z=!Z;render()},garCar:a=>{if(!S.cars.includes(a))return;G.car=a;save();render()},garLock:()=>banner('Машина закрыта','Выпадает из кейсов'),garPlate:a=>{G.on[G.car]=+a;save();render()},garClear:()=>{delete G.on[G.car];save();render()}});
