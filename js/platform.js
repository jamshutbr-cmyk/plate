// Telegram Mini App и устройство: единственное место, где трогается Telegram.WebApp.
export const TG=window.Telegram&&Telegram.WebApp;
if(TG){try{TG.ready();TG.expand()}catch(e){}}
export function haptic(k){try{if(TG&&TG.HapticFeedback)TG.HapticFeedback.impactOccurred(k=='heavy'?'heavy':'light');else if(navigator.vibrate)navigator.vibrate(k=='heavy'?[60,40,120]:20)}catch(e){}}
export function tgUser(){return TG&&TG.initDataUnsafe&&TG.initDataUnsafe.user||null}
