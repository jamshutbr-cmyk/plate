import {api} from '../api.js';
import {CAR_CLS, FXE, MEDIA, RAR, convOut, platePrice} from '../config.js';
import {caseOdds} from '../data/cars.js';
import {haptic} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S} from '../state.js';
import {on} from '../ui/actions.js';
import {plateHTML} from '../ui/plate.js';
import {banner, cm, sm} from '../ui/modal.js';
import {$, esc, fmt} from '../util.js';

// Экран «Медиа» (media.sql): профиль, ролики, магазин, обмен МК, правила. МК, курс, лимиты и цены считает ТОЛЬКО сервер.
// Баланс МК виден только участникам программы (есть аккаунт). Состояния: загрузка, нет связи, пусто, бан.
let MS=null,TAB='pf',LOAD=false,ERR=false,BUSY=false,PF='tiktok',AURL='',PURL='',TO='rub',AMT='',SER='',DIG='',REG='77',FILE=null,CLAIM=null,CVIEWS='';
const TABS=[['pf','Профиль'],['po','Ролики'],['sh','Магазин'],['ex','Обмен'],['ru','Правила']];
const ERRS={platform:'Выберите платформу',url:'Ссылка не подходит: нужен адрес профиля или ролика без лишних параметров',limit4:'Не больше 4 аккаунтов',have:'На этой платформе у вас уже есть аккаунт',taken:'Этот аккаунт уже привязан к другому игроку',
 account:'Нужен подтверждённый аккаунт этой платформы (для TikTok имя в ссылке должно совпасть)',dup:'Этот ролик уже подан',limit_day:'Не больше 1 ролика в сутки',limit_week:'Не больше 3 роликов в неделю',young:'Подавать ролики можно через 7 дней после регистрации',
 post:'Ролик не найден',status:'Ролик ещё не одобрен',views:'Укажите число больше уже подтверждённого и не меньше 1 000',proof:'Нужен скриншот',limit:'Достигнут лимит',coins:'Не хватает МК',level:'Недоступно на вашем уровне',stock:'Закончилось',debt:'Есть долг по МК: он блокирует покупки и обмен',
 owned:'Уже куплено',item:'Предмет не найден',min:'Меньше минимальной суммы обмена',to:'Выберите ₽ или $',series:'Выберите серию',digits:'Три цифры, не 000',reg:'Неизвестный регион',soldout:'Серия распродана',off:'Программа приостановлена',banned:'Недоступно',text:'Нужен текст до 40 знаков'};
const ST={pending:'на проверке',approved:'одобрен',needs_fix:'нужна доработка',rejected:'отклонён',removed:'снят',verified:'подтверждён',revoked:'отозван'};
const KIND={post:'Ролик',views:'Просмотры',ref:'Приведённый игрок',contest:'Конкурс',shop:'Покупка',plate:'Номер',conv:'Обмен',revoke:'Отзыв'};
const dt=ms=>ms?new Date(ms).toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
const pf=k=>(MEDIA.platforms.find(x=>x[0]==k)||[k,k])[1];
const lvName=n=>n?MEDIA.levels[n-1].t:'—';
const fail=r=>{banner('Не получилось',ERRS[r.err]||'Попробуйте ещё раз');haptic('rigid')};

async function load(){LOAD=true;ERR=false;try{MS=await api.mediaState()}catch(e){console.error(e);ERR=true}finally{LOAD=false}}
const tabs=()=>`<div class="chips">${TABS.map(([k,n])=>`<button class="${TAB==k?'a':''}" data-click="mdTab" data-arg="${k}">${n}</button>`).join('')}</div>`;
const bar=(v,m)=>`<div class="md-bar"><i style="width:${Math.min(100,m?v/m*100:0)}%"></i></div>`;
const plats=()=>`<div class="chips">${MEDIA.platforms.map(([k,n])=>`<button class="${PF==k?'a':''}" data-click="mdPf" data-arg="${k}">${n}</button>`).join('')}</div>`;

function accounts(){
  const list=MS.accounts.map(a=>`<div class="md-row"><div><b>${pf(a.platform)} · ${esc(a.handle)}</b><small>${ST[a.status]||a.status}${a.note&&a.status=='rejected'?' (п. '+esc(a.note)+')':''}</small></div>${a.status=='pending'||a.status=='needs_fix'?`<div class="md-code">Код для описания профиля или закреплённого комментария на 24 часа: <b>${esc(a.code)}</b></div>`:''}</div>`).join('');
  return `<div class="md-card"><h3>Аккаунты</h3>${list||'<div class="tl">Подключите аккаунт платформы, чтобы участвовать.</div>'}
   ${MS.accounts.filter(a=>['pending','verified','needs_fix'].includes(a.status)).length<MEDIA.limits.accounts?`${plats()}<input class="gq" placeholder="Ссылка на профиль" maxlength="200" value="${esc(AURL)}" data-input="mdA"><button class="btn md-y" data-click="mdAdd">Подключить</button>`:''}</div>`}
function profile(){
  const n=MS.next,l=MS.level;
  return `<div class="md-card md-main">${MS.part?`<div class="md-coins"><small>Медиа-койны</small><b>${fmt(MS.coins)} МК</b></div>`:''}
   <div class="md-nums"><div><b>${lvName(l)}</b><small>уровень</small></div><div><b>×${String(MS.mult).replace('.',',')}</b><small>множитель</small></div><div><b>${MS.approved}</b><small>роликов</small></div></div>
   ${MS.debt>0?`<div class="md-note r">Долг по отозванным МК: ${fmt(MS.debt)}. Новые начисления сначала гасят его; покупки и обмен недоступны.</div>`:''}
   ${n?`<small>До уровня «${esc(n.title)}»: роликов ${Math.min(MS.approved,n.posts)} из ${n.posts}${n.views?`, просмотров ${fmt(Math.min(MS.views,n.views))} из ${fmt(n.views)}`:''}</small>${bar(MS.approved,n.posts)}${n.views?bar(MS.views,n.views):''}`:'<small>Максимальный уровень</small>'}
   <small>В этом месяце начислено ${fmt(MS.month.earned)} из ${fmt(MS.month.cap)} МК</small>${bar(MS.month.earned,MS.month.cap)}
   ${!MS.pool_open?'<div class="md-note">Месячный пул проекта исчерпан: выплаты заморожены до нового месяца или пополнения.</div>':''}</div>`+accounts()+named()}
const named=()=>MS.level>=3?`<div class="md-card"><h3>Именной номер</h3>${MS.named?`<div class="tl">Заявка: ${esc(MS.named.body)} — ${ST[MS.named.status]||MS.named.status}</div>`:`<div class="tl">Раз за сезон. Заявку проверяет админ.</div><input class="gq" maxlength="40" placeholder="Текст номера" data-input="mdN"><button class="btn md-y" data-click="mdNamed">Отправить заявку</button>`}</div>`:'';
function posts(){
  const verified=MS.accounts.some(a=>a.status=='verified');
  const form=!verified?'<div class="tl">Сначала подтвердите аккаунт во вкладке «Профиль».</div>':MS.young?'<div class="tl">Подавать ролики можно через 7 дней после регистрации.</div>':`<input class="gq" placeholder="Ссылка на ролик" maxlength="300" value="${esc(PURL)}" data-input="mdP"><button class="btn md-y" data-click="mdPost">Подать на проверку</button><small class="tl">1 ролик в сутки, 3 в неделю. Проверка до 48 часов.</small>`;
  const list=MS.posts.map(p=>`<div class="md-row"><div><b>${esc(p.url.replace('https://',''))}</b><small>${ST[p.status]||p.status}${p.point?' (п. '+esc(p.point)+')':''}${p.status=='approved'?' · просмотров '+fmt(p.views):''}</small></div>
    ${p.status=='approved'?`<div class="md-acts"><button class="btn" ${p.claim=='pending'||(p.claim_at&&Date.now()-p.claim_at<7*864e5)?'disabled':''} data-click="mdClaim" data-arg="${p.id}">Заявить просмотры</button><button class="btn ${p.contest?'md-y':''}" data-click="mdContest" data-arg="${p.id}">${p.contest?'В конкурсе':'В конкурс'}</button></div>`:''}</div>`).join('');
  return `<div class="md-card"><h3>Подать ролик</h3>${form}</div><div class="md-card"><h3>Мои ролики</h3>${list||'<div class="tl" style="text-align:center">Пока пусто</div>'}</div>`}
// ---------- Магазин ----------
// Превью рисуются теми же стилями, что и в игре (рамка на номере, титул, фон-сцена, частицы, машины), чтобы игрок видел, что покупает.
const SAMPLE={type:'civil',main:'А777АА',reg:'77',country:'RU',cls:1};
const COIN='<svg class="md-coin" viewBox="0 0 24 24" aria-hidden="true"><defs><linearGradient id="mdcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe27a"/><stop offset="1" stop-color="#e09a14"/></linearGradient></defs><circle cx="12" cy="12" r="10.5" fill="url(#mdcg)" stroke="#8a5d0a" stroke-width="1.2"/><circle cx="12" cy="12" r="7.6" fill="none" stroke="#8a5d0a" stroke-opacity=".45"/><path d="M10 8.2v7.6l6.2-3.8z" fill="#3a2605"/></svg>';
const CLOVER='<svg class="md-clv" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mdlg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dffa8"/><stop offset="1" stop-color="#19a35a"/></linearGradient></defs><g fill="url(#mdlg)" stroke="#0b5a30" stroke-width="1.6"><circle cx="22" cy="22" r="10"/><circle cx="42" cy="22" r="10"/><circle cx="22" cy="40" r="10"/><circle cx="42" cy="40" r="10"/></g><path d="M32 34 C32 46 36 54 44 60" fill="none" stroke="#19a35a" stroke-width="3.5" stroke-linecap="round"/></svg>';
// Веса классов кейса «Медиа» из media.sql (строка med_case, res.w); caseOdds пересчитывает их до 100% по классам, где есть машины
const CASE_W=[0,15,45,32,8];
const pct=x=>(Math.round(x*10)/10).toString().replace('.',',');
// Подписи и образцы предметов магазина; id — как в media_shop (media.sql). Неизвестный предмет рисуется без образца.
const IT={
 med_frame:{k:'Рамка',pv:'frame',sk:'med_f_air',d:'Графитовая рамка с красной точкой записи вокруг вашего номера'},
 med_title:{k:'Титул',pv:'title',tt:'med_t_media',d:'Подпись рядом с ником в профиле и рейтинге'},
 med_drop:{k:'Эффект',pv:'drop',fx:'med_d_rec',d:'Красные и жёлтые частицы при выпадении номера'},
 med_bg:{k:'Фон',pv:'bg',d:'Тёмная студия с софитом на главном экране'},
 med_luck:{k:'Бонус',pv:'luck',wide:1,d:'Дополнительные прокруты удачи для генератора номеров'}};
// Статичный «залп» частиц эффекта; живой показывает нажатие (fxTest из shop.js)
function fxDots(id){
  const E=FXE[id];if(!E)return '';
  let h='';
  for(let n=0;n<18;n++){
    const g=n/18*6.283+Math.sin(n*7.1)*.25,r=(14+((n*37)%24))*(E.rad?Math.min(1.5,E.rad+.35):1),sz=E.big?15+(n%3)*3:E.star?11+(n%2)*3:5+(n%3)*2;
    const dy=Math.sin(g)*r*.62,y=E.dir=='up'?-Math.abs(dy)-6:E.dir=='down'?Math.abs(dy)+6:dy;
    h+=`<i class="${E.star?'st':''}${E.sq?' sq':''}" style="left:calc(50% + ${(Math.cos(g)*r*1.7).toFixed(1)}px);top:calc(50% + ${y.toFixed(1)}px);background:${E.pal[n%E.pal.length]};width:${sz}px;height:${sz}px;animation-delay:${(n%6)*.18}s"></i>`}
  return h}
const car=(id,x,r,z)=>`<img class="md-car" src="img/cars/${id}.webp" alt="" style="--x:${x}px;--r:${r}deg;z-index:${z}">`;
function preview(i,m){
  if(m.pv=='frame')return ['frm',plateHTML(SAMPLE,'',m.sk),''];
  if(m.pv=='title'){const t=MEDIA.items.find(x=>x.id==m.tt)||{n:'Медиа',c:'#e5484d'};return ['tt',`<b>${esc(S.nick||'Ваш ник')}</b><span class="ttl ${m.tt}" style="--tc:${t.c}">${esc(t.n)}</span>`,'']}
  if(m.pv=='drop')return ['fxd',`${fxDots(m.fx)}<span class="md-play">▶ Показать</span>`,`data-click="fxTest" data-arg="${m.fx}" role="button" aria-label="Показать эффект"`];
  if(m.pv=='bg')return ['bgv scn-med_b_studio',`<div class="md-mini">${plateHTML(SAMPLE,'','')}</div>`,''];
  if(m.pv=='case')return ['case',car('granta',-34,-14,1)+car('m5',34,14,1)+car('huracan',0,0,2),''];
  if(m.pv=='luck')return ['luck',`${CLOVER}<b class="md-x">${esc((i.name.match(/×\s*\d+/)||['×10'])[0])}</b>`,''];
  return ['','<span class="md-gift">🎁</span>',''];
}
function itemCard(i){
  const m=IT[i.id]||{k:'Предмет',pv:''};
  const left=i.per_month?i.per_month-i.bought:null,short=MS.coins<i.price;
  let st='ok',lbl='Купить';
  if(i.owned){st='own';lbl='✓ Куплено'}
  else if(MS.level<i.min_level){st='lock';lbl='С уровня «'+lvName(i.min_level)+'»'}
  else if(left===0){st='out';lbl='Лимит на месяц исчерпан'}
  else if(i.stock!=null&&i.stock<=0){st='out';lbl='Закончилось'}
  else if(MS.debt>0){st='out';lbl='Есть долг по МК'}
  else if(short){st='short';lbl='Ещё '+fmt(i.price-MS.coins)+' МК'}
  const [pc,pin,pat]=preview(i,m);
  const badge=st=='own'?'<span class="md-bdg g">✓</span>':st=='lock'?'<span class="md-bdg">🔒</span>':'';
  const pips=left!=null?`<div class="md-lim"><span class="md-pips">${Array.from({length:i.per_month},(_,n)=>`<i class="${n<i.bought?'on':''}"></i>`).join('')}</span><em>осталось ${left} из ${i.per_month}</em></div>`:'';
  let extra='';
  if(m.pv=='case'){const od=caseOdds(CASE_W);extra=`<div class="md-odds">${od.map((x,r)=>x?`<i style="flex:${x};background:${RAR[r].c}"></i>`:'').join('')}</div><div class="md-oddl">${od.map((x,r)=>x?`<span><i style="background:${RAR[r].c}"></i>${CAR_CLS[r]} ${pct(x)}%</span>`:'').join('')}</div>`}
  return `<div class="md-it ${st}${m.wide?' wide':''}"><div class="md-pv ${pc}" ${pat}>${pin}<span class="md-tag">${m.k}</span>${badge}</div>
   <div class="md-col"><div class="md-in"><b>${esc(i.name)}</b><small>${m.d||''}</small>${extra}${pips}${i.stock!=null?`<em class="md-stk">в наличии ${i.stock}</em>`:''}</div>
   <div class="md-buy"><span class="md-price">${COIN}<b>${fmt(i.price)}</b><em>МК</em></span><button class="btn ${st=='ok'?'md-y':''}" ${st=='ok'?'':'disabled'} data-click="mdBuy" data-arg="${i.id}">${lbl}</button></div></div></div>`}
// Конструктор номера серии «Медиа»: живое превью номера, цена и кнопка пересчитываются при вводе без перерисовки полей
function serState(){
  const sr=MS.series,r=SER||(sr[0]&&sr[0].series)||'',cur=sr.find(x=>x.series==r)||{cap:0,issued:0},left=cur.cap-cur.issued;
  const ok=DIG.length==3&&DIG!='000',pr=ok?platePrice(DIG,REG):0,sn=r||'КЕК';
  const reason=MS.debt>0?'Есть долг по МК':!r?'Выберите серию':left<=0?'Серия распродана':!ok?'Введите три цифры':!REG?'Укажите регион':MS.coins<pr?'Ещё '+fmt(pr-MS.coins)+' МК':'';
  return {
    stage:`${plateHTML({type:'media',main:sn.slice(0,1)+(ok?DIG:'777')+sn.slice(1,3),reg:REG||'77',country:'RU',cls:4},'','')}<small>${ok?'Так будет выглядеть ваш номер':'Пример: введите три цифры ниже'}</small>`,
    total:ok?`${COIN}<b>${fmt(pr)}</b><em>МК</em>${MEDIA.plate.popRegs.includes(REG)?'<span class="md-pop">популярный регион +20%</span>':''}`:'<span class="md-dash">— МК</span>',
    btn:`<button class="btn md-y" ${reason?'disabled':''} data-click="mdPlate" data-arg="${r}">${reason||'Купить номер'}</button>`}}
function serUpd(){const v=serState(),a=$('mdStage'),b=$('mdTot'),c=$('mdBtn');if(a)a.innerHTML=v.stage;if(b)b.innerHTML=v.total;if(c)c.innerHTML=v.btn}
function plateBuilder(){
  const P=MEDIA.plate,tiers=`<div class="md-tiers"><span>обычные <b>${fmt(P.base)}</b></span><span>ровные <b>${fmt(P.round)}</b></span><span>777 · 001 · 999 <b>${fmt(P.top)}</b></span></div>`;
  if(MS.level<2)return `<div class="md-card md-ser"><h3>Номера серии «Медиа»</h3><div class="md-stage ghost">${plateHTML({type:'media',main:'К777ЕК',reg:'77',country:'RU',cls:4},'','')}<small>Пример номера серии</small><span class="md-lockb">🔒 Доступ с уровня «${lvName(2)}»</span></div>${tiers}</div>`;
  const sr=MS.series,r=SER||(sr[0]&&sr[0].series)||'',v=serState();
  return `<div class="md-card md-ser"><h3>Номера серии «Медиа»</h3>
   <div class="md-stage" id="mdStage">${v.stage}</div>
   <div class="md-lbl">Серия</div><div class="md-sers">${sr.map(s=>{const l=s.cap-s.issued;return `<button class="md-sc${r==s.series?' a':''}${l<=0?' off':''}" style="--left:${s.cap>0?Math.max(0,Math.min(100,l/s.cap*100)).toFixed(0):0}%" ${l<=0?'disabled':''} data-click="mdSer" data-arg="${s.series}"><b>${s.series}</b><small>${l>0?'осталось '+l:'распродана'}</small></button>`}).join('')}</div>
   <div class="md-row2"><label class="md-f"><span>Три цифры</span><input class="gq" inputmode="numeric" maxlength="3" placeholder="777" value="${esc(DIG)}" data-input="mdD"></label><label class="md-f"><span>Регион</span><input class="gq" inputmode="numeric" maxlength="3" placeholder="77" value="${esc(REG)}" data-input="mdR"></label></div>
   <div class="md-lbl">Быстрый выбор</div><div class="chips">${['777','001','999','888','111'].map(d=>`<button class="${DIG==d?'a':''}" data-click="mdDq" data-arg="${d}">${d} <small>${fmt(platePrice(d,REG))}</small></button>`).join('')}</div>
   ${tiers}
   <div class="md-total"><span>Цена</span><div class="md-price big" id="mdTot">${v.total}</div></div><div id="mdBtn">${v.btn}</div></div>`}
function shop(){
  const cos=MS.shop.filter(i=>!(IT[i.id]||{}).wide),bon=MS.shop.filter(i=>(IT[i.id]||{}).wide);
  return `<div class="md-wal"><span class="md-wal-ic">${COIN}</span><div><small>Ваш баланс</small><b>${fmt(MS.coins)} <em>МК</em></b></div><span class="md-wal-lv">${esc(lvName(MS.level))} · ×${String(MS.mult).replace('.',',')}</span></div>
   ${MS.debt>0?'<div class="md-note r">Есть долг по МК: покупки недоступны, пока он не погашен.</div>':''}
   <div class="md-h">Оформление</div><div class="md-grid">${cos.map(itemCard).join('')}</div>
   ${bon.length?`<div class="md-h">Кейсы и бонусы</div><div class="md-grid one">${bon.map(itemCard).join('')}</div>`:''}
   <div class="md-h">Номера</div>${plateBuilder()}`}
function exchange(){
  const R=MS.rates,n=Math.floor(+AMT)||0,out=n?convOut(n,TO=='rub'?R.rub:R.usd,R.fee):0,left=R.limit-R.used;
  return `<div class="md-card"><h3>Обмен МК</h3><div class="tl">Курс: 1 МК = ${String(R.rub).replace('.',',')} ₽ или ${R.usd} $, комиссия ${R.fee}%. Лимит в месяц: ${fmt(R.limit)} МК на оба направления, осталось ${fmt(left)}. Обратного обмена нет.</div>
   ${R.pending?`<div class="md-note">С ${dt(R.pending_at)} курс изменится: ${R.pending.rub_per_mc} ₽ за МК, комиссия ${R.pending.fee_pct}%.</div>`:''}
   <div class="chips"><button class="${TO=='rub'?'a':''}" data-click="mdTo" data-arg="rub">В рубли</button><button class="${TO=='usd'?'a':''}" data-click="mdTo" data-arg="usd">В доллары</button></div>
   <input class="gq" inputmode="numeric" placeholder="Сколько МК (от ${R.min})" maxlength="9" value="${esc(AMT)}" data-input="mdAmt"><div class="tl" id="mdPrev">${n?`Получите ${fmt(out)} ${TO=='rub'?'₽':'$'}`+(out<1?' — слишком мало':''):''}</div>
   <button class="btn md-y" data-click="mdConv">Обменять</button><div class="tl">Выгоднее тратить МК в магазине: предметы там дешевле, чем за рубли.</div></div>`}
const rules=()=>`<div class="md-card"><h3>Правила программы</h3><div class="tl">Ролик: геймплей Mini App не менее 5 секунд, название «Генератор номеров», в описании ваш реф-код, длительность от 15 секунд, опубликован минимум ${MEDIA.keepDays} дней. Награды идут с удержанием: за ролик 7 дней, за просмотры 3 дня. Накрутка, чужой контент, подмена скриншотов, продажа МК и аккаунтов запрещены (раздел 19 правил): награды аннулируются, уровень снимается.</div>
  <div class="tl">За одобрение ${MEDIA.rewardPost} МК, за приведённого игрока ${MEDIA.rewardRef} МК. Просмотры: ${MEDIA.tiers.map(t=>fmt(t[0])+' → '+fmt(t[1])).join(', ')}. Пороги от ${fmt(MEDIA.seniorViews)} подтверждает старший модератор. Апелляция: 7 дней на обращение, ответ в течение 3 дней.</div></div>`;

function draw(){
  const c=$('mediaC');if(!c)return;
  if(ERR&&!MS){c.innerHTML=`<div class="md-card" style="text-align:center"><b>Нет связи</b><div class="tl">Не удалось загрузить экран</div><button class="btn" data-click="mdRetry">Повторить</button></div>`;return}
  if(!MS){c.innerHTML='<div class="md-card md-sk"></div><div class="md-card md-sk"></div>';return}
  if(MS.banned){c.innerHTML='<div class="md-card" style="text-align:center"><b>Экран закрыт</b></div>';return}
  if(!MS.on){c.innerHTML='<div class="md-card" style="text-align:center"><b>Программа приостановлена</b></div>';return}
  const body=TAB=='po'?posts():TAB=='sh'?shop():TAB=='ex'?exchange():TAB=='ru'?rules():profile();
  c.innerHTML=tabs()+(TAB!='ru'&&!MS.part&&TAB!='pf'?'<div class="md-card"><div class="tl">Раздел откроется после подключения аккаунта.</div></div>':body)}
function drawMedia(){draw();if(!MS&&!LOAD)load().then(draw)}
async function act(f){if(BUSY)return;BUSY=true;try{await f();await load();draw();render(true)}catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие')}finally{BUSY=false}}

on({mdTab:a=>{TAB=a;draw()},mdPf:a=>{PF=a;draw()},mdA:(a,el)=>{AURL=el.value},mdP:(a,el)=>{PURL=el.value},mdN:(a,el)=>{el.dataset.v=el.value},
 mdAdd:()=>act(async()=>{const r=await api.mediaAccountAdd(PF,AURL.trim());if(r.err)fail(r);else{AURL='';banner('Заявка отправлена','Вставьте код '+r.code+' в описание профиля')}}),
 mdPost:()=>act(async()=>{const r=await api.mediaPostAdd(PURL.trim());if(r.err)fail(r);else{PURL='';banner('Ролик отправлен','Проверка до 48 часов')}}),
 mdContest:a=>act(async()=>{const p=MS.posts.find(x=>x.id==a);await api.mediaPostContest(+a,!(p&&p.contest))}),
 mdClaim:a=>{CLAIM=+a;FILE=null;CVIEWS='';sm(`<div class="bd"><h2>Заявить просмотры</h2><div class="tl">Приложите скриншот, где видны ссылка, дата и публичный счётчик. Подача не чаще раза в 7 дней на ролик.</div><input class="gq" inputmode="numeric" placeholder="Число просмотров" maxlength="9" data-input="mdV"><input type="file" accept="image/jpeg,image/png,image/webp" data-change="mdFile" style="margin:10px 0"><div class="md-acts"><button class="btn" data-click="cm">Отмена</button><button class="btn md-y" data-click="mdSend">Отправить</button></div></div>`)},
 mdV:(a,el)=>{CVIEWS=el.value.replace(/\D/g,'');el.value=CVIEWS},mdFile:(a,el)=>{FILE=el.files&&el.files[0]||null},
 mdSend:async()=>{if(BUSY)return;if(!FILE||!CVIEWS){banner('Не хватает данных','Укажите число и приложите скриншот');return}
  if(FILE.size>3*1024*1024){banner('Файл большой','До 3 МБ');return}
  BUSY=true;try{const up=await api.mediaProof(FILE);if(up.err||!up.path){banner('Не загрузилось','Попробуйте другой файл');return}
   const r=await api.mediaViewsClaim(CLAIM,+CVIEWS,up.path);if(r.err){fail(r);return}cm();banner('Заявка отправлена','Проверка до 72 часов');await load();draw()}catch(e){console.error(e);banner('Нет связи с сервером','Повторите действие')}finally{BUSY=false}},
 mdBuy:a=>act(async()=>{const r=await api.mediaShopBuy(a);if(r.err)fail(r);else{haptic('success');banner('Куплено',r.res&&r.res.car_id?'Выпала машина':'Готово')}}),
 mdSer:a=>{SER=a;draw()},mdD:(a,el)=>{DIG=el.value.replace(/\D/g,'');el.value=DIG;serUpd()},mdR:(a,el)=>{REG=el.value.replace(/\D/g,'');el.value=REG;serUpd()},mdDq:a=>{DIG=a;draw()},
 mdPlate:a=>act(async()=>{const r=await api.mediaPlateBuy(a,DIG,REG);if(r.err)fail(r);else{haptic('success');banner('Номер получен',r.plate.main+' '+r.plate.reg)}}),
 mdTo:a=>{TO=a;draw()},mdAmt:(a,el)=>{AMT=el.value.replace(/\D/g,'');el.value=AMT;const R=MS.rates,n=+AMT||0,out=n?convOut(n,TO=='rub'?R.rub:R.usd,R.fee):0,p=$('mdPrev');if(p)p.textContent=n?`Получите ${fmt(out)} ${TO=='rub'?'₽':'$'}`+(out<1?' — слишком мало':''):''},
 mdConv:()=>act(async()=>{const r=await api.mediaConvert(TO,+AMT);if(r.err)fail(r);else{AMT='';haptic('success');banner('Обмен выполнен','+'+fmt(r.out)+(TO=='rub'?' ₽':' $'))}}),
 mdNamed:()=>act(async()=>{const el=document.querySelector('[data-input=mdN]'),r=await api.namedRequest('media',el?el.value:'','');if(r.err)fail(r);else banner('Заявка отправлена','Её проверит админ')}),
 mdRetry:async()=>{ERR=false;MS=null;draw();await load();draw()}});
DRAW.media=drawMedia;
