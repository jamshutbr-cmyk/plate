// Investor showcase. Fictional data stays in memory and resets on refresh.
// This module never contacts Supabase. Production logic is in main.js/api.js.
import {S,fresh} from './state.js';
import {api} from './api.js';
import {DRAW,render,go} from './router.js';
import {genCost,trackSession} from './engine.js';
import {RAR,sellGain,itemOf,CST,SST,CCO,SCO,AUTO,CASES,BANK,dupRefund,depPayout} from './config.js';
import {banner} from './ui/modal.js';
import {icon} from './ui/design.js';
const makePlate=(id,main,reg,cls,price)=>({id,main,reg,country:'RU',type:'civil',rn:reg==='77'||reg==='777'?'Москва':reg==='178'?'Санкт-Петербург':'Краснодарский край',cls,price,mu:[1,10,1,Math.max(1,price/1000)],ts:Date.now()-id*3600000});
const initial=[makePlate(1,'А777АА','777',4,240000),makePlate(2,'М005ММ','77',3,65000),makePlate(3,'К123ТВ','178',2,24000),makePlate(4,'Е909КХ','123',1,8700),makePlate(5,'Т100ТТ','77',3,48000),makePlate(6,'Н282ОР','123',0,2400)];
let lots=[],mine=[],counter=100;let demoBank={now:Date.now(),deposits:[],luck:0,extra_lots:0,items:{}};let demoReports=[];let demoTrades=[];
function seed(){demoBank={now:Date.now(),deposits:[],luck:0,extra_lots:0,items:{}};demoReports=[];demoTrades=[];
 Object.assign(S,fresh(),{tester:true,nick:'Коллекционер',bal:248500,usd:1250,lvl:12,xp:9800,since:Date.now()-42*86400000,mute:true,vib:false,music:false,fx:2,reel:true,cars:['bmw','rs6','huracan'],col:initial.map(x=>({...x})),safe:[makePlate(7,'В888ВВ','77',4,180000)],capC:100,capS:10,seen:['tcivil','ttaxi','tpolice','r:RU:77','r:RU:777','r:RU:178','r:RU:123'],stats:{n:128,best:240000,cls:[64,36,18,8,2,0],f:{0:35,1:40,2:18,3:12}}});
 lots=[makePlate(901,'А001АА','77',4,350000),makePlate(902,'К777КК','777',4,280000),makePlate(903,'М555ММ','178',3,85000),makePlate(904,'О007ОО','77',3,125000),makePlate(905,'Е123КХ','123',1,8500),makePlate(906,'Т900ТТ','77',2,25000)].map((p,i)=>({...p,ask:[295000,235000,72000,110000,6500,21000][i],nick:['NIGHT DRIVE','MONO','Север','V8 CLUB','Линия','Антон'][i],seller:'demo-'+i}));mine=[];
}
const blocked=async()=>{banner('Только в полной версии','Это деморежим. Реальные операции и сервер отключены.');return {err:'demo'}};
export async function startDemo(){
 seed();for(const key of Object.keys(api))api[key]=blocked;
 Object.assign(api,{
  async generatePlate(){
   const cost=genCost();if(S.col.length>=S.capC||S.bal<cost)return null;
   // Deliberately illustrative, NOT the real rarity or pricing algorithm.
   const list=[['К808КК',2,14500],['М777ММ',3,92000],['А111АА',4,210000],['Т235НК',0,1200],['Х007ХХ',3,65000]];const [main,cls,price]=list[(counter-100)%list.length];
   const p=makePlate(++counter,main,S.reg?({'Москва':'77','Санкт-Петербург':'178'}[S.reg]||'123'):'77',cls,price);
   if(S.country==='BY'){p.country='BY';p.main='7777 AA-';p.reg='7';p.rn='Минск'}S.col.push(p);S.bal-=cost;S.xp+=100;S.stats.n++;S.stats.best=Math.max(S.stats.best,price);S.stats.cls[cls]++;trackSession(p);return {p,un:null};
  },
  async sellPlates(ids){const set=new Set(ids);const sum=[...S.col,...S.safe].filter(p=>set.has(p.id)).reduce((n,p)=>n+p.price,0);const gain=sellGain(sum,S.perks.sell);S.col=S.col.filter(p=>!set.has(p.id));S.safe=S.safe.filter(p=>!set.has(p.id));S.bal+=gain;return {gain}},
  async movePlates(ids,to){const source=to==='safe'?S.col:S.safe,dest=to==='safe'?S.safe:S.col,cap=to==='safe'?S.capS:S.capC;const plates=source.filter(p=>ids.includes(p.id));if(dest.length+plates.length>cap)return false;dest.push(...plates);if(to==='safe')S.col=source.filter(p=>!ids.includes(p.id));else S.safe=source.filter(p=>!ids.includes(p.id));return true},
  async setNick(n){S.nick=String(n).slice(0,20);return S.nick},
  async setGenPrefs(c,r){S.country=c;S.reg=r||''},
  setSettings(patch){Object.assign(S,patch)},async syncPlayer(){},async claimDaily(){return null},async bailout(){return false},
  async buyCapacity(k){const c=k==='c',steps=c?CST:SST,costs=c?CCO:SCO,current=c?S.capC:S.capS,i=steps.indexOf(current)+1,price=costs[i-1];if(!steps[i]||!(price>=0))return {err:1,need:0};if((c?S.bal:S.usd)<price)return {err:1,need:price};if(c){S.bal-=price;S.capC=steps[i]}else{S.usd-=price;S.capS=steps[i]}return {ok:1}},
  async buyItem(id){const it=itemOf(id);if(!it)return {err:1};if(S.owned.includes(id))return {ok:1};if(S.bal<it.p)return {err:1,need:it.p};S.bal-=it.p;S.owned.push(id);return {ok:1}},
  async equipItem(slot,id){S.equip[slot]=id||''},
  async buyAutosell(){if(S.usd<AUTO.cost)return {err:1,need:AUTO.cost};S.usd-=AUTO.cost;S.as.lvl=1;return {ok:1}},
  async autoSet(k,v){S.as[k]=v},async autosell(){return null},
  async marketBuy(id){const l=lots.find(x=>x.id==id);if(!l)return {err:'gone'};if(S.bal<l.ask)return {err:'money'};if(S.col.length>=S.capC)return {err:'full'};S.bal-=l.ask;S.col.push({...l,id:++counter});lots=lots.filter(x=>x.id!=id);return {ok:1}},
  async marketList(id,ask){const p=[...S.col,...S.safe].find(x=>x.id==id);if(!p)return {err:'plate'};if(mine.length>=10)return {err:'lots'};mine.push({...p,id:++counter,ask,nick:S.nick});S.col=S.col.filter(x=>x.id!=id);S.safe=S.safe.filter(x=>x.id!=id);return {ok:1}},
  async marketCancel(id){const l=mine.find(x=>x.id==id);if(!l)return {err:'gone'};S.col.push(l);mine=mine.filter(x=>x.id!=id);return {ok:1}},async marketAck(){},
  async evBlat(){return {left:0,cap:0}},
  async bankState(){return {...demoBank,now:Date.now()}},
  async bankExchange(dir,n){if(n<1)return {err:'amount'};if(dir==='buy'){if(S.bal<n*BANK.usdBuy)return {err:'rub'};S.bal-=n*BANK.usdBuy;S.usd+=n}else{if(S.usd<n)return {err:'usd'};S.usd-=n;S.bal+=n*BANK.usdSell}return {ok:1}},
  async bankDepositOpen(cur,amount,days){const rules=cur==='rub'?BANK.depRub:BANK.depUsd,key=cur==='rub'?'bal':'usd';if(amount<rules.min||amount>rules.max||![1,3,7].includes(days))return {err:'amount'};if(S[key]<amount)return {err:cur};if(demoBank.deposits.length>=3)return {err:'many'};S[key]-=amount;demoBank.deposits.push({id:++counter,cur,amount,days,pct:rules.pct[days],payout:depPayout(cur,amount,days),start:Date.now(),ends:Date.now()+days*86400000});return {ok:1}},
  async bankDepositCancel(id){const d=demoBank.deposits.find(x=>x.id==id);if(!d)return {err:'gone'};S[d.cur==='rub'?'bal':'usd']+=d.amount;demoBank.deposits=demoBank.deposits.filter(x=>x.id!=id);return {ok:1,res:{refund:d.amount,fee:0,cur:d.cur}}},
  async bankBuyLuck(n){const cost=BANK.luck.cost*n;if(S.usd<cost)return {err:'usd'};S.usd-=cost;demoBank.luck+=BANK.luck.rolls*n;return {ok:1,res:demoBank.luck}},
  async bankBuyItem(id){const it=BANK.items.find(x=>x.id===id);if(!it)return {err:'gone'};if(S.owned.includes(id))return {err:'owned'};if(S.usd<it.usd)return {err:'usd'};S.usd-=it.usd;S.owned.push(id);demoBank.items[id]={sold:1};return {ok:1}},
  async bankBuyLots(){if(S.usd<BANK.lots.cost)return {err:'usd'};S.usd-=BANK.lots.cost;demoBank.extra_lots+=BANK.lots.step;return {ok:1,res:BANK.lots.step}},
  async clanState(){return {now:Date.now(),clan:null,reqs:[],cd:{},season_end:Date.now()+6*86400000}},
  async clanSearch(q){const clans=[{id:1,name:'Ночной клуб',tag:'NITE',lvl:3,n:18,cap:30,mode:'open',min_lvl:3,medal:1},{id:2,name:'Монохром',tag:'MONO',lvl:2,n:12,cap:20,mode:'request',min_lvl:5},{id:3,name:'Северная столица',tag:'NORD',lvl:4,n:32,cap:40,mode:'open',min_lvl:10}];return {clans:clans.filter(x=>!q||(x.name+x.tag).toLowerCase().includes(q.toLowerCase())),more:false}},
  async refState(){return {on:true,banned:false,invited:0,active:0,code:'DEMO',link_base:'https://example.invalid/plate-demo?code=',boost:1,debt:0,dm:true,can_bind:false,friends:[],ledger:[],ladder:[{n:1,state:'locked',reward:{rub:5000}},{n:3,state:'locked',reward:{rub:25000}},{n:5,state:'locked',reward:{rub:50000,luck:10}}]}},
  async refTop(){return {rows:[],me:null}},
  async mediaState(){return {on:true,banned:false,part:true,level:1,mult:1,coins:0,debt:0,approved:0,views:0,next:{title:'Автор',posts:3,views:1000},month:{earned:0,cap:10000},pool_open:true,accounts:[],posts:[],series:[],shop:[],rates:{rub:1000,usd:1,fee:5,used:0,limit:10000},young:false}},
  async labState(){return {tester:true,bugs:0,rank:0,reports:demoReports,hall:[],flags:[],chat:null}},
  async reportBug(cat,body,link){demoReports.push({id:++counter,cat,body,link,status:'new'});return {ok:1}},
  async donateState(){return {bought:{},donated:0,orders:[],goal:null}},async donateWall(){return []},
  async donateBuy(){return {err:'unsupported'}},
  async openCase(id){const c=CASES.find(x=>x.id===id);if(!c)return {err:1};if(S.bal<c.p)return {err:1,need:c.p};S.bal-=c.p;const car={id:'granta',r:1},dup=S.cars.includes(car.id),refund=dup?dupRefund(car.r):0;if(!dup)S.cars.push(car.id);S.bal+=refund;return {car_id:car.id,dup,refund}},
  async openCaseUsd(id){const c=BANK.cases.find(x=>x.id===id);if(!c)return {err:'gone'};if(S.usd<c.usd)return {err:'usd'};S.usd-=c.usd;const idCar='gelik',dup=S.cars.includes(idCar);if(!dup)S.cars.push(idCar);const refund=dup?dupRefund(3):0;if(dup)S.bal+=refund;return {car_id:idCar,dup,refund}},
  async resetProgress(){seed();banner('Демо восстановлено','Стартовая коллекция и баланс возвращены.')},
 });
 // These screens require live server state. Do not simulate payments, social activity or event outcomes.
 const serverRoutes={bank:['Игровой банк','Обмен валют, вклады и усиления работают с серверным балансом. В демонстрации реальные операции недоступны.'],clans:['Клуб сильнее вместе','Кланы, заявки, казна и территории требуют авторизации. В демо ты можешь исследовать личную коллекцию, гараж и рынок.'],friends:['Свои люди в клубе','Приглашения и награды за друзей доступны в Telegram. Демо не создаёт рефералов и не отправляет сообщения.'],media:['Твоя коллекция в кадре','Медиааккаунты и задания подключаются в полной версии. Демо не публикует и не загружает контент.'],auction:['Время делать ставку','Аукцион синхронизируется между реальными игроками. Ставки и исходы в демо отключены.'],trades:['Хорошие находки меняют владельцев','Обмены между игроками доступны после входа через Telegram. В демонстрации работает локальный рынок.'],road:['Город ждёт','Игровое событие и его награды рассчитываются на сервере. Открой гараж и подготовь машину к настоящей игре.'],hw:['Ночь тыкв','Сезонное событие доступно через сервер игры. Демо не имитирует награды и результаты события.'],evshop:['Награды события','Покупки за валюту события доступны только в полной версии.'],gai:['Твой следующий заезд','Многопользовательский режим требует подключения к игровому серверу.'],lab:['Лаборатория номеров','Для расчётов лаборатории необходимы серверные данные. Правила редкостей доступны в каталоге.'],dshop:['Особые возможности','Покупки за Stars доступны в Telegram. В демо нет платежей и выставления счетов.'],support:['Поддержать PLATE','Спасибо за интерес к проекту. Платежи полностью отключены в локальной демонстрации.']};
 const nativeDemoRoutes=new Set(['bank','clans','friends','media','auction','trades','lab','dshop','support']);
 for(const [key,[title,copy]] of Object.entries(serverRoutes)){
  if(nativeDemoRoutes.has(key))continue;
  const view=document.getElementById('v-'+key);let head=view.querySelector('.head');if(!head){head=document.createElement('div');head.className='head';head.innerHTML=`<button class="burger" data-click="go" data-arg="menu" aria-label="Назад">←</button>${title}`}head.remove();for(const child of view.children)child.hidden=true;view.prepend(head);
  const e=document.createElement('section');e.className='offline-panel';e.innerHTML=`<span class="offline-icon">${icon(key)}</span><span class="eyebrow">DEMO / БЕЗ ПОДКЛЮЧЕНИЯ</span><h2>${title}</h2><p>${copy}</p><button class="big2" data-click="go" data-arg="market">Открыть деморынок :pi/external:</button><button class="btn" data-click="go" data-arg="garage">Посмотреть гараж</button>`;view.append(e);DRAW[key]=()=>{};
 }
 const {initDemoLobbies}=await import('./demo-lobbies.js');initDemoLobbies();
 document.getElementById('boot')?.remove();
 const screen=new URLSearchParams(location.search).get('screen');const allowed=new Set([...Object.keys(DRAW),'main','menu','col','safe']);if(screen&&allowed.has(screen))go(screen);else render();
}
export async function demoRpc(name,args={}){
 if(name==='market_browse'){let out=lots.filter(x=>args.p_cls==null||x.cls===args.p_cls);if(args.p_sort==='cheap')out.sort((a,b)=>a.ask-b.ask);if(args.p_sort==='dear')out.sort((a,b)=>b.ask-a.ask);return out.slice(args.p_off||0,(args.p_off||0)+20)}
 if(name==='my_trades')return {in:[],out:demoTrades,done:[]};
 if(name==='get_player_plates')return lots.slice(2,5);
 if(name==='get_player_profile')return {nick:'NIGHT DRIVE',lvl:15,xp:14000,since:new Date(Date.now()-45*86400000).toISOString(),me:false,stats:{n:225,best:320000,cls:[120,60,25,15,5,0],f:{}},count:3,value:320000,top:lots[2]};
 if(['get_showcase','hw_museum_public'].includes(name))return [];
 if(name==='propose_trade'){const give=S.col.find(x=>x.id==args.p_give),want=lots.find(x=>x.id==args.p_want);demoTrades.push({id:++counter,nick:'NIGHT DRIVE',give,want});return counter}
 if(name==='cancel_trade'){demoTrades=demoTrades.filter(x=>x.id!=args.p_id);return true}
 if(name==='player_search')return [{id:'demo-player',nick:'NIGHT DRIVE',lvl:15}].filter(x=>!args.p_q||x.nick.toLowerCase().includes(args.p_q.toLowerCase()));
 if(name==='auction_browse')return {t:Math.floor(Date.now()/1000),lots:lots.slice(2,5).map((l,i)=>({...l,id:2000+i,cur:l.ask,nx:l.ask+1000,bids:i+1,ends:Math.floor(Date.now()/1000)+3600*(i+1)}))};
 if(name==='auction_mine')return {t:Math.floor(Date.now()/1000),lots:[],bids:[],events:[]};
 if(name==='market_mine')return {lots:mine,sold:[],slots:10};
 if(name==='get_leaderboard'){const n=['NIGHT DRIVE','Коллекционер','Северный клуб','МОНО','Roadrunner'];const top=n.map((nick,i)=>({id:'d'+i,nick,lvl:15-i,best:320000-i*40000,val:320000-i*40000,rk:i+1,me:i===1,rb:0}));return {top,me:top[1]}}
 if(['get_styles','clan_tags','clan_styles'].includes(name))return {};
 if(name==='get_player')return null;
 if(name==='hw_profile')return null;
 throw new Error('This server action is unavailable in the isolated demo: '+name);
}
