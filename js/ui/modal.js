import {$} from '../util.js';
import {on} from './actions.js';

// Плашка-уведомление и модальное окно.
const noticePaths={
 info:'M12 8h.01 M12 11v5 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
 success:'m7 12 3 3 7-7 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
 error:'M12 7v6 M12 17h.01 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z'
};
const noticeKind=t=>/не хватает|ошибка|не удалось|нет связи|заполнена|банкротство/i.test(t)?'error':/куплено|получен|продан|открыт|готово|новый уровень/i.test(t)?'success':'info';
export function dismissBanner(){const b=$('banner');if(!b)return;clearTimeout(b._t);b.classList.remove('on');b.setAttribute('aria-hidden','true')}
function pauseNotice(b){clearTimeout(b._t);if(b._started){b._left=Math.max(0,b._left-(performance.now()-b._started));b._started=0}}
function resumeNotice(b){if(!b.classList.contains('on')||b.matches(':hover')||b.contains(document.activeElement))return;b._started=performance.now();clearTimeout(b._t);b._t=setTimeout(dismissBanner,b._left)}
export function banner(t,x,options={}){
 const b=$('banner');if(!b)return;
 clearTimeout(b._t);b._started=0;
 const kind=Object.hasOwn(noticePaths,options.kind)?options.kind:noticeKind(String(t));
 $('bt').textContent=t;$('bn').textContent=x??'';
 b.querySelector('.notice-icon').innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${noticePaths[kind]}"/></svg>`;
 b.dataset.kind=kind;b.setAttribute('aria-hidden','false');b.classList.add('on');
 b._left=Math.min(10000,Math.max(4200,(String(t).length+String(x??'').length)*55));
 if(!b._noticeBound){b._noticeBound=true;b.addEventListener('pointerenter',()=>pauseNotice(b));b.addEventListener('pointerleave',()=>resumeNotice(b));b.addEventListener('focusin',()=>pauseNotice(b));b.addEventListener('focusout',()=>queueMicrotask(()=>resumeNotice(b)));b.addEventListener('keydown',e=>{if(e.key==='Escape'){dismissBanner();e.stopPropagation()}})}
 resumeNotice(b);
}
export function sm(h){$('sh').innerHTML=h;$('md').classList.add('on')}
export function cm(){$('md').classList.remove('on')}
on({cm,bannerClose:dismissBanner,backdrop:(a,el,e)=>{if(e.target===el)cm()}});
