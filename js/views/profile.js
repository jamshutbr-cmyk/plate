import {api} from '../api.js';
import {RAR} from '../config.js';
import {tgUser} from '../platform.js';
import {DRAW, render} from '../router.js';
import {S, all} from '../state.js';
import {on} from '../ui/actions.js';
import {cm, sm} from '../ui/modal.js';
import {plateHTML, titleHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Профиль игрока.
export function pName(){const u=tgUser();return S.nick||(u&&(u.first_name||u.username))||'Игрок'}
export function nickDlg(){sm(`<div class="dlg"><h3>Имя игрока</h3><input class="gq" id="nk" maxlength="20" value="${esc(S.nick)}" placeholder="${esc(pName())}" autocomplete="off"><button class="btn" data-click="saveNick">Сохранить</button><button class="btn" data-click="cm">Отмена</button></div>`)}
export async function saveNick(){const v=$('nk').value;cm();await api.setNick(v);render(true)}
export function drawProfile(){
 const u=tgUser(),nm=pName(),need=S.lvl*1250,al=all(),val=al.reduce((s,p)=>s+p.price,0),top=al.slice().sort((a,b)=>b.price-a.price)[0],
  days=Math.max(1,Math.ceil((Date.now()-(S.since||Date.now()))/864e5)),st=S.stats,mx=Math.max(1,...st.cls),
  av=u&&u.photo_url?`<img class="pav" src="${esc(u.photo_url)}" alt="">`:`<div class="pav">${esc([...nm][0].toUpperCase())}</div>`;
 $('profC').innerHTML=`<div class="card"><div class="phd">${av}<div><b class="pn">${esc(nm)}</b>${titleHTML(S.equip.title)}<span class="tl">Уровень ${S.lvl} · в игре ${days} дн.</span></div></div>
 <div class="sub" style="font-size:16px;gap:14px;align-items:center"><div class="pb" style="flex:1"><i style="width:${Math.min(100,S.xp/need*100)}%"></i></div><span>${fmt(S.xp)} / ${fmt(need)}</span></div>
 <button class="btn" style="width:100%;margin-top:14px" data-click="nickDlg">Сменить имя</button></div>
 <div class="st2"><div><b>${fmt(S.bal)} ₽</b><span>Баланс</span></div><div><b>${fmt(S.usd)} $</b><span>Доллары</span></div><div><b>${fmt(st.n)}</b><span>Выпало номеров</span></div><div><b>${fmt(st.best)} ₽</b><span>Рекорд цены</span></div></div>
 <div class="card"><h3>Хранилище</h3><div class="fr"><span>Коллекция</span><b>${S.col.length} / ${S.capC}</b></div><div class="fr"><span>Сейф</span><b>${S.safe.length} / ${S.capS}</b></div><div class="fr"><span>Общая стоимость</span><b>${fmt(val)} ₽</b></div></div>
 ${top?`<div class="card"><h3>Самый дорогой сейчас<span class="tl">${fmt(top.price)} ₽</span></h3><div class="tp">${plateHTML(top)}</div></div>`:''}
 <div class="card"><h3>Редкости</h3><div class="bars" style="margin:6px 0 0">${RAR.map((R,i)=>`<span>${R.n}</span><div class="pb" style="background:${R.c}33"><i style="width:${st.cls[i]/mx*100}%;background:${R.c}"></i></div><span class="tl" style="text-align:right">${st.cls[i]}</span>`).join('')}</div></div>`}
DRAW.profile=drawProfile;
on({nickDlg,saveNick});
