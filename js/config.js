// Константы и таблицы баланса. Здесь нет логики: только данные.
export const COST=3000,START=50000;
export const RAR=[{n:'Обычный',en:'Common',p:53.81,c:'#9a9aab',m:1},{n:'Необычный',en:'Uncommon',p:37.96,c:'#4ade80',m:11.55},{n:'Редкий',en:'Rare',p:7.98,c:'#5b8cff',m:661.2},{n:'Эпический',en:'Epic',p:.24,c:'#a855f7',m:9955},{n:'Легендарный',en:'Legendary',p:.01,c:'#f5b82e',m:242550},{n:'Мифический',en:'Mythic',p:0,ps:'до 0,005',c:'#ff4d6d',m:1500000}];
// Типы номеров. k — тип, p — шанс в % (сумма 100), m — множитель цены, c — страны, где тип выпадает (в Беларуси только civil/taxi/police/transit).
// Должны совпадать с TYPES в supabase/functions/_shared/engine.ts и check в SQL, это сверяет tests/types.test.mjs.
export const TYPES=[{k:'civil',p:92.86,m:1,n:'Гражданский',c:['RU','BY']},{k:'taxi',p:4,m:24,n:'Такси',c:['RU','BY']},{k:'police',p:1,m:50,n:'Полиция',c:['RU','BY']},{k:'transit',p:2,m:.5,n:'Транзит',c:['RU','BY']},{k:'military',p:.07,m:80,n:'Военный',c:['RU']},{k:'diplomat',p:.06,m:120,n:'Дипломат',c:['RU']},{k:'retro',p:.01,m:200,n:'Ретро',c:['RU']},{k:'blat',p:0,m:150,n:'Блатной',c:['RU']}];   // blat — приз ивента (supabase/event.sql), из генератора не выпадает
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
export const FL=['Одинаковые цифры','Одинаковые буквы','Зеркальные цифры','Палиндром букв','Круглый номер','Цифры совпадают с регионом','Блатной номер','Малый номер','Гражданский','Такси','Полиция','Транзит','Военный','Дипломат','Ретро','Блатной'];
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
export const FXE={sparks:{pal:['#ffd54a','#fff3b0','#ffb300'],flash:'#ffd54a',star:1},fire:{pal:['#ff3b1d','#ff8a1d','#ffd23a'],flash:'#ff6a1d'},ice:{pal:['#7fe7ff','#b8f3ff','#4aa8ff'],flash:'#7fe7ff'},rainbow:{pal:['#ff4d4d','#ffb84d','#fff04d','#4dff88','#4da6ff','#c04dff'],flash:'#ffffff',star:1},ev_d_dust:{pal:['#b08a5a','#d9b98a','#8c6b3f'],flash:'#d9b98a'},ev_d_siren:{pal:['#d63a3a','#3a6ad6','#ffffff'],flash:'#ffffff'},ev_d_weld:{pal:['#fff3b0','#ffb347','#ff7a1a'],flash:'#ffb347',dir:'up',rad:.8,n:1.2},ev_d_ticket:{pal:['#f4f1e6','#ffe9a8','#d9d4c0'],flash:'#f4f1e6',sq:1,dir:'down',rad:.7},ev_d_smoke:{pal:['#8d8d93','#b4b4ba','#62626a'],flash:'#b4b4ba',big:1,rad:.55,n:.6},ev_d_cones:{pal:['#ef6a1a','#ffffff','#ff8a3a'],flash:'#ef6a1a',sq:1,dir:'up',rad:.9},ev_d_radar:{pal:['#ffffff','#9ad0ff','#2f6bff'],flash:'#ffffff',star:1,rad:1.3},ev_d_salute:{pal:['#ff4d4d','#ffb84d','#fff04d','#4dff88','#4da6ff','#c04dff'],flash:'#ffffff',star:1,rad:1.45,n:1.5}};
export const itemOf=id=>{for(const s in SHOP){const it=SHOP[s].find(x=>x.id==id);if(it)return {...it,slot:s}}const ct=CLAN_SHOP.find(x=>x.id==id&&x.slot=='title');if(ct)return {id:ct.id,n:ct.n,c:ct.c,slot:'title'};const b=BANK.items.find(x=>x.id==id);if(b)return {id:b.id,n:b.n,c:b.c,slot:'title'};const l=LAB.titles.find(x=>x.id==id);if(l)return {id:l.id,n:l.n,c:l.c,slot:'title'};const pt=PATRON.titles.find(x=>x.id==id);if(pt)return {id:pt.id,n:pt.n,c:pt.c,slot:'title'};const ev=EVENT.titles.find(x=>x.id==id);if(ev)return {id:ev.id,n:ev.n,c:ev.c,slot:'title'};return id==LAB.skin.id?{id:id,n:LAB.skin.n,slot:'skin'}:null};

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
 luck:{cost:15,rolls:10,cap:100,best:3},lots:{cost:40,step:5,max:20},
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
