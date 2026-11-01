// Semantic ASCII icon tokens for legacy templates. Player-written text is never rewritten as emoji.
import {icon} from './design.js';
const TOKEN=/:pi\/([a-z-]+):/g;
function convert(root){if(root.nodeType===1&&root.closest?.('svg,script,style,textarea,input,[data-no-icons]'))return;const nodes=[];
 if(root.nodeType===3)nodes.push(root);else{const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);while(w.nextNode())nodes.push(w.currentNode)}
 for(const node of nodes){const parent=node.parentElement;if(!parent||parent.closest('svg,script,style,textarea,input,[data-no-icons]')||!node.textContent.includes(':pi/'))continue;
  const text=node.textContent,frag=document.createDocumentFragment();let at=0;TOKEN.lastIndex=0;for(const m of text.matchAll(TOKEN)){frag.append(document.createTextNode(text.slice(at,m.index)));const el=document.createElement('span');el.className='pi';el.setAttribute('aria-hidden','true');if(m[1].startsWith('flag-'))el.innerHTML=`<i class="flag fl-${m[1].slice(5).toUpperCase()}"></i>`;else el.innerHTML=icon(m[1]);frag.append(el);at=m.index+m[0].length;}frag.append(document.createTextNode(text.slice(at)));node.replaceWith(frag);
 }
 if(root.nodeType===1)for(const el of [root,...root.querySelectorAll('[aria-label],[title],[placeholder]')])for(const a of ['aria-label','title','placeholder'])if(el.hasAttribute(a)&&el.getAttribute(a).includes(':pi/'))el.setAttribute(a,el.getAttribute(a).replace(TOKEN,''));
}
let scheduled=false;const pending=new Set();new MutationObserver(records=>{for(const r of records){if(r.type==='characterData')pending.add(r.target);else for(const n of r.addedNodes)pending.add(n)}if(!scheduled&&pending.size){scheduled=true;queueMicrotask(()=>{scheduled=false;const a=[...pending];pending.clear();for(const n of a)if(n.isConnected)convert(n)})}}).observe(document.body,{childList:true,subtree:true,characterData:true});convert(document.body);
