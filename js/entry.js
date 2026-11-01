// Skip the external Telegram SDK completely for the local investor showcase.
import {DEMO} from './mode.js';
if(!DEMO){
 await new Promise(resolve=>{const s=document.createElement('script');s.src='https://telegram.org/js/telegram-web-app.js';s.onload=resolve;s.onerror=resolve;document.head.append(s);setTimeout(resolve,5000)});
}
await import('./main.js');
