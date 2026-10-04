import {SHOWCASE_MAX} from '../config.js';
import {haptic} from '../platform.js';
import {go, render} from '../router.js';
import {rpc} from '../server.js';
import {S, all, find} from '../state.js';
import {on} from '../ui/actions.js';
import {banner, cm, sm} from '../ui/modal.js';
import {plateHTML} from '../ui/plate.js';
import {$, esc, fmt} from '../util.js';

// Витрина: до 3 закреплённых номеров в профиле. Куплена в магазине (предмет showcase), выбор хранит сервер (set_showcase).
let SEL=[];
export const hasShowcase=()=>S.owned.includes('showcase');
const mine=()=>S.showcase.map(find).filter(Boolean);

// Карточка в своём профиле: либо витрина с кнопкой «Изменить», либо приглашение купить.
export function showcaseCard(){
  if(!hasShowcase())return `<div class="card"><h3>Витрина</h3><p style="margin:0 0 12px" class="tl">Закрепите в профиле до ${SHOWCASE_MAX} любимых номеров, чтобы их видели другие игроки.</p><button class="btn" style="width:100%" data-click="scShop">Открыть в магазине</button></div>`;
  const ps=mine(),cells=ps.map(p=>plateHTML(p)).join('')+Array.from({length:SHOWCASE_MAX-ps.length},()=>'<div class="scx">Пустое место</div>').join('');
  return `<div class="card"><h3>Витрина<span class="tl">${ps.length} / ${SHOWCASE_MAX}</span></h3><div class="scs">${cells}</div><button class="btn" style="width:100%;margin-top:12px" data-click="scEdit">Изменить</button></div>`}

// Витрина другого игрока (список номеров приходит из get_showcase), пусто = карточки нет.
export function pubShowcase(list,skin){
  if(!list||!list.length)return '';
  return `<div class="card"><h3>Витрина</h3><div class="scs">${list.map(p=>plateHTML(p,'',skin||'')).join('')}</div></div>`}

const row=p=>`<div class="gopt${SEL.includes(p.id)?' a':''}" data-click="scTog" data-arg="${p.id}"><div style="flex:1;min-width:0"><b>${esc(p.main)}</b> <span class="tl">${esc(p.reg)}</span></div><span class="tl">${fmt(p.price)} ₽</span></div>`;
function scEdit(){
  SEL=S.showcase.filter(id=>find(id));
  const ls=all().slice().sort((a,b)=>b.price-a.price);
  sm(`<div class="dlg"><h3>Витрина <span class="tl" id="scn">${SEL.length} / ${SHOWCASE_MAX}</span></h3>${ls.length?`<div class="gl">${ls.map(row).join('')}</div>`:'<p class="tl">В коллекции пока нет номеров</p>'}<button class="btn" data-click="scSave">Сохранить</button><button class="btn" data-click="cm">Отмена</button></div>`)}
function scTog(a,el){
  const id=+a,i=SEL.indexOf(id);
  if(i>=0)SEL.splice(i,1);
  else{if(SEL.length>=SHOWCASE_MAX){banner('Витрина заполнена','Максимум '+SHOWCASE_MAX+' номера');return}SEL.push(id)}
  el.classList.toggle('a',SEL.includes(id));$('scn').textContent=SEL.length+' / '+SHOWCASE_MAX}
async function scSave(){
  cm();
  try{await rpc('set_showcase',{ids:SEL});S.showcase=SEL.slice();haptic('success');banner('Витрина обновлена','')}
  catch(e){console.warn(e);banner('Не получилось','Попробуйте ещё раз')}
  render(true)}
on({scEdit,scTog:(a,el)=>scTog(a,el),scSave,scShop:()=>go('shop')});
