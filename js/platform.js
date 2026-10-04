// Telegram Mini App и устройство: единственное место, где трогается Telegram.WebApp.
export const TG=window.Telegram&&Telegram.WebApp;
if(TG){try{TG.ready();TG.expand()}catch(e){}}
import {S} from './state.js';
const HF=TG&&TG.HapticFeedback;
// Виды: tick (щелчок барабана), light, medium, heavy, rigid, success. В Telegram — родная вибрация, в браузере — запасной navigator.vibrate.
export function haptic(k){
  if(!S.vib)return;
  try{
    if(HF){
      if(k=='tick')HF.selectionChanged();
      else if(k=='success')HF.notificationOccurred('success');
      else HF.impactOccurred(['light','medium','heavy','rigid','soft'].includes(k)?k:'light');
    }else if(navigator.vibrate)navigator.vibrate(({tick:8,light:20,medium:35,heavy:[60,40,120],rigid:[40,30,40],success:[30,50,30]})[k]||20);
  }catch(e){}
}
// Вибрация при выпадении номера: чем реже номер, тем длиннее и сильнее серия.
export function hapticDrop(c){
  if(c<2){haptic('light');return}
  if(c==2){haptic('medium');setTimeout(()=>haptic('success'),160);return}
  const seq=c==3
    ?[['heavy',0],['heavy',110],['success',300]]
    :[['heavy',0],['rigid',90],['heavy',180],['heavy',300],['heavy',420],['success',620]];
  seq.forEach(([k,t])=>setTimeout(()=>haptic(k),t));
}
export function tgUser(){return TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user||null}
