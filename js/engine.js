import {BY_L, COST, RAR, RU_L, TYPES, regFee} from './config.js';
import {BR, RR, regList} from './data/regions.js';
import {S, SESS} from './state.js';
import {pick, rnd} from './util.js';

// Клиентская часть движка. ПРАВИЛА (классификация, цена, регион) живут на сервере:
// supabase/functions/_shared/engine.ts. Здесь только то, что нужно интерфейсу.

// Признаки номера для статистики «за сессию» (на сервере та же функция считает общую статистику)
export function feats(p){const d=p.main.replace(/\D/g,''),l=p.main.replace(/[\d\s-]/g,''),r=x=>[...x].reverse().join(''),o=[];
 if(new Set(d).size<d.length)o.push(0);if(new Set(l).size<l.length)o.push(1);
 if(d.length>2&&d==r(d))o.push(2);if(l.length>1&&l==r(l))o.push(3);
 if(/^[1-9]0+$/.test(d))o.push(4);if(p.reg.length>1&&d.includes(p.reg))o.push(5);
 if(['777','888','999','555','007'].includes(d))o.push(6);if(/^0+[1-9]$/.test(d))o.push(7);
 o.push({civil:8,taxi:9,police:10}[p.type]);return o}
export function trackSession(p){const st=SESS;st.n++;st.best=Math.max(st.best,p.price);st.cls[p.cls]++;for(const k of feats(p))st.f[k]=(st.f[k]||0)+1}

// Номер-пустышка для анимации «барабана». Цены и настоящих правил тут нет, это только картинка.
export function fake(){
  const ru=S.country=='RU',taxi=ru&&Math.random()<.04,nd=ru?3:4,nl=ru?(taxi?2:3):2;
  const d=Array.from({length:nd},()=>rnd(10)).join(''),ls=Array.from({length:nl},()=>pick(ru?RU_L:BY_L)).join('');
  const main=ru?(taxi?ls+' '+d:ls[0]+d+ls.slice(1)):d+' '+ls+'-',reg=pick(Object.keys(ru?RR:BR));
  let x=Math.random()*100,cls=0;for(let i=0;i<RAR.length;i++){x-=RAR[i].p;if(x<0){cls=i;break}}
  return {country:S.country,type:taxi?'taxi':'civil',main,reg,cls}}
// Доплата за выбранный регион (на сервере её считает regionFee в _shared/engine.ts). Кэш: genCost зовётся на каждой отрисовке.
let FK='',FV=0;
export function regFeeNow(){const k=S.country+'|'+S.reg;if(k!==FK){const r=S.reg&&regList(S.country).find(x=>x.n==S.reg);FV=r?regFee(r.m):0;FK=k}return FV}
export function genCost(){return COST+regFeeNow()}
export function onTypes(){return TYPES}
