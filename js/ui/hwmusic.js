import {S} from '../state.js';

// Музыка экрана «Ночь тыкв»: зловещий ритуал в ре фригийском, строится прямо в браузере через Web Audio (файлов нет).
// Медленный темп, вечный бас-дрон с биением, давящие кластеры с малой секундой и тритоном, расстроенная музыкальная
// шкатулка, «сердцебиение», шёпот, скрипы, тяжёлый колокол и редкие обратные нарастания. Играет, только пока открыт экран v-hw,
// плавно входит и выходит. Кнопка 🔊 в шапке (выбор помнится) и общий S.mute из настроек игры её выключают.
// makeEngine вынесен отдельно, чтобы тот же код можно было отрисовать в файл (OfflineAudioContext).

const BPM=56, Q=60/BPM, BAR=Q*4, E8=Q/2;             // 4 доли, восьмая = E8, такт ≈ 4,3 с
const hz=m=>440*Math.pow(2,(m-69)/12);
// Давящие аккорды по тактам (8 тактов). Над постоянным басом D1/D2: малая секунда (Eb), тритон (Ab), уменьшённые ходы
const CH=[[50,57,63],[50,56,63],[48,54,60],[49,56,62],[50,57,63],[51,57,62],[48,54,59],[49,55,58]];
// Мелодия: 8 восьмых на такт, 0 — пауза. Скупо: D, Eb, F, G, Ab, A — ре фригийский с тритоном
const ML=[[62,0,0,0,63,0,0,0],[62,0,68,0,0,0,0,0],[69,0,0,0,68,0,65,0],[63,0,0,0,0,0,0,0],
          [62,0,65,0,68,0,0,0],[67,0,0,0,63,0,0,0],[68,0,69,0,68,0,63,0],[62,0,0,0,0,0,0,0]];

function noiseBuf(ctx,sec){const b=ctx.createBuffer(1,ctx.sampleRate*sec,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return b}
function impulse(ctx,sec){const n=ctx.sampleRate*sec,b=ctx.createBuffer(2,n,ctx.sampleRate);
  for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<n;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/n,2.2)}return b}

// out — куда подключать (GainNode мастера). Возвращает {start(t), stop(t), bar(i,t)}: i — номер такта с начала, t — его время.
export function makeEngine(ctx,out){
  const dry=ctx.createGain();dry.gain.value=.75;dry.connect(out);
  const rev=ctx.createConvolver();rev.buffer=impulse(ctx,4.5);
  const send=ctx.createGain();send.gain.value=.7;const ret=ctx.createGain();ret.gain.value=.85;
  send.connect(rev);rev.connect(ret);ret.connect(out);
  const env=(g,t,a,d,v)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+a);g.gain.exponentialRampToValueAtTime(.0001,t+a+d)};
  const tone=(type,f,t,a,d,v,to=[dry,send])=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.value=f;env(g,t,a,d,v);
    o.connect(g);to.forEach(x=>g.connect(x));o.start(t);o.stop(t+a+d+.05)};
  // Расстроенная шкатулка: нота «плывёт» вниз, как у умирающего механизма
  const box=(m,t,v)=>{const f=hz(m);
    [[1,'triangle',1],[2,'sine',.5],[5.04,'sine',.12]].forEach(([k,ty,a])=>{
      const o=ctx.createOscillator(),g=ctx.createGain();o.type=ty;o.frequency.setValueAtTime(f*k,t);o.frequency.exponentialRampToValueAtTime(f*k*.972,t+2.2);o.detune.value=-28;
      env(g,t,.004,k>2?.3:2.4,v*a);o.connect(g);g.connect(dry);g.connect(send);o.start(t);o.stop(t+2.6)})};
  // Давящий кластер: две пилы с биением через фильтр, медленное дрожание громкости
  const pad=(ms,t,dur)=>ms.forEach((m,j)=>[-12,12].forEach(c=>{const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain(),l=ctx.createOscillator(),lg=ctx.createGain();
    o.type='sawtooth';o.frequency.value=hz(m);o.detune.value=c;f.type='lowpass';f.frequency.setValueAtTime(260,t);f.frequency.linearRampToValueAtTime(720,t+dur*.6);f.frequency.linearRampToValueAtTime(300,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.02,t+1.6);g.gain.setValueAtTime(.02,t+dur-.5);g.gain.linearRampToValueAtTime(0,t+dur+1.2);
    l.frequency.value=.2+j*.07;lg.gain.value=.008;l.connect(lg);lg.connect(g.gain);
    o.connect(f);f.connect(g);g.connect(dry);g.connect(send);o.start(t);l.start(t);o.stop(t+dur+1.3);l.stop(t+dur+1.3)}));
  const heart=t=>{[0,.34].forEach((d,k)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';
    o.frequency.setValueAtTime(95,t+d);o.frequency.exponentialRampToValueAtTime(38,t+d+.22);
    g.gain.setValueAtTime(0,t+d);g.gain.linearRampToValueAtTime(k?.2:.3,t+d+.012);g.gain.exponentialRampToValueAtTime(.0001,t+d+.4);
    o.connect(g);g.connect(dry);o.start(t+d);o.stop(t+d+.45)})};
  const bell=t=>{[[1,1],[2.4,.6],[3.9,.4],[5.95,.25]].forEach(([k,a],i)=>tone('sine',73.4*k,t,.012,7-i*1.2,.11*a))};   // тяжёлый колокол на D2
  const whisper=t=>{const n=ctx.createBufferSource();n.buffer=noiseBuf(ctx,3);const f=ctx.createBiquadFilter(),g=ctx.createGain(),pn=ctx.createStereoPanner?ctx.createStereoPanner():null;
    f.type='bandpass';f.frequency.setValueAtTime(2600+Math.random()*900,t);f.frequency.linearRampToValueAtTime(1500+Math.random()*600,t+2.4);f.Q.value=7;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.075,t+.9);g.gain.linearRampToValueAtTime(0,t+2.6);
    n.connect(f);f.connect(g);let last=g;if(pn){pn.pan.value=Math.random()<.5?-.8:.8;g.connect(pn);last=pn}last.connect(send);last.connect(dry);n.start(t);n.stop(t+2.8)};
  const creak=t=>{const o=ctx.createOscillator(),f=ctx.createBiquadFilter(),g=ctx.createGain(),f0=90+Math.random()*60;o.type='sawtooth';
    o.frequency.setValueAtTime(f0,t);o.frequency.linearRampToValueAtTime(f0*1.9,t+.9);o.frequency.linearRampToValueAtTime(f0*1.25,t+1.7);
    f.type='bandpass';f.frequency.value=420;f.Q.value=9;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.06,t+.5);g.gain.linearRampToValueAtTime(0,t+1.8);
    o.connect(f);f.connect(g);g.connect(send);g.connect(dry);o.start(t);o.stop(t+1.9)};
  const riser=(t,dur)=>{const n=ctx.createBufferSource();n.buffer=noiseBuf(ctx,Math.ceil(dur)+1);const f=ctx.createBiquadFilter(),g=ctx.createGain();
    f.type='bandpass';f.Q.value=3;f.frequency.setValueAtTime(180,t);f.frequency.exponentialRampToValueAtTime(3800,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.exponentialRampToValueAtTime(.12,t+dur-.1);g.gain.linearRampToValueAtTime(0,t+dur+.05);
    n.connect(f);f.connect(g);g.connect(dry);g.connect(send);n.start(t);n.stop(t+dur+.1);
    tone('sawtooth',hz(38),t,dur,.2,.04)};   // обратное нарастание перед началом круга

  // Постоянная основа: D1 с биением (две чуть разные частоты), D2 тише; ветер из фильтрованного шума
  const dr=[[26,0,.16],[26,2.6,.12],[38,-5,.05]].map(([m,dt,v])=>{const o=ctx.createOscillator(),g=ctx.createGain(),f=ctx.createBiquadFilter();
    o.type=m<30?'sine':'triangle';o.frequency.value=hz(m);o.detune.value=dt;f.type='lowpass';f.frequency.value=300;g.gain.value=v;o.connect(f);f.connect(g);g.connect(dry);return o});
  const w=ctx.createBufferSource();w.buffer=noiseBuf(ctx,4);w.loop=true;
  const wf=ctx.createBiquadFilter();wf.type='bandpass';wf.frequency.value=300;wf.Q.value=1.1;
  const wg=ctx.createGain();wg.gain.value=.05;const lf=ctx.createOscillator(),lg=ctx.createGain();lf.frequency.value=.06;lg.gain.value=.035;
  lf.connect(lg);lg.connect(wg.gain);w.connect(wf);wf.connect(wg);wg.connect(dry);wg.connect(send);

  return{
    start(t){dr.forEach(o=>o.start(t));w.start(t);lf.start(t)},
    stop(t){try{dr.forEach(o=>o.stop(t));w.stop(t);lf.stop(t)}catch(e){}},
    bar(i,t){
      const b=i%8,loop=Math.floor(i/8);
      pad(CH[b],t,BAR);
      if(loop>=1||b>=4)heart(t+(b%2?Q*2:0));                                      // сердце: с первого круга, потом всегда
      if(loop%2==1&&b%2==0)heart(t+Q*2);
      ML[b].forEach((m,k)=>{if(m){box(m,t+k*E8,.075);if(loop%3==2)box(m+12,t+k*E8+E8/2,.022)}});   // каждый третий круг — эхо октавой выше
      if(b==0&&loop%2==0)bell(t+.05);                                              // колокол через круг
      if(b==2&&loop%2==1)whisper(t+.8);
      if(b==5&&loop%3!=1)creak(t+1.2);
      if(b==7&&loop%3==2)riser(t+BAR-4,4);                                         // перед каждым третьим кругом — нарастание
    }
  };
}

// ---------- Живое воспроизведение ----------
let AC=null,master=null,eng=null,timer=null,next=0,idx=0,playing=false;
const KEY='hw_music';
const pref=()=>{try{return localStorage.getItem(KEY)!=='0'}catch(e){return true}};
const savePref=v=>{try{localStorage.setItem(KEY,v?'1':'0')}catch(e){}};
const want=()=>pref()&&!S.mute;

function tick(){if(!AC)return;while(next<AC.currentTime+.8){eng.bar(idx++,next);next+=BAR}}
function start(){
  if(playing||!want())return;
  try{
    AC=AC||new(window.AudioContext||window.webkitAudioContext)();if(AC.state=='suspended')AC.resume();
    master=AC.createGain();master.gain.setValueAtTime(0,AC.currentTime);master.gain.linearRampToValueAtTime(.55,AC.currentTime+3);
    const cmp=AC.createDynamicsCompressor();master.connect(cmp);cmp.connect(AC.destination);
    eng=makeEngine(AC,master);eng.start(AC.currentTime);idx=0;next=AC.currentTime+.1;playing=true;tick();timer=setInterval(tick,150);
  }catch(e){console.error(e);playing=false}
}
function stop(){
  if(!playing)return;playing=false;clearInterval(timer);timer=null;
  const m=master,e=eng,t=AC.currentTime;
  m.gain.cancelScheduledValues(t);m.gain.setValueAtTime(m.gain.value,t);m.gain.linearRampToValueAtTime(0,t+.9);
  setTimeout(()=>{try{e.stop(0);m.disconnect()}catch(x){}},1400);   // хвосты реверберации обрезаем после затухания
}
const sync=on=>{on&&want()?start():stop()};

const ICON=on=>`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4z"/>${on?'<path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>':'<path d="M16 9.5l5 5M21 9.5l-5 5"/>'}</svg>`;

// Подключить к экрану: включается и выключается сама вместе с видимостью #v-hw
export function hwMusicInit(){
  const v=document.getElementById('v-hw');if(!v||v.dataset.mus)return;v.dataset.mus='1';
  const top=v.querySelector('.hw-top'),bal=document.getElementById('hwBal');
  if(top&&bal){
    const b=document.createElement('button');b.type='button';b.className='hw-mus';b.setAttribute('aria-label','Музыка');
    const paint=()=>{const on=want();b.innerHTML=ICON(on);b.classList.toggle('off',!on)};
    b.addEventListener('click',e=>{e.stopPropagation();const nv=!pref();savePref(nv);if(nv&&S.mute)S.mute=false;paint();sync(v.classList.contains('on'))});
    top.insertBefore(b,bal);paint();
    new MutationObserver(paint).observe(v,{attributes:true,attributeFilter:['class']});
  }
  new MutationObserver(()=>sync(v.classList.contains('on'))).observe(v,{attributes:true,attributeFilter:['class']});
  // на случай, если браузер не дал запустить звук без касания: пробуем ещё раз при первом тапе по экрану
  v.addEventListener('pointerdown',()=>{if(v.classList.contains('on')){if(AC&&AC.state=='suspended')AC.resume();else if(!playing)sync(true)}},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(!AC||!playing)return;document.hidden?AC.suspend():AC.resume()});
  if(v.classList.contains('on'))sync(true);
}
