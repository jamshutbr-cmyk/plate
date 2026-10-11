import {api} from '../api.js';
import {LAB} from '../config.js';
import {TG, haptic} from '../platform.js';
import {DRAW, go, painters, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {banner} from '../ui/modal.js';
import {titleHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Лаборатория тестировщиков (supabase/testers.sql): секретный раздел меню. Плитка видна только игроку с players.tester = true,
// а все данные отдаёт lab_state() и только тестировщику. Баг уходит через Edge Function report-bug.
let TAB='bug',ST=null,ERR=false,SENDING=false;
const DRAFT={cat:'gen',body:'',link:''};
const MEDAL=['🥇','🥈','🥉'];
const STT={new:'⏳ На проверке',accepted:'✅ Принят',rejected:'❌ Отклонён'};
const ERRS={limit:['Слишком много багов','До 5 на проверке и до 10 за сутки: дождитесь ответа'],bad:['Проверьте текст','Описание от 10 символов, ссылка должна начинаться с http'],not_tester:['Нет доступа','Раздел только для тестировщиков']};
const catName=k=>(LAB.cats.find(c=>c[0]==k)||[0,'Другое'])[1];
const rankName=n=>{const r=LAB.ranks.filter(x=>n>=x.at).pop();return r?r.n:''};
const word=n=>{const a=n%10,b=n%100;return b>10&&b<15?'багов':a==1?'баг':a>1&&a<5?'бага':'багов'};
async function load(){try{ST=await api.labState();ERR=false}catch(e){console.error(e);ERR=true}if($('v-lab').classList.contains('on'))drawLab()}
export function labOpen(){ST=null;ERR=false;TAB='bug';go('lab');load()}
const ST_C={new:'wait',accepted:'ok',rejected:'no'};
const ST_T={new:'На проверке',accepted:'Принят',rejected:'Отклонён'};
const CAT_I={gen:'🎰',shop:'🛒',market:'📈',ui:'📱',other:'💡'};
const empty=(i,t,d)=>`<div class="lb-empty"><div>${i}</div><b>${t}</b><span>${d}</span></div>`;
function tabBody(){
 if(TAB=='bug')return `<section class="lb-sec"><h3>Сообщить о баге</h3><p class="lb-sub">Выберите раздел и опишите, что пошло не так</p>
  <div class="lb-cats">${LAB.cats.map(([k,n])=>`<button class="${DRAFT.cat==k?'a':''}" data-click="labCat" data-arg="${k}"><i>${CAT_I[k]||'•'}</i><span>${n}</span></button>`).join('')}</div>
  <label class="lb-f"><span>Описание</span><textarea data-input="labIn" data-arg="body" maxlength="1500" placeholder="Что нажали, что ожидали, что получилось">${esc(DRAFT.body)}</textarea><em id="labCnt">${DRAFT.body.length} / 1500 · минимум 10</em></label>
  <label class="lb-f"><span>Скриншот или видео <u>необязательно</u></span><input type="url" data-input="labIn" data-arg="link" maxlength="300" placeholder="https://" value="${esc(DRAFT.link)}"></label>
  <button class="lb-go" id="labSend" data-click="labSend">Отправить баг</button></section>`;
 if(TAB=='mine')return ST.reports.length?ST.reports.map(r=>`<article class="lb-rep ${ST_C[r.status]||''}"><header><b>#${r.id}</b><span class="lb-pill ${ST_C[r.status]||''}">${ST_T[r.status]||r.status}</span></header><div class="lb-cat">${CAT_I[r.cat]||'•'} ${esc(catName(r.cat))}</div><p>${esc(r.body)}</p>${r.status=='accepted'?`<div class="lb-pay">+${fmt(r.rub)} ₽<i>+${r.usd} $</i></div>`:''}${r.note?`<div class="lb-note">${esc(r.note)}</div>`:''}</article>`).join(''):empty('📝','Пока пусто','Отправьте первый баг и получите награду');
 if(TAB=='hall')return `<section class="lb-sec"><h3>Зал славы</h3>${ST.hall.length?ST.hall.map((h,i)=>`<div class="lb-hr${h.me?' me':''}"><span class="rk">${MEDAL[i]||i+1}</span><div><b>${esc(h.nick||'Игрок')}</b><small>${esc(rankName(h.n))}</small></div><strong>${h.n}</strong></div>`).join(''):empty('🏆','Пока никого','Станьте первым в списке')}</section>`;
 return ST.flags.length?ST.flags.map(f=>`<section class="lb-sec"><h3>${esc(f.title)}</h3><p class="lb-sub">${esc(f.descr)}</p></section>`).join(''):empty('🚀','Пока ничего нового','Когда появится ранний доступ, он будет здесь')}
export function drawLab(){
 const el=$('labC');
 if(!ST){el.innerHTML=`<div class="lb-empty"><div>${ERR?'⚠️':'⏳'}</div><b>${ERR?'Не удалось загрузить':'Загрузка'}</b><span>${ERR?'Закройте раздел и откройте снова':'Секунду…'}</span></div>`;return}
 if(!ST.tester){el.innerHTML=empty('🔒','Только для тестировщиков','');return}
 const n=ST.bugs,r=ST.rank,cur=r?LAB.ranks[r-1]:null,nx=LAB.ranks[r]||null,from=cur?cur.at:0,bn=nx&&LAB.bonus[r],
  pct=nx?Math.max(3,Math.round((n-from)/(nx.at-from)*100)):100,
  steps=LAB.ranks.map((x,i)=>`<div class="${r>i+1?'d':r==i+1?'c':''}"><i>${r>=i+1?'✓':i+1}</i><span>${esc(x.n)}</span></div>`).join(''),
  pk=[...LAB.titles.filter(t=>S.owned.includes(t.id)).map(t=>['title',t.id,titleHTML(t.id)]),...(S.owned.includes(LAB.skin.id)?[['skin',LAB.skin.id,`<span class="ttl" style="--tc:#00ff7a">Рамка «${LAB.skin.n}»</span>`]]:[])]
   .map(([s,id,h])=>{const on=S.equip[s]==id;return `<div class="lb-gear"><div>${h}</div><button class="${on?'on':''}" data-click="labWear" data-arg="${s}:${id}">${on?'Надето':'Надеть'}</button></div>`}).join('');
 el.innerHTML=`<section class="lb-hero"><div class="lb-top"><div class="lb-badge">🧪</div><div><small>Ваш ранг</small><h2>${cur?esc(cur.n):'Без ранга'}</h2></div><div class="lb-cnt"><strong>${n}</strong><small>${word(n)} принято</small></div></div>
  <div class="lb-bar"><i style="width:${pct}%"></i></div>
  <div class="lb-nx">${nx?`До «${esc(nx.n)}» ещё <b>${nx.at-n} ${word(nx.at-n)}</b>${bn&&bn.rub?` · награда <b>${fmt(bn.rub)} ₽ + ${bn.usd} $</b>`:''}`:'Вы достигли высшего ранга'}</div>
  <div class="lb-steps">${steps}</div></section>
  ${pk?`<section class="lb-sec"><h3>Ваши отличия</h3>${pk}</section>`:''}
  ${ST.chat?`<button class="lb-chat" data-click="labChat"><i>💬</i><span><b>Закрытый чат тестировщиков</b><small>Обсуждения и ранние новости</small></span><em>›</em></button>`:''}
  <nav class="lb-tabs">${[['bug','Баг'],['mine','Мои'],['hall','Зал славы'],['new','Новое']].map(([k,t])=>`<button class="${TAB==k?'a':''}" data-click="labTab" data-arg="${k}">${t}</button>`).join('')}</nav>`+tabBody()}
async function labSend(){
 if(SENDING)return;const body=DRAFT.body.trim(),link=DRAFT.link.trim();
 if(body.length<10){banner('Слишком коротко','Опишите баг хотя бы в паре предложений');return}
 if(link&&!/^https?:\/\//i.test(link)){banner('Ссылка не подходит','Она должна начинаться с http');return}
 SENDING=true;$('labSend').disabled=true;
 let r;try{r=await api.reportBug(DRAFT.cat,body,link)}catch(e){console.error(e);r={err:'server'}}
 SENDING=false;
 if(r&&r.err){const m=ERRS[r.err]||['Не получилось','Попробуйте ещё раз'];banner(m[0],m[1]);drawLab();return}
 DRAFT.body='';DRAFT.link='';TAB='mine';haptic('success');banner('Баг отправлен','Спасибо! Мы проверим и ответим');await load();drawLab()}
function labChat(){
 const u=ST&&ST.chat;if(!u||!/^https:\/\//i.test(u))return;
 try{if(TG&&/^https:\/\/t\.me\//i.test(u)&&TG.openTelegramLink)TG.openTelegramLink(u);else if(TG&&TG.openLink)TG.openLink(u);else window.open(u,'_blank')}catch(e){window.open(u,'_blank')}}
painters.push(()=>{const d=S.tester?'':'none';for(const id of ['labH','labTile']){const e=$(id);if(e)e.style.display=d}});
DRAW.lab=drawLab;
on({labOpen,labChat,labSend,
 labTab:a=>{TAB=a;if(a=='mine'||a=='hall'||a=='new')load();drawLab()},
 labCat:a=>{DRAFT.cat=a;drawLab()},
 labIn:(a,el)=>{DRAFT[a]=el.value;if(a=='body'){const c=$('labCnt');if(c)c.textContent=DRAFT.body.length+' / 1500 · минимум 10'}},
 labWear:async a=>{const [s,id]=String(a).split(':');try{await api.equipItem(s,S.equip[s]==id?'':id)}catch(e){console.error(e)}render(true)}});
