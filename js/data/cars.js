// Машины гаража. x, y, w — центр и ширина места под номер в % от картинки (картинки вырезаны по контуру, фон прозрачный).
// sy — необязательно: растяжение номера по высоте, если место под номер у машины почти квадратное (по умолчанию 1).
// r — редкость 0..4 (индекс RAR из config.js): от неё будет зависеть, из каких кейсов машина может выпасть.
export const CARS=[
 {id:'zhiguli',n:'Жигули',img:'img/cars/zhiguli.webp',ar:1.1644,x:50.18,y:71.62,w:27.97,r:0},
 {id:'devyatka',n:'Девятка',img:'img/cars/devyatka.webp',ar:1.2041,x:50.04,y:71.64,w:34.43,r:0},
 {id:'granta',n:'Гранта',img:'img/cars/granta.webp',ar:1.2455,x:49.92,y:68.07,w:33.16,r:1},
 {id:'niva',n:'Нива',img:'img/cars/niva.webp',ar:1.1136,x:50.09,y:68.24,w:30.51,r:1},
 {id:'camry',n:'Камри',img:'img/cars/camry.webp',ar:1.328,x:50.13,y:69.35,w:21.4,sy:1.5,r:2},
 {id:'bmw',n:'БМВ E39',img:'img/cars/bmw.webp',ar:1.3521,x:50.13,y:68.92,w:32.65,r:2},
 {id:'gelik',n:'Гелик',img:'img/cars/gelik.webp',ar:1.1385,x:50.04,y:66.47,w:27.02,r:3},
 {id:'rs6',n:'Ауди RS6',img:'img/cars/rs6.webp',ar:1.394,x:50.12,y:66.21,w:28.1,r:3},
 {id:'m5',n:'БМВ M5',img:'img/cars/m5.webp',ar:1.3827,x:50.04,y:68.35,w:29.14,r:3},
 {id:'rrsvr',n:'Рендж Ровер SVR',img:'img/cars/rrsvr.webp',ar:1.2357,x:50,y:60.17,w:26.48,r:3},
 {id:'huracan',n:'Ламборгини Хуракан',img:'img/cars/huracan.webp',ar:1.6676,x:50.29,y:77.93,w:25.64,r:4}];

// Новая машина: строка в CARS (id, картинка в img/cars/, r, ar, x, y, w) + такая же строка (id, r) в supabase/cases.sql, car_defs.
// Дальше она сама попадает в кейсы, где у её класса r есть шанс. Класс без машин не выпадает, его шанс уходит остальным.
export const carById=id=>CARS.find(c=>c.id==id);
export const carsOfClass=r=>CARS.filter(c=>c.r==r);
// Честные шансы кейса для показа: w — веса классов в %, классы без машин получают 0, остальные пересчитываются до 100 (так же делает сервер)
export function caseOdds(w){
  const a=w.map((x,r)=>carsOfClass(r).length?x:0),t=a.reduce((s,x)=>s+x,0);
  return t?a.map(x=>x*100/t):a.map(()=>0)}
