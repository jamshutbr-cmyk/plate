// Константы и таблицы баланса. Здесь нет логики: только данные.
export const COST=3000,START=50000;
export const RAR=[{n:'Обычный',en:'Common',p:53.81,c:'#9a9aab',m:1},{n:'Необычный',en:'Uncommon',p:37.96,c:'#4ade80',m:11.55},{n:'Редкий',en:'Rare',p:7.98,c:'#5b8cff',m:661.2},{n:'Эпический',en:'Epic',p:.24,c:'#a855f7',m:9955},{n:'Легендарный',en:'Legendary',p:.01,c:'#f5b82e',m:242550},{n:'Мифический',en:'Mythic',p:0,ps:'до 0,005',c:'#ff4d6d',m:1500000}];
// Типы номеров. k — тип, p — шанс в % (сумма 100), m — множитель цены, c — страны, где тип выпадает (в Беларуси только civil/taxi/police/transit).
// Должны совпадать с TYPES в supabase/functions/_shared/engine.ts и check в SQL, это сверяет tests/types.test.mjs.
export const TYPES=[{k:'civil',p:92.86,m:1,n:'Гражданский',c:['RU','BY']},{k:'taxi',p:4,m:24,n:'Такси',c:['RU','BY']},{k:'police',p:1,m:50,n:'Полиция',c:['RU','BY']},{k:'transit',p:2,m:.5,n:'Транзит',c:['RU','BY']},{k:'military',p:.07,m:80,n:'Военный',c:['RU']},{k:'diplomat',p:.06,m:120,n:'Дипломат',c:['RU']},{k:'retro',p:.01,m:200,n:'Ретро',c:['RU']},{k:'blat',p:0,m:150,n:'Блатной',c:['RU']},{k:'media',p:0,m:150,n:'Медиа',c:['RU']},{k:'friends',p:0,m:150,n:'Друзья',c:['RU']}];   // blat — приз ивента (supabase/event.sql), из генератора не выпадает
export const NOREG=['military','diplomat','retro'];   // у этих плашек нет блока региона (только отрисовка)
export const CN={RU:{n:'Россия',cc:'RUS'},BY:{n:'Беларусь',cc:'BY'}};
export const RU_L='АВЕКМНОРСТУХ',BY_L='ABEIKMHOPCTX';
export const THEMES={
dark:{n:'Тёмная',v:{bg:'#0f1015',card:'#1a1b23',tx:'#ececf1',mut:'#8b8d9b',b1:'#262833',b2:'#1a1b23',sheet:'#1a1b23',m1:'#27427a',m2:'#141c33',ac:'#3b82f6',off:'#34363f',pl1:'#e6e6e9',pl2:'#a8a8ae'}},
gold:{n:'Золото',v:{bg:'#12100a',card:'#1e1a10',tx:'#f4ead0',mut:'#a39874',b1:'#2c2517',b2:'#1e1a10',sheet:'#1e1a10',m1:'#6b5316',m2:'#2a210b',ac:'#d9a932',off:'#3a3220',pl1:'#f4d77f',pl2:'#c9972c'}},
light:{n:'Светлая',v:{bg:'#f2f3f7',card:'#ffffff',tx:'#1b1d27',mut:'#6c7184',b1:'#ffffff',b2:'#eef0f5',sheet:'#ffffff',m1:'#7ea3f5',m2:'#4a73d9',ac:'#3b6ef0',off:'#d7dae3',pl1:'#fcfcfd',pl2:'#d4d5db'}},
pink:{n:'Розовая',v:{bg:'#fbeff5',card:'#ffffff',tx:'#3a1c2e',mut:'#94677f',b1:'#ffffff',b2:'#fde4ef',sheet:'#ffffff',m1:'#f08cb9',m2:'#d65b95',ac:'#e0488a',off:'#f0cfe0',pl1:'#ffd6e8',pl2:'#f09bc2'}},
silver:{n:'Серебро',v:{bg:'#1c1f26',card:'#2a2e38',tx:'#eef1f6',mut:'#9ba3b4',b1:'#353a47',b2:'#2a2e38',sheet:'#2a2e38',m1:'#5d6a85',m2:'#2f3646',ac:'#9fb4de',off:'#444a58',pl1:'#eef0f4',pl2:'#a6adba'}}};
export const XPV=[5,8,20,100,500,2500];
export const FL=['Одинаковые цифры','Одинаковые буквы','Зеркальные цифры','Палиндром букв','Круглый номер','Цифры совпадают с регионом','Блатной номер','Малый номер','Гражданский','Такси','Полиция','Транзит','Военный','Дипломат','Ретро','Блатной','Медиа','Друзья'];
// Автопродажа (supabase/autosell_v2.sql): один режим. cost — цена открытия ($), ceil — варианты потолка цены (0 = без лимита), cls — до какой редкости продаём.
// autoMatch — то же правило, что в SQL autosell(): клиент им только считает «сколько продастся сейчас».
export const AUTO={cost:300,ceil:[0,500,5000,50000,500000],cls:['Обычные','До необычных','До редких']};
export const autoMatch=(p,a)=>p.cls<=Math.min(2,Math.max(0,a.cls|0))&&(p.type=='civil'||!!a.sp)&&(!a.ceil||p.price<=a.ceil);
export const CST=[100,150,200,300,500],CCO=[5e5,2e6,8e6,25e6],SST=[5,10,20,35,50],SCO=[25,75,150,300];
export const SAMP={RU:{civil:['К013АВ','К013АА','К012КК','К111КК','А777АА','К123ОТ'],taxi:['КВ 013','КК 013','КВ 111','КК 111'],transit:['К013АВ','К013АА','К012КК','К111КК','А777АА','К123ОТ'],police:['К013АВ','К013АА','К012КК','К111КК','А777АА','К123ОТ'],
  military:['1357 АВ','1357 АА','1157 АА','1111 АВ','1111 АА'],diplomat:['139 CD 46','139 CD 44','119 CD 44','777 CD 44'],retro:['13-57 МОК','13-57 ММК','11-57 ММК','11-11 МОК','11-11 МММ']},BY:['3841 AB-','3841 AA-','7773 AB-','7773 AA-','7777 AA-']};
export const CD=['Без повторов и закономерностей','Две одинаковые буквы или цифры','Три цифры подряд, три одинаковые цифры или пара букв вместе с парой цифр','Три одинаковые цифры и пара одинаковых букв','Три или четыре одинаковые цифры и все буквы одинаковые','Три буквы складываются в слово или блатную серию: КОТ, МУР, ВОР, АМР, СКР… (только Россия)'];
export const RESCUE_MS=30*60000;

// Платный регион и магазин. Должны совпадать с supabase/_shared/engine.ts (REGION_FEE_BASE) и supabase/shop.sql (shop_items),
// это сверяет tests/shop.test.mjs. Цена своего номера приходит с сервера, здесь её нет.
export const REGION_FEE_BASE=3000;
export const regFee=m=>m?Math.round(REGION_FEE_BASE*m*m/100)*100:0;   // доплата к каждому прокруту с выбранным регионом
export const SHOP={
 skin:[{id:'carbon',n:'Карбон',p:1500000,d:'Тёмная карбоновая плашка'},{id:'silver',n:'Серебро',p:2500000,d:'Холодный серебристый металл'},{id:'bronze',n:'Бронза',p:2500000,d:'Тёплая бронзовая рамка'},{id:'gold',n:'Золото',p:3000000,d:'Золотая рамка и фон'},{id:'rose',n:'Розовое золото',p:4000000,d:'Нежный розовый металл'},{id:'emerald',n:'Изумруд',p:5000000,d:'Глубокий зелёный блеск'},{id:'ruby',n:'Рубин',p:5000000,d:'Насыщенный красный камень'},{id:'sapphire',n:'Сапфир',p:5000000,d:'Синий камень с холодным свечением'},{id:'sunset',n:'Закат',p:7000000,d:'Градиент от золота к пурпуру'},{id:'neon',n:'Неон',p:8000000,d:'Тёмная плашка со светящейся неоновой рамкой'},{id:'midnight',n:'Полночь',p:9000000,d:'Тёмная плашка с золотой кромкой'},{id:'aurora',n:'Северное сияние',p:12000000,d:'Тёмный фон и переливы зелёного и фиолета'},{id:'hologram',n:'Голограмма',p:15000000,d:'Переливающаяся рамка, меняет цвет'}],
 title:[{id:'driver',n:'Водитель',p:300000,c:'#9aa3b8'},{id:'collector',n:'Коллекционер',p:2000000,c:'#4ade80'},{id:'major',n:'Мажор',p:10000000,c:'#5b8cff'},{id:'king',n:'Король номеров',p:50000000,c:'#a855f7'},{id:'oligarch',n:'Олигарх',p:250000000,c:'#f5b82e'}],
 nick:[{id:'nsilver',n:'Серебро',p:400000,d:'Холодный металлический блеск'},{id:'ngold',n:'Золото',p:600000,d:'Золотой градиент'},{id:'nice',n:'Лёд',p:800000,d:'Голубой ледяной перелив'},{id:'nfire',n:'Огонь',p:1000000,d:'Тёплый переливающийся огонь'},{id:'nemerald',n:'Изумруд',p:1000000,d:'Зелёный камень с бликом'},{id:'nneon',n:'Неон',p:1500000,d:'Светящийся неоновый ник'},{id:'nrainbow',n:'Радуга',p:2500000,d:'Переливается всеми цветами'}],
 bg:[{id:'bgspace',n:'Космос',p:1500000,d:'Звёзды и глубокая тьма'},{id:'bggarage',n:'Гараж',p:1500000,d:'Бетон и луч прожектора сверху'},{id:'bgsunset',n:'Закат',p:2500000,d:'Солнце над горизонтом'},{id:'bgcity',n:'Ночной город',p:3500000,d:'Огни города на закате'},{id:'bggrid',n:'Синтвейв',p:4500000,d:'Неоновое солнце и сетка'},{id:'bgrain',n:'Дождь',p:5000000,d:'Мокрая ночь, идёт дождь'},{id:'bgaurora',n:'Северное сияние',p:7000000,d:'Переливы зелёного и фиолета'}],
 show:[{id:'showcase',n:'Витрина',p:3000000,d:'Закрепите в профиле до 3 любимых номеров. Их увидят все, кто откроет ваш профиль'}],
 drop:[{id:'sparks',n:'Искры',p:1000000,d:'Золотые звёздочки'},{id:'fire',n:'Огонь',p:2500000,d:'Огненные частицы и вспышка'},{id:'ice',n:'Лёд',p:2500000,d:'Ледяные частицы и вспышка'},{id:'rainbow',n:'Радуга',p:6000000,d:'Частицы всех цветов'}]};
export const SLOTS=[['skin','Рамки'],['nick','Ник'],['bg','Фон'],['show','Витрина'],['title','Титулы'],['drop','Эффекты']];
export const EQUIP_SLOTS=['skin','title','drop','nick','bg'];   // надеваются; 'show' (витрина) только покупается
export const SHOWCASE_MAX=3;
// Эффекты выпадения: цвета частиц, цвет вспышки у легендарного, star — частицы-звёздочки
export const FXE={ref_d_column:{pal:['#9aa3b8','#ececf1','#f0b429'],flash:'#ececf1',sq:1,dir:'down',rad:.8},med_d_rec:{pal:['#e5484d','#ffffff','#f0b429'],flash:'#e5484d',rad:.7},sparks:{pal:['#ffd54a','#fff3b0','#ffb300'],flash:'#ffd54a',star:1},fire:{pal:['#ff3b1d','#ff8a1d','#ffd23a'],flash:'#ff6a1d'},ice:{pal:['#7fe7ff','#b8f3ff','#4aa8ff'],flash:'#7fe7ff'},rainbow:{pal:['#ff4d4d','#ffb84d','#fff04d','#4dff88','#4da6ff','#c04dff'],flash:'#ffffff',star:1},dn_nova:{pal:['#7b2ff7','#ff5fa2','#00e5ff','#ffffff'],flash:'#c4b5fd',star:1},ev_d_dust:{pal:['#b08a5a','#d9b98a','#8c6b3f'],flash:'#d9b98a'},ev_d_siren:{pal:['#d63a3a','#3a6ad6','#ffffff'],flash:'#ffffff'},ev_d_weld:{pal:['#fff3b0','#ffb347','#ff7a1a'],flash:'#ffb347',dir:'up',rad:.8,n:1.2},ev_d_ticket:{pal:['#f4f1e6','#ffe9a8','#d9d4c0'],flash:'#f4f1e6',sq:1,dir:'down',rad:.7},ev_d_smoke:{pal:['#8d8d93','#b4b4ba','#62626a'],flash:'#b4b4ba',big:1,rad:.55,n:.6},ev_d_cones:{pal:['#ef6a1a','#ffffff','#ff8a3a'],flash:'#ef6a1a',sq:1,dir:'up',rad:.9},ev_d_radar:{pal:['#ffffff','#9ad0ff','#2f6bff'],flash:'#ffffff',star:1,rad:1.3},ev_d_salute:{pal:['#ff4d4d','#ffb84d','#fff04d','#4dff88','#4da6ff','#c04dff'],flash:'#ffffff',star:1,rad:1.45,n:1.5}};
export const itemOf=id=>{for(const s in SHOP){const it=SHOP[s].find(x=>x.id==id);if(it)return {...it,slot:s}}const ct=CLAN_SHOP.find(x=>x.id==id&&x.slot=='title');if(ct)return {id:ct.id,n:ct.n,c:ct.c,slot:'title'};const b=BANK.items.find(x=>x.id==id);if(b)return {id:b.id,n:b.n,c:b.c,slot:'title'};const l=LAB.titles.find(x=>x.id==id);if(l)return {id:l.id,n:l.n,c:l.c,slot:'title'};const pt=PATRON.titles.find(x=>x.id==id);if(pt)return {id:pt.id,n:pt.n,c:pt.c,slot:'title'};const dt=DONATE.tiers.find(x=>x.id==id);if(dt)return {id:dt.id,n:dt.t,c:dt.c,slot:'title'};const di=DONATE.items.find(x=>x.id==id);if(di)return {...di};const ev=EVENT.titles.find(x=>x.id==id);if(ev)return {id:ev.id,n:ev.n,c:ev.c,slot:'title'};const hw=HW.titles.find(x=>x.id==id);if(hw)return {id:hw.id,n:hw.n,c:hw.c,slot:'title'};const rm=REF.items.concat(MEDIA.items).find(x=>x.id==id);if(rm)return {...rm};return id==LAB.skin.id?{id:id,n:LAB.skin.n,slot:'skin'}:null};

// Кейсы с машинами. Шансы, цены и выдачу считает ТОЛЬКО сервер (supabase/cases.sql: open_case); здесь данные для показа.
// Должны совпадать с cases.sql, это сверяет tests/cases.test.mjs.
export const CAR_CLS=['Хлам','Обычная','Редкая','Эпическая','Легендарная'];   // названия классов машин (r = индекс RAR), цвет берётся из RAR[r].c
export const CAR_VAL=[20000,80000,500000,4000000,40000000];                // стоимость класса, ₽
export const DUP_PCT=50;                                                   // дубликат возвращает столько % от стоимости класса
export const dupRefund=r=>Math.floor(CAR_VAL[r]*DUP_PCT/100);
// w — веса классов 0..4 в процентах (сумма 100). col — только цвет карточки. Класс без машин в cars.js не выпадает, его шанс уходит остальным.
export const CASES=[
 {id:'garage',n:'Гаражный',p:150000,w:[62,30,7.5,.5,0],col:'#8f95a8',d:'Хлам и обычные, редкие реже'},
 {id:'standard',n:'Стандарт',p:600000,w:[10,52,33,5,0],col:'#4ade80',d:'Обычные и редкие, эпические иногда'},
 {id:'premium',n:'Премиум',p:5000000,w:[0,15,50,32,3],col:'#a855f7',d:'Редкие и эпические, шанс легендарной'},
 {id:'legend',n:'Легендарный',p:30000000,w:[0,0,20,55,25],col:'#f5b82e',d:'Высокие шансы на эпик и легендарку'}];

// Рынок игроков. Комиссию, лимиты и права проверяет ТОЛЬКО сервер (supabase/market.sql); здесь данные для показа.
// Должны совпадать с market.sql, это сверяет tests/market.test.mjs.
export const MARKET={fee:5,min:1000,max:100000000000,lots:10,page:30};   // fee — % с продавца, min/max — цена лота, ₽, lots — лотов на игрока, page — размер страницы
export const SELL_PCT=95;                                                 // сколько % цены игра платит за проданный номер (зеркало sell_plates / autosell в schema.sql)
export const sellGain=(t,bonus=0)=>Math.floor(t*(SELL_PCT+bonus)/100);   // bonus — уровень перка «Торговец» (prestige.sql: sell_pct)
// Аукцион (зеркало констант auction.sql, сверяет tests/auction.test.mjs): fee — % с продавца, lots — лотов на игрока, hours — сроки,
// stepPct/step — минимальный шаг ставки, snipe — секунд до конца, при ставке в которые конец переносится, extMax — потолок переноса, с
export const AUCTION={fee:5,min:1000,max:100000000000,lots:5,hours:[1,6,12,24],stepPct:5,step:100,snipe:120,extMax:7200,page:30};
// ГАИ (gai.sql): константы зеркалят функции в SQL, сверяет tests/gai.test.mjs. g — рост множителя: x(t)=exp(g·t), t в секундах заезда. kmh — км/ч на единицу множителя (x2 = 120 км/ч).
// Дорожные работы 3D (road.sql): константы зеркалят функции в SQL, сверяет tests/road.test.mjs. rate — ₽ за очко, maxPps — потолок очков в секунду, dayCap — ₽ в сутки.
export const ROAD={rate:2,maxPps:60,dayCap:150000,minSecs:8,maxAge:1800};
// Ивент «Полицейский беспредел» (supabase/event.sql). Жетоны 🚧 вместо рублей; цифры зеркалят константы SQL, совпадение проверяет tests/event.test.mjs.
// titles — только для показа титулов в профиле и рейтинге (остальной каталог приходит с сервера: rpc ev_state); frame/drop/bg/car/trail рисуются по id.
export const EVENT={scoreDiv:20,maxPps:60,bonusPps:40,maxSpeed:80,minSecs:8,maxAge:1800,dayCap:3000,ptsCap:30000,boostMax:30,
 chase:{starM:2000,perM:100,maxStars:5},case:{price:350,pityAt:20,forcedMin:3,dupPct:35},
 modes:{road:'Дорожные работы',chase:'Уйти от полиции'},
 kinds:{title:'Титулы',frame:'Рамки',drop:'Эффекты',bg:'Фоны',car:'Кузов',trail:'Следы',plate:'Номера',rub:'Рубли',boost:'Расходники'},
 slotOf:{title:'title',frame:'frame',drop:'drop',bg:'bg',car:'car',trail:'trail'},
 titles:[{id:'ev_t_patrol',n:'Патрульный',c:'#9aa3b8'},{id:'ev_t_cone',n:'Конусолов',c:'#fb923c'},{id:'ev_t_gai',n:'Знаток ГАИ',c:'#7aa2ff'},{id:'ev_t_runner',n:'Беглец',c:'#4ade80'},{id:'ev_t_ramp',n:'Трамплинщик',c:'#22d3ee'},{id:'ev_t_night',n:'Ночной гонщик',c:'#818cf8'},{id:'ev_t_deal',n:'Договорился',c:'#34d399'},{id:'ev_t_racer',n:'Гонщик без прав',c:'#5b8cff'},{id:'ev_t_drift',n:'Король заноса',c:'#f472b6'},{id:'ev_t_siren',n:'Под мигалками',c:'#60a5fa'},{id:'ev_t_boss',n:'Хозяин трассы',c:'#fbbf24'},{id:'ev_t_chaos',n:'Беспредельщик',c:'#a855f7'},{id:'ev_t_tape',n:'Не пересекать',c:'#facc15'},{id:'ev_t_ghost',n:'Призрак трассы',c:'#c4b5fd'},{id:'ev_t_legend',n:'Легенда погони',c:'#f5b82e'},{id:'ev_t_god',n:'Бог дорожных работ',c:'#ffd166'},{id:'ev_t_king',n:'Неуловимый',c:'#ff4d6d'}]};
export const chaseStars=d=>Math.min(EVENT.chase.maxStars,1+Math.floor(Math.max(0,d|0)/EVENT.chase.starM));
export const chaseTokens=d=>{let t=0;for(let k=1;k<=EVENT.chase.maxStars&&d>(k-1)*EVENT.chase.starM;k++){const seg=(k<EVENT.chase.maxStars?Math.min(d,k*EVENT.chase.starM):d)-(k-1)*EVENT.chase.starM;t+=Math.floor(seg/EVENT.chase.perM)*k}return t};
// Откуда брать three.js r128 для игры: свой файл (если положите в js/vendor/), затем CDN. Игра и её код лежат в js/vendor/roadworks.js
export const THREE_SRC=['js/vendor/three.min.js','https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js','https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'];
export const GAI={bet:8,pause:3,g:0.09,edge:4,cap:1000,min:100,max:1000000000,minAuto:1.01,kmh:60,posts:[2,5,10,25,100],slots:[1,2]};
export const gaiX=t=>t>0?Math.floor(Math.exp(GAI.g*t)*100)/100:1;
export const auctionFee=ask=>Math.floor(ask*AUCTION.fee/100);
export const auctionNext=(cur,hasBid)=>hasBid?cur+Math.max(Math.ceil(cur*AUCTION.stepPct/100),AUCTION.step):cur;   // минимальная следующая ставка
// Штраф за досрочное закрытие вклада (для показа; считает сервер): первые graceMin минут нет, потом pct% от вложенного, вниз
export const cancelFee=(amount,startMs,nowMs)=>nowMs-startMs>=BANK.cancel.graceMin*60000?Math.floor(amount*BANK.cancel.pct/100):0;
export const marketFee=ask=>Math.floor(ask*MARKET.fee/100);                // сколько удерживает рынок (продавец получает ask минус это)

// Банк. Курсы, проценты, цены и лимиты считает ТОЛЬКО сервер (supabase/bank.sql); здесь данные для показа.
// Должны совпадать с bank.sql, это сверяет tests/bank.test.mjs. Титулы из items выходят ограниченным тиражом (max — всего штук на сервер, сколько продано отдаёт bank_state) и не входят в SHOP (их нельзя купить за рубли), но находятся через itemOf.
export const BANK={usdBuy:250000,usdSell:150000,exMax:100000,maxDep:3,
 cancel:{pct:10,graceMin:5},   // досрочное закрытие вклада: штраф % от вложенного, первые graceMin минут без штрафа (зеркало bank_deposit_cancel)
 depRub:{min:100000,max:1e10,pct:{1:2,3:8,7:20}},depUsd:{min:10,max:1000000,pct:{1:4,3:12,7:30}},
 luck:{cost:15,rolls:10,cap:5000,best:3,bulk:10},lots:{cost:40,step:5,max:20},
 cases:[
  {id:'vip',n:'VIP',usd:25,w:[0,10,50,40,0],col:'#4ade80',d:'Редкие и эпические машины'},
  {id:'royal',n:'Королевский',usd:120,w:[0,0,20,60,20],col:'#f5b82e',d:'Эпики почти всегда, 20% на легендарную'}],
 items:[
  {id:'banker',n:'Банкир',usd:150,max:500,c:'#38bdf8',d:'Титул для тех, кто знает цену деньгам'},
  {id:'tycoon',n:'Магнат',usd:600,max:100,c:'#fb923c',d:'Титул для владельцев крупного капитала'},
  {id:'whale',n:'Кит',usd:2000,max:10,c:'#e879f9',d:'Самый редкий титул в игре'}]};
export const depPayout=(cur,amt,days)=>{const d=cur=='rub'?BANK.depRub:BANK.depUsd;return amt+Math.floor(amt*d.pct[days]/100)};

// Перерождение. Условия, награды и цены считает ТОЛЬКО сервер (supabase/prestige.sql); здесь данные для показа.
// Должны совпадать с prestige.sql, это сверяет tests/prestige.test.mjs.
// Кланы (зеркало констант clans.sql, сверяет tests/clans.test.mjs). up[l] — цена перехода НА уровень l (₽, сгорает из казны).
// upkeep × уровень² — содержание раз в upkeepDays дней; pt — сколько ₽ взноса дают одно очко сезона.
export const CLAN={createLvl:10,joinLvl:3,createRub:50000000,createUsd:50,donateMin:1000000,maxDeputies:3,maxLvl:5,
  up:{2:100000000,3:250000000,4:600000000,5:1500000000},upkeep:5000000,upkeepDays:7,idleDays:14,capStep:10,capMax:50,
  joinCdH:24,createCdH:72,maxReq:3,reqDays:7,name:[3,20],tag:[2,4],page:30,pt:1000000,descrMax:200,motdMax:160,logDays:30};
// Захват регионов и клановый магазин (clan_regions.sql). Сверяет tests/clans.test.mjs. boost: во сколько раз растёт вес региона при выпадении (REGION_BOOST в _shared/engine.ts).
export const CLAN_REG={bidMin:10000000,def:125,boost:3};
// frame/fx: вид тега клана (классы cf-*, cx-* в css/clans.css); title: титулы для участников (ct_*). lvl: с какого уровня клана
export const CLAN_SHOP=[
 {id:'cf_carbon',slot:'frame',n:'Карбон',p:60000000,lvl:1,d:'Тёмная карбоновая плашка'},
 {id:'cf_gold',slot:'frame',n:'Золото',p:150000000,lvl:2,d:'Золотая плашка с тёмной рамкой'},
 {id:'cf_neon',slot:'frame',n:'Неон',p:250000000,lvl:3,d:'Светящаяся бирюзовая обводка'},
 {id:'cf_holo',slot:'frame',n:'Голограмма',p:400000000,lvl:4,d:'Переливающаяся плашка'},
 {id:'cx_glint',slot:'fx',n:'Блик',p:120000000,lvl:2,d:'Свет пробегает по тегу'},
 {id:'cx_pulse',slot:'fx',n:'Пульс',p:250000000,lvl:3,d:'Тег мягко светится'},
 {id:'cx_fire',slot:'fx',n:'Огонь',p:500000000,lvl:4,d:'Тёплое пламя вокруг тега'},
 {id:'ct_racer',slot:'title',n:'Гонщик клана',p:80000000,lvl:1,c:'#ff7a2f',d:'Титул рядом с ником'},
 {id:'ct_vet',slot:'title',n:'Ветеран клана',p:200000000,lvl:2,c:'#f5b82e',d:'Титул рядом с ником'},
 {id:'ct_legend',slot:'title',n:'Легенда клана',p:600000000,lvl:4,c:'#e879f9',d:'Титул рядом с ником'}];
export const clanUpkeep=l=>CLAN.upkeep*l*l;
export const clanCap=l=>Math.min(CLAN.capMax,CLAN.capStep*l);
export const PRESTIGE={lvlBase:5,lvlStep:1,starsDiv:1,cashStep:50000,usdStep:5,
 perks:[
  {k:'sell',n:'Торговец',max:5,ic:'🤝',d:'+1% к цене при продаже номеров (до 100%)'},
  {k:'cash',n:'Стартовый капитал',max:10,ic:'💰',d:'+50 000 ₽ к деньгам после перерождения'},
  {k:'usd',n:'Валютная подушка',max:10,ic:'💵',d:'+5 $ после перерождения'}]};
export const rebNeed=n=>PRESTIGE.lvlBase+PRESTIGE.lvlStep*n;          // уровень для перерождения при n сделанных
export const rebStars=lvl=>Math.floor(lvl/PRESTIGE.starsDiv);          // звёзд за перерождение с уровня lvl
export const perkCost=lv=>lv+1;                                        // цена следующего уровня бонуса, когда сейчас lv
// Тройная прокрутка: пасс на время, продаётся окнами (таблица offers). Зеркало supabase/triple_roll.sql
// Лаборатория тестировщиков (supabase/testers.sql). Титулы и рамка не продаются: их выдаёт сервер за принятые баги.
// Пороги рангов и бонусы должны совпадать с bug_rank и bug_reward_apply в testers.sql, это сверяет tests/lab.test.mjs.
export const LAB={
 ranks:[{n:'Новичок',at:1},{n:'Охотник',at:3},{n:'Профи',at:7},{n:'Легенда',at:15}],
 bonus:[{rub:0,usd:0},{rub:3000000,usd:20},{rub:10000000,usd:50},{rub:30000000,usd:150}],
 titles:[{id:'tester',n:'Тестировщик',c:'#22d3ee'},{id:'bh2',n:'Охотник за багами',c:'#4ade80'},{id:'bh3',n:'Профи багов',c:'#f5b82e'},{id:'bh4',n:'Легенда багов',c:'#f43f5e'}],
 skin:{id:'matrix',n:'Матрица'},
 cats:[['gen','Генерация и номера'],['shop','Магазин, кейсы, банк'],['market','Рынок, аукцион, обмены'],['ui','Интерфейс и прокрутка'],['other','Другое']]};
// Титулы за поддержку проекта (Спонсор, Меценат) (supabase/patron.sql). Не продаётся: его выдаёт владелец вручную (supabase/admin/grant_patron.sql).
// id и слот должны совпадать с patron.sql, это сверяет tests/patron.test.mjs.
export const PATRON={titles:[{id:'sponsor',n:'Спонсор',c:'#2dd4bf',d:'Выдаётся тем, кто оплатил хостинг проекта'},{id:'patron',n:'Меценат',c:'#ff4fa3',d:'Выдаётся тем, кто поддержал проект'}]};
export const TRIPLE={usd:30,hours:24,max:3};

// Донат-шоп и «Поддержать проект» (Telegram Stars ⭐). Цены, составы и пороги выдаёт ТОЛЬКО сервер (supabase/donate.sql);
// здесь данные для показа. Совпадение с donate.sql сверяет tests/donate.test.mjs.
// k — вкладка, st — цена в ⭐, g — что выдаётся (usd, rub, luck, pass_days, items), x2 — первая покупка даёт вдвое больше валюты, max — сколько раз можно купить.
export const DONATE={
 tip:{min:10,max:10000,amounts:[25,50,100,250,500,1000]},
 // Именной номер: любой текст такой длины (зеркало NAMED_MIN и NAMED_MAX в supabase/functions/_shared/moderation.ts)
 named:{min:2,max:10},
 tabs:[['named','Номер'],['boost','Бусты'],['bundle','Наборы'],['item','Стиль']],
 // Роли (титулы благодарности): выдаются автоматически за сумму ⭐ и вручную через grant_role (donate.sql). id patron и sponsor совпадают с уже выданными в базе
 tiers:[{n:1,need:100,id:'sup1',t:'Друг проекта',c:'#4ade80'},{n:2,need:500,id:'patron',t:'Меценат',c:'#ec4899'},{n:3,need:1000,id:'sponsor',t:'Спонсор',c:'#2dd4bf'},{n:4,need:3000,id:'sup3',t:'Покровитель',c:'#a855f7'},{n:5,need:10000,id:'sup4',t:'Легенда проекта',c:'#f5b82e'}],
 packs:[
  {id:'named',k:'named',ic:'🪪',t:'Именной номер',st:149,g:{},max:3,d:'Любой текст на плашке: имя, ник, слово. Навсегда в вашей коллекции'},
  {id:'pass7',k:'boost',ic:'🎟️',t:'Тройной пасс на 7 дней',st:90,g:{pass_days:7},d:'Каждая прокрутка даёт три номера на выбор. Время добавляется к текущему пассу'},
  {id:'luck2x',k:'boost',ic:'🍀',t:'Удача ×2 навсегда',st:399,g:{luck2:1},max:1,d:'Шанс редких номеров и типов (такси, полиция, военные, дипломаты, ретро) вдвое выше на каждой прокрутке. Навсегда, один раз на игрока'},
  {id:'starter',k:'bundle',ic:'🎁',t:'Стартовый набор',st:49,g:{pass_days:3,luck:20},max:1,d:'Один раз на игрока'},
  {id:'founder',k:'bundle',ic:'👑',t:'Набор Основателя',st:349,g:{pass_days:7,luck:50,items:['dn_obsidian','dn_prism','ndn_plasma','ndn_void','bgdn_nebula','dn_nova']},max:1,d:'Вся эксклюзивная косметика со скидкой 33% и бусты. Один раз на игрока'},
  {id:'it_obsidian',k:'item',ic:'🖤',t:'Рамка «Обсидиан»',st:99,g:{items:['dn_obsidian']},max:1},
  {id:'it_prism',k:'item',ic:'🔮',t:'Рамка «Призма»',st:149,g:{items:['dn_prism']},max:1},
  {id:'it_plasma',k:'item',ic:'🟣',t:'Ник «Плазма»',st:49,g:{items:['ndn_plasma']},max:1},
  {id:'it_void',k:'item',ic:'🌌',t:'Ник «Бездна»',st:79,g:{items:['ndn_void']},max:1},
  {id:'it_nebula',k:'item',ic:'🪐',t:'Фон «Туманность»',st:79,g:{items:['bgdn_nebula']},max:1},
  {id:'it_nova',k:'item',ic:'💥',t:'Эффект «Сверхновая»',st:69,g:{items:['dn_nova']},max:1}],
 // Эксклюзивная косметика: продаётся только за ⭐, надевается через общие слоты (equip_item). Вид — css/donate.css
 items:[
  {id:'dn_obsidian',slot:'skin',n:'Обсидиан',d:'Чёрное стекло с алым свечением'},
  {id:'dn_prism',slot:'skin',n:'Призма',d:'Переливающаяся рамка, меняющая цвет'},
  {id:'ndn_plasma',slot:'nick',n:'Плазма',d:'Фиолетово-розовый перелив с бирюзой'},
  {id:'ndn_void',slot:'nick',n:'Бездна',d:'Тёмное фиолетовое свечение'},
  {id:'bgdn_nebula',slot:'bg',n:'Туманность',d:'Космические облака на главном экране'},
  {id:'dn_nova',slot:'drop',n:'Сверхновая',d:'Звёздные частицы фиолетового, розового и бирюзового'}]};
export const donateTier=total=>DONATE.tiers.filter(x=>total>=x.need).pop()||null;
export const donateVal=(p,x2)=>{const m=x2?2:1,g=p.g;return {usd:(g.usd||0)*m,rub:(g.rub||0)*m,luck:g.luck||0,luck2:g.luck2||0,days:g.pass_days||0,items:g.items||[]}};

// Детали машины (ивент). Зеркало supabase/car_parts.sql, совпадение проверяет tests/carparts.test.mjs.
// Бонус в промилле (20 = +2%): base × rar% × lvl%; цена улучшения жетонами: upBase × (редкость+1) × upStep[уровень-1].
export const CARPARTS={base:20,cap:200,rar:[100,150,220,320,450],lvlStep:25,maxLvl:5,upBase:100,upStep:[1,2,4,8],
  run:3,day:8,chance:35,gap:10,pickW:[60,28,10,2],
  rarN:['Обычная','Необычная','Редкая','Эпическая','Легендарная'],
  slots:[{k:'engine',n:'Двигатель',st:'acc',ic:'⚙️'},{k:'tires',n:'Шины',st:'grip',ic:'🛞'},{k:'susp',n:'Подвеска',st:'hand',ic:'🔧'},
         {k:'brakes',n:'Тормоза',st:'brk',ic:'🛑'},{k:'turbo',n:'Турбо',st:'tb',ic:'🌀'},{k:'body',n:'Кузов',st:'dur',ic:'🛡️'}],
  stats:{acc:'Разгон',grip:'Сцепление',hand:'Управление',brk:'Торможение',tb:'Турбо',dur:'Прочность'}};
export const cpPm=(rar,lvl)=>{const c=CARPARTS,r=c.rar[Math.min(Math.max(rar|0,0),4)],l=100+c.lvlStep*(Math.min(Math.max(lvl|0||1,1),c.maxLvl)-1);return Math.min(c.cap,Math.floor(c.base*r*l/10000))};
export const cpCost=(rar,lvl)=>lvl>=1&&lvl<=4?CARPARTS.upBase*(Math.min(Math.max(rar|0,0),4)+1)*CARPARTS.upStep[lvl-1]:null;

// Реферальная система «Друзья» (supabase/referral.sql). Суммы и пороги стартовые; настоящие значения лежат в таблицах ref_stages, ref_ladder, ref_cfg.
// Зеркало нужно только для показа прогресса, сверяет tests/referral.test.mjs. Клиент ничего не начисляет.
export const REF={alphabet:'ABCDEFGHJKMNPQRSTUVWXYZ23456789',codeLen:8,bindHours:24,page:20,ledger:30,
 stages:[{code:0,t:'Пришёл'},{code:1,t:'Освоился',rolls:30},{code:2,t:'Играет',rolls:100,days:3,window:10},{code:3,t:'Свой',ageDays:14}],
 welcome:{rub:500000,luck:30},
 reward:{stage1:200000,stage1Luck:10,stage2:1000000,stage2Luck:30,stage2Ref:1500000,stage3:2000000,stage3Luck:50},
 hold:{stage1:24,stage2:72,stage3:72,ladder:72},
 limits:{bindDay:30,actDay:15,playerCapRub:30000000,speedHours:6,ringRub:10000000,clusterN:5},revokeDays:30,
 ladder:[{n:1,rub:1000000,luck:20},{n:3,luck:30,item:'ref_f_own',t:'Рамка «Свой человек»'},{n:5,rub:5000000,luck:50},{n:10,luck:100,item:'ref_t_recruiter',t:'Титул «Вербовщик»'},{n:25,rub:10000000,t:'Номер серии «Друзья»'},
  {n:50,rub:50000000,luck:200,item:'ref_d_column',t:'Эффект «Колонна»'},{n:100,rub:100000000,item:'ref_t_leader',t:'Редкий номер серии и титул «Лидер сети»'},{n:250,rub:250000000,t:'Редкий номер серии и 250 млн'},{n:500,t:'Именной номер по заявке'}],
 items:[{id:'ref_t_invited',n:'По приглашению',slot:'title',c:'#9aa3b8'},{id:'ref_t_recruiter',n:'Вербовщик',slot:'title',c:'#f0b429'},{id:'ref_t_leader',n:'Лидер сети',slot:'title',c:'#ececf1'},
  {id:'ref_f_own',n:'Свой человек',slot:'skin',d:'Графитовая рамка с жёлтой кромкой'},{id:'ref_d_column',n:'Колонна',slot:'drop',d:'Серые и жёлтые частицы колонной'}]};
// Медиа-программа (supabase/media.sql). МК нельзя купить, продать или передать. Зеркало для показа, сверяет tests/media.test.mjs.
export const MEDIA={platforms:[['tiktok','TikTok'],['youtube','YouTube Shorts'],['instagram','Instagram Reels'],['vk','VK Клипы']],
 levels:[{level:1,t:'Автор',posts:1,views:0,mult:1},{level:2,t:'Блогер',posts:5,views:20000,mult:1.25},{level:3,t:'Топ-медиа',posts:20,views:250000,mult:1.5}],
 rewardPost:50,rewardRef:25,tiers:[[1000,100],[5000,300],[10000,600],[50000,2500],[100000,6000],[500000,30000],[1000000,80000]],seniorViews:50000,
 holdPostH:168,holdViewsH:72,keepDays:30,inactiveDays:60,monthCap:150000,minConvert:100,convLimit:20000,rubPerMc:25,usdPerMc:0.0001,feePct:20,
 limits:{postDay:1,postWeek:3,youngDays:7,accounts:4,viewsEveryDays:7},weekPrizes:[1500,1000,500],sla:{account:24,post:48,views:72},
 plate:{base:3000,round:8000,top:25000,popRegs:['77','99','177','777','78','178','97'],popPct:20},
 // eq — во сколько ₽ оценивается такой же предмет у нас в магазине за рубли (SHOP): нужен только тесту «магазин выгоднее обмена»
 shop:[{id:'med_frame',t:'Рамка «Эфир»',p:1500,eq:2500000},{id:'med_title',t:'Титул «Медиа»',p:800,eq:2000000},{id:'med_drop',t:'Эффект «Запись»',p:2500,eq:2500000},{id:'med_bg',t:'Фон «Студия»',p:1200,eq:1500000},
  {id:'med_luck',t:'Прокруты удачи ×10',p:200,perMonth:10,eq:30000}],
 series:['КЕК','МЕМ','ТОК','РЕК','ВАУ','ХАХ'],seriesLetters:'АВЕКМНОРСТУХ',
 points:{'19.3':'Накрутка','19.4':'Подмена скриншота','19.5':'Чужой контент','19.6':'Нарушение правил','19.12':'Обход лимитов'},
 items:[{id:'med_t_media',n:'Медиа',slot:'title',c:'#e5484d'},{id:'med_t_blogger',n:'Блогер',slot:'title',c:'#f0b429'},{id:'med_t_top',n:'Топ-медиа',slot:'title',c:'#ececf1'},
  {id:'med_f_air',n:'Эфир',slot:'skin',d:'Графитовая рамка с красной точкой записи'},{id:'med_d_rec',n:'Запись',slot:'drop',d:'Красные и жёлтые частицы'},{id:'med_b_studio',n:'Студия',slot:'bg',d:'Тёмная студия с софитом'}]};
// Цена номера серии «Медиа» в МК и сумма обмена (зеркало media_plate_price и media_convert; округление всегда вниз)
export const platePrice=(d,r)=>Math.ceil((['777','001','999'].includes(d)?MEDIA.plate.top:/^([1-9])\1\1$/.test(d)||/^00[1-9]$/.test(d)?MEDIA.plate.round:MEDIA.plate.base)*(MEDIA.plate.popRegs.includes(r)?1+MEDIA.plate.popPct/100:1));
export const convOut=(mc,rate,fee)=>Math.floor(mc*rate*(100-fee)/100);

// Хэллоуин «Ночь тыкв» (supabase/hw.sql, supabase/functions/hw-roll). Своя валюта 🎃 и свои номера, основной баланс не трогаются.
// Цифры зеркалят SQL; шансы, цену и награды считает только сервер, здесь данные для показа (совпадение проверяет tests/hw.test.mjs).
export const HW={cost:100,cap:300,sellPct:90,start:1000,daily:1500,streakStep:100,streakMax:6,
 chance:12,chanceBlood:25,pityAt:20,vbase:[60,75,140,1500,12000,60000],mult:[2,4,7,10],lvlMul:400,lvlBonus:50,
 powers:['','Слабое','Среднее','Сильное','Древнее'],pw:[50,30,15,5],pwBlood:[46,29,15,10],
 exch:{rate:500,limit:600},
 guardians:[{id:'cat',n:'Чёрный кот',e:'🐈\u200d⬛',c:'#a78bfa',w:24},{id:'pumpkin',n:'Тыква-фонарь',e:'🎃',c:'#ff8a1f',w:24},
  {id:'moon',n:'Полнолуние',e:'🌕',c:'#f6e7b4',w:20},{id:'web',n:'Паутина',e:'🕸️',c:'#9fb4c7',w:18},{id:'fire',n:'Могильный огонь',e:'🔥',c:'#4ff0b7',w:14}],
 quests:[{k:'rolls',n:'Выбить номера',need:20,rew:300},{k:'curses',n:'Поймать проклятия',need:2,rew:400},{k:'sold',n:'Продать номера',need:8,rew:200}],
 rewards:{g3:{need:3,pum:800,pct:2,min:150000,max:20000000},g5:{need:5,pum:5000,title:'hw_t_keeper'},gold:{need:5,minPw:3,pum:20000,title:'hw_t_lord'}},
 titles:[{id:'hw_t_keeper',n:'Хранитель ночи',c:'#ff9a3c'},{id:'hw_t_lord',n:'Повелитель ночи',c:'#c084fc'}],
 tops:[['best','🏆','Дорогой номер'],['guard','🕯','Хранители'],['curses','☠','Проклятия']]};
export const hwGuard=id=>HW.guardians.find(g=>g.id==id);
