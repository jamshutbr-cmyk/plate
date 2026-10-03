import {api} from '../api.js';
import {ACT, AL, CCO, CST, SCO, SST} from '../config.js';
import {DRAW, go, render} from '../router.js';
import {S} from '../state.js';
import {banner} from '../ui/modal.js';
import {on} from '../ui/actions.js';
import {$, fmt} from '../util.js';

// Улучшения и автопродажа.
export async function buyAuto(){const r=await api.buyAutosell();if(r.err)banner('Не хватает $','Нужно '+r.need+' $');else render()}
export async function buy(k){const r=await api.buyCapacity(k);if(r.err)banner('Не хватает денег','Нужно '+fmt(r.need)+(k=='c'?' ₽':' $'));else render()}
export function drawUp(){
 const ci=CST.indexOf(S.capC)+1,si=SST.indexOf(S.capS)+1;
 const blk=(t,n,cap,txt,b)=>`<div class="card"><h3>${t}<span class="tl">${n} / ${cap}</span></h3><div class="pb"><i style="width:${Math.min(100,n/cap*100)}%"></i></div><p>${txt}</p>${b}</div>`;
 $('upC').innerHTML=blk('Коллекция',S.col.length,S.capC,'Здесь хранятся выпавшие номера. Когда место кончится, прокрутить не получится, пока не продашь что-нибудь.',ci>=CST.length?'<button class="big2" disabled>Максимум</button>':`<button class="big2" data-click="buy" data-arg="c">Расширить до ${CST[ci]} · ${fmt(CCO[ci-1])} ₽</button>`)
 +blk('Сейф',S.safe.length,S.capS,'Номера в сейфе нельзя продать ни случайно, ни автопродажей.',si>=SST.length?'<button class="big2" disabled>Максимум</button>':`<button class="big2" data-click="buy" data-arg="s">Расширить до ${SST[si]} · ${SCO[si-1]} $</button>`)
 +`<div class="card" style="cursor:pointer" data-click="go" data-arg="auto"><h3>Автопродажа<span>›</span></h3><span class="tl">${S.as.lvl?'Уровень '+S.as.lvl+' / 9':'Не приобретено'}</span></div>`}
export function drawAuto(){const A=S.as,L=A.lvl,n=AL[L];
 $('autoC').innerHTML=`<div class="card"><h3>Автопродажа</h3><p style="margin-bottom:0">Автоматически продаёт подходящие под фильтры номера из коллекции за 50% цены. Номера в сейфе защищены от автоматической продажи.</p></div><div class="card"><div class="tl" style="margin-bottom:8px">Уровни</div>${AL.map((a,i)=>{const k=ACT[i];if(i>=L)return `<div class="lv">${i+1}. ${a[0]} · ${a[1]} $</div>`;const v=A[k],lab=k=='ceil'?(v?'≤ '+fmt(v)+' ₽':'Нет'):(v?'Вкл':'Выкл');return `<div class="lv on"><span>${i+1}. ${a[0]}</span><button class="tg ${v?'':'off'}" data-click="atg" data-arg="${k}">${lab}</button></div>`}).join('')}${n?`<button class="big2" style="margin-top:14px" data-click="buyAuto">${L?'Открыть: '+n[0]:'Открыть автопродажу'} · ${n[1]} $</button>`:''}</div>`}
export async function atg(k){await api.autoToggle(k);render()}
DRAW.up=drawUp;DRAW.auto=drawAuto;
on({buyAuto,buy,atg});
