// Presentation only: navigation, accessible controls and live state summaries.
import {painters} from '../router.js';
import {S} from '../state.js';
import {fmt,esc} from '../util.js';
import {genCost} from '../engine.js';
import {DEMO} from '../mode.js';
import {LST} from './uistate.js';
import {cm} from './modal.js';
const paths={
 main:'M4 6h16v12H4z M7 10h7 M7 14h4 M17 10v4',
 col:'M4 5h13v12H4z M8 2h13v12 M7 9h7 M7 13h4 M7 20h13',
 market:'m3 10 2-6h14l2 6 M4 10v10h16V10 M8 20v-6h5v6 M3 10c0 3 4 3 4 0 0 3 5 3 5 0 0 3 5 3 5 0 0 3 4 3 4 0',
 garage:'m3 11 2-6h14l2 6 M3 11h18v7H3z M5 18v3 M19 18v3 M6 14h2 M16 14h2',
 menu:'M4 5h6v6H4z M14 5h6v6h-6z M4 15h6v6H4z M14 15h6v6h-6z',
 safe:'M4 3h16v18H4z M8 7h8v10H8z M12 9v6 M10 12h4',
 profile:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0',
 cases:'m3 7 9-4 9 4-9 4-9-4Z M3 7v10l9 4 9-4V7 M12 11v10 M7 5l10 4',
 up:'M4 20h16 M7 16v-4 M12 16V8 M17 16V4',
 ach:'m12 3 3 6 6 1-4 5 1 6-6-3-6 3 1-6-4-5 6-1 3-6Z',
 top:'M8 3h8v6a4 4 0 0 1-8 0V3Z M8 5H4v3a4 4 0 0 0 4 4 M16 5h4v3a4 4 0 0 1-4 4 M12 13v7 M8 21h8',
 bank:'m3 8 9-5 9 5H3Z M5 11v7 M10 11v7 M15 11v7 M20 11v7 M3 21h18',
 gen:'M4 7h9 M17 7h3 M4 17h3 M11 17h9 M15 5v4 M9 15v4',
 cat:'M3 4h7l2 2 2-2h7v16h-7l-2 2-2-2H3V4Z M12 6v16',
 album:'M4 4h16v16H4z M8 4v16 M12 8h4 M12 12h4',
 stat:'M4 21V10 M10 21V3 M16 21v-7 M22 21H2',
 trades:'M3 7h17 M16 3l4 4-4 4 M21 17H4 M8 13l-4 4 4 4',
 auction:'m14 3 7 7 M12 5l7 7 M13 6l-4 4 5 5 4-4 M11 13l-7 7 M14 21h8',
 friends:'M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M1 21a7 7 0 0 1 14 0 M17 4a4 4 0 0 1 0 8 M17 15a6 6 0 0 1 6 6',
 clans:'m12 3 9 4v6c0 5-9 8-9 8S3 18 3 13V7l9-4Z M8 12l3 3 5-6',
 set:'M4 7h8 M16 7h4 M4 17h4 M12 17h8 M14 4v6 M10 14v6',
 theme:'M12 3a9 9 0 0 0 0 18c4 0-1-5 3-5h2c7 0 4-13-5-13Z M7 10h.01 M10 6h.01 M15 6h.01 M18 10h.01',
 lab:'M9 3h6 M10 3v7l-6 9v2h16v-2l-6-9V3 M7 16h10',
 prestige:'M20 7A9 9 0 1 0 21 14 M20 2v5h-5 M8 12l4-4 4 4 M12 8v9',
 media:'M4 4h16v16H4z m6 5 6 3-6 3V9Z',
 road:'M8 3 4 21 M16 3l4 18 M12 4v4 M12 11v4 M12 18v3',
 support:'M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5Z',
 hw:'M6 8c-6 0-5 12 0 12h12c5 0 6-12 0-12-4 2-8 2-12 0 M12 3v6 M8 14h1 M15 14h1 M9 17h6',
 dshop:'M4 7h16v14H4z M3 7h18V4H3z M12 4v17 M8 4C3-2 13 0 12 4 M16 4c5-6-5-4-4 0',
 evshop:'M4 7h16v14H4z M8 7V4h8v3 M7 12h10 M12 9v6',
 auto:'M4 7h16 M8 3l-4 4 4 4 M20 17H4 M16 13l4 4-4 4',
 gai:'M5 12h14v8H5z M7 12V7a5 5 0 0 1 10 0v5 M12 15v2',
 multi:'M3 5h14v10H3z M7 9h14v10H7 M7 21h14',
};
Object.assign(paths,{alert:'m12 3 10 18H2L12 3Z M12 9v5 M12 17h.01',help:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18 M9 9a3 3 0 1 1 4 3c-1 0-1 1-1 2 M12 17h.01',external:'M14 3h7v7 M21 3 10 14 M10 3H3v18h18v-7',candle:'M9 10h6v11H9z M12 8c-5-2 0-7 0-7s5 5 0 7',circle:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18',play:'m8 4 12 8-12 8V4Z',download:'M12 3v13 M7 11l5 5 5-5 M4 17v4h16v-4',sound:'M3 9h4l5-5v16l-5-5H3V9Z M16 8c3 2 3 6 0 8 M19 5c5 4 5 10 0 14',music:'M8 18V5l12-2v13 M8 9l12-2 M8 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3 M20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3',haptic:'M8 3h8v18H8z M4 7v10 M1 10v4 M20 7v10 M23 10v4',search:'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14 M15 15l6 6',studio:'m13 2-9 12h7l-1 8 10-13h-7l1-7Z',shop:'M4 8h16v13H4z M8 8V6a4 4 0 0 1 8 0v2',dshop:'m3 8 5-5h8l5 5-9 13L3 8Z M3 8h18 M8 3l4 18 4-18',support:paths.support,plus:'M12 5v14 M5 12h14',close:'M6 6l12 12 M18 6 6 18',arrow:'M5 12h14 M13 6l6 6-6 6',check:'m5 12 4 4L19 6',refresh:'M20 7A9 9 0 1 0 21 14 M20 2v5h-5',copy:'M8 8h12v13H8z M4 17H3V3h13v1',share:'M12 16V3 M7 8l5-5 5 5 M5 12v9h14v-9'});
export const icon=(k)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[k]||paths.main}"/></svg>`;
const sections=[
 ['Твоя коллекция', [['col','Коллекция','Все твои комбинации'],['safe','Сейф','Сохрани самое ценное'],['garage','Гараж','Машины с твоим характером'],['profile','Профиль','Твоя история в клубе']]],
 ['Клуб и торговля', [['market','Рынок','Покупай и продавай номера'],['auction','Аукцион','Редкости достаются смелым'],['trades','Обмены','Найди идеальную сделку'],['top','Рейтинг','Узнай своё место в клубе'],['friends','Друзья','Собирать интереснее вместе'],['clans','Кланы','Территория твоей команды']]],
 ['Развивай коллекцию', [['cases','Кейсы','Открывай новые автомобили'],['up','Улучшения','Больше места и возможностей'],['bank','Банк','Управляй игровым капиталом'],['shop','Магазин','Придай коллекции свой стиль'],['dshop','Премиум','Особые возможности'],['support','Поддержать','Помоги проекту развиваться']]],
 ['Твоя история', [['ach','Достижения','Каждый шаг имеет значение'],['album','Регионы','Собери географию номеров'],['stat','Статистика','Коллекция в деталях'],['cat','Каталог редкостей','Разберись в комбинациях'],['prestige','Перерождение','Новый виток твоей истории'],['media','Медиа','Расскажи о своей коллекции']]],
 ['Другие режимы', [['hw','Ночь тыкв','Сезонное событие'],['road','Полицейский беспредел','Испытай себя на дороге'],['evshop','Магазин события','Награды за твой прогресс'],['gai','ГАИ','Отдельный игровой режим'],['lab','Лаборатория','Проверяй гипотезы']]],
 ['Настрой под себя', [['gen','Генератор','Страны, регионы и типы'],['auto','Автопродажа','Твои правила коллекции'],['theme','Оформление','Выбери свой стиль'],['set','Настройки','Звук, вибрация и эффекты']]],
];
const club=document.getElementById('clubSections');
club.innerHTML=sections.map(([title,items])=>`<section class="club-section"><h2>${title}</h2><div class="club-section-list">${items.map(([route,name,desc])=>`<button class="club-link" data-click="go" data-arg="${route}"><span class="club-icon">${icon(route)}</span><span><b>${name}</b><small>${desc}</small></span><em>:pi/external:</em></button>`).join('')}</div></section>`).join('');
const nav=document.createElement('nav');nav.className='app-nav';nav.setAttribute('aria-label','Основная навигация');nav.innerHTML=`<a class="rail-brand" href="#main" data-click="go" data-arg="main"><span class="brand-symbol">P</span>PLATE<small>®</small></a><div class="rail-kicker">COLLECTOR’S CLUB</div><div class="nav-items">${[['main','Главная'],['col','Коллекция'],['market','Рынок'],['garage','Гараж'],['menu','Клуб']].map(([key,name])=>`<button class="nav-item" data-click="go" data-arg="${key}">${icon(key)}<span>${name}</span></button>`).join('')}</div><div class="rail-bottom"><b>Твой следующий трофей<br>ещё не найден.</b>PLAY. COLLECT. REPEAT.<span class="rail-version">${DEMO?'<span class="demo-pill"><i></i> DEMO / ЛОКАЛЬНО</span>':'PLATE MINI APP / V.02'}</span></div>`;document.body.append(nav);
for(const e of document.querySelectorAll('[data-icon]'))e.innerHTML=icon(e.dataset.icon);
for(const e of document.querySelectorAll('.burger'))e.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m14 5-7 7 7 7"/></svg>';
if(DEMO){document.body.classList.add('is-demo');const label=document.createElement('span');label.className='demo-pill';label.innerHTML='<i></i>DEMO';document.querySelector('.home-header-right').prepend(label)}
const intros={
 market:'Найди комбинацию, которой не хватает твоей коллекции. <strong>Номера от других игроков.</strong>',
 garage:'Машина задаёт характер. Номер делает её твоей.',
 cases:'Новая машина начинается с одного открытия. Все шансы — перед тобой.',
 cat:'Красота в совпадениях. Узнай, что делает номер редким.',
 top:'Коллекции, которые задают планку всему клубу.',
 shop:'Твоя коллекция заслуживает собственного стиля.',

 up:'Дай своей коллекции больше пространства для роста.',
 bank:'Твой игровой капитал под контролем.',
};
for(const [key,copy] of Object.entries(intros)){const v=document.getElementById('v-'+key);const head=v?.querySelector('.head');if(head){const e=document.createElement('p');e.className='route-intro';e.innerHTML=copy;(head.parentElement.classList.contains('top')?head.parentElement:head).after(e)}}
let lastRoute='';
function set(id,text){const e=document.getElementById(id);if(e)e.textContent=text}
function paintDesign(){
 const route=document.querySelector('.view.on')?.id.slice(2)||'main';document.body.dataset.route=route;
 const active=route==='main'?'main':route==='list'?(LST.ls==='col'?'col':'menu'):['market','mnew','auction','anew'].includes(route)?'market':route==='garage'?'garage':'menu';
 for(const e of nav.querySelectorAll('.nav-item')){e.classList.toggle('active',e.dataset.arg===active);if(e.dataset.arg===active)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')}
 if(route!==lastRoute){lastRoute=route;window.scrollTo({top:0,behavior:'instant'})}
 set('homeAvatar',[...(S.nick||'P')][0].toUpperCase());set('walletRub',fmt(S.bal)+' ₽');set('walletUsd',fmt(S.usd)+' $');set('walletLevel','Уровень '+S.lvl);set('generationCost',fmt(genCost())+' ₽');
 for(const e of document.querySelectorAll('.club-link[data-arg=lab]'))e.hidden=!S.tester;
 const total=[...S.col,...S.safe];set('homeCount',total.length);set('homeValue',fmt(total.reduce((n,p)=>n+p.price,0))+' ₽');set('homeCapacityLabel',S.col.length+' / '+S.capC+' слотов');
 if(document.getElementById('homeCapacity'))document.getElementById('homeCapacity').style.width=Math.min(100,S.col.length/S.capC*100)+'%';if(document.getElementById('walletProgress'))document.getElementById('walletProgress').style.width=Math.min(100,S.xp/(S.lvl*1250)*100)+'%';
 requestAnimationFrame(enhance);
}
function enhance(){
 for(const e of document.querySelectorAll('[data-click]:not(button):not(a):not(input):not(select):not(textarea):not([tabindex]):not([role="dialog"])')){e.setAttribute('role','button');e.tabIndex=0}
 const sh=document.getElementById('sh');if(sh.childNodes.length&&!sh.querySelector('.sheet-close')){const close=document.createElement('button');close.className='sheet-close';close.dataset.click='cm';close.setAttribute('aria-label','Закрыть окно');close.textContent='×';sh.prepend(close)}
 const empty=document.querySelector('#rows>.hint');if(empty){const e=document.createElement('div');e.className='empty-collection';e.innerHTML=`<h3>${LST.ls==='safe'?'Здесь будет самое ценное':'Начни свою историю'}</h3><p>${LST.ls==='safe'?'Перенеси номер из коллекции, чтобы сохранить его в сейфе.':'Первый редкий номер может оказаться ближе, чем кажется.'}</p><button class="btn" data-click="go" data-arg="${LST.ls==='safe'?'col':'main'}">${LST.ls==='safe'?'В коллекцию':'Найти первый номер'} :pi/external:</button>`;empty.replaceWith(e)}
}
painters.push(paintDesign);
new MutationObserver(()=>requestAnimationFrame(enhance)).observe(document.getElementById('sh'),{childList:true});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][data-click]:not(button):not(a)')){e.preventDefault();e.target.click()}if(e.key==='Escape'&&document.getElementById('md').classList.contains('on'))cm()});
document.querySelector('.wordmark')?.addEventListener('click',e=>{e.preventDefault();nav.querySelector('[data-arg=main]').click()});
// Dialog focus is restored to its trigger on close; tab stays inside the sheet.
let focusedBefore=null;const md=document.getElementById('md');md.setAttribute('role','dialog');md.setAttribute('aria-modal','true');md.setAttribute('aria-label','Действие с коллекцией');
new MutationObserver(()=>{document.body.classList.toggle('sheet-open',md.classList.contains('on'));if(md.classList.contains('on')){focusedBefore=document.activeElement;requestAnimationFrame(()=>{enhance();md.querySelector('button,input,select,[tabindex="0"]')?.focus()})}else focusedBefore?.focus?.()}).observe(md,{attributes:true,attributeFilter:['class']});
document.addEventListener('keydown',e=>{if(e.key!=='Tab'||!md.classList.contains('on'))return;const all=[...md.querySelectorAll('button:not(:disabled),input:not(:disabled),select,[tabindex="0"]')].filter(x=>x.getClientRects().length);const first=all[0],last=all.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}});

// Native interaction layer: searchable hub and consistent line icons, including async sections.
const searchHost=document.createElement('div');searchHost.className='club-search';searchHost.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg><input id="clubSearch" type="search" placeholder="Найти раздел" aria-label="Поиск по разделам клуба" autocomplete="off">';club.before(searchHost);
const quick=document.createElement('div');quick.className='club-quick';quick.innerHTML=[['col','Номера'],['market','Рынок'],['garage','Гараж'],['cases','Кейсы'],['top','Рейтинг'],['bank','Банк']].map(([route,name])=>`<button data-click="go" data-arg="${route}"><span>${icon(route)}</span>${name}</button>`).join('');searchHost.after(quick);
const noResults=document.createElement('div');noResults.className='club-no-results';noResults.hidden=true;noResults.textContent='Ничего не найдено. Попробуй другое название.';club.after(noResults);
searchHost.querySelector('input').addEventListener('input',e=>{const query=e.target.value.trim().toLocaleLowerCase('ru');let count=0;for(const section of club.querySelectorAll('.club-section')){let n=0;for(const item of section.querySelectorAll('.club-link')){const show=!query||item.textContent.toLocaleLowerCase('ru').includes(query);item.hidden=!show;if(show){count++;n++}}section.hidden=!n}noResults.hidden=!!count;quick.hidden=!!query});
const actionIcon=action=>/cm|Close|Cancel/.test(action)?'close':/Copy|copy/.test(action)?'copy':/Share|share/.test(action)?'share':/retry|Refresh|Again/.test(action)?'refresh':/sell|Swap|Ex|Conv/.test(action)?'trades':/move|safe/.test(action)?'safe':/buy|Buy|Claim/.test(action)?'plus':/Open|csOpen/.test(action)?'cases':/Nick|profile/i.test(action)?'profile':/Save|Send|Create|Make/.test(action)?'check':/reg|country|Gen|Set/i.test(action)?'gen':/reset|rebirth/i.test(action)?'prestige':'arrow';
function nativeDecorate(){
 // Label every dynamic form control without changing its server contract.
 for(const input of document.querySelectorAll('.view.on input:not([aria-label]),.view.on textarea:not([aria-label]),#md input:not([aria-label]),#md textarea:not([aria-label])')){
  if(input.type==='hidden')continue;const label=input.closest('label')?.querySelector('span')?.textContent||input.placeholder||input.dataset.arg||'Настройка';input.setAttribute('aria-label',label);
 }
}
let nativeFrame=0;new MutationObserver(records=>{if(!records.some(r=>r.target.nodeType===1&&(r.target.closest('.view.on')||r.target.closest('#md'))))return;if(nativeFrame)return;nativeFrame=requestAnimationFrame(()=>{nativeFrame=0;nativeDecorate()})}).observe(document.body,{childList:true,subtree:true});
requestAnimationFrame(nativeDecorate);
