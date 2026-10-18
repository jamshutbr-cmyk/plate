/* Дорожные работы 3D: игра подключается экраном js/views/road.js (RoadWorks.mount). Нужен three.js r128 (грузится загрузчиком экрана).
   Отличия от исходного файла: opts.plate (номер игрока из гаража), opts.best (рекорд с сервера), нет автозапуска на странице. Базовая версия: педали ГАЗ/СТОП и рация ДПС (клавиша R).
   Ивент: opts.mode ('road'|'chase' — погоня со звёздами и закатом), opts.skin (цвет кузова), opts.trail (след), opts.frame (рамка номера); onGameOver получает stats {clean,near,ramps,stars}. */
/* Дорожные работы 3D. Встраивание: const g=RoadWorks.mount(el,{onGameOver:r=>{}}); g.destroy();
   Управление: ← → / A D руль, ↑ ↓ газ/тормоз, P пауза; на телефоне — вести пальцем. */
(function(){
const MOBILE=/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)||(navigator.maxTouchPoints>1&&Math.min(screen.width,screen.height)<900)||(window.matchMedia&&matchMedia('(pointer:coarse)').matches);
const MP=o=>{if(MOBILE){const r=Object.assign({},o);delete r.clearcoat;delete r.clearcoatRoughness;return new THREE.MeshStandardMaterial(r);}return new THREE.MeshPhysicalMaterial(o);};
function mergeStatic(root){root.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(root.matrixWorld).invert(),keep=o=>o.userData.keep||o===root.userData.lamp||o===root.userData.lamp2,B=new Map();
 (function walk(o){for(const c of o.children){if(keep(c)||!c.visible)continue;
  if(c.isMesh&&!Array.isArray(c.material)&&c.geometry&&c.geometry.attributes.position&&c.geometry.attributes.normal){const l=B.get(c.material);l?l.push(c):B.set(c.material,[c]);}
  else if(c.children.length)walk(c);}})(root);
 const v=new THREE.Vector3(),nm=new THREE.Matrix3(),M4=new THREE.Matrix4();
 for(const[mat,L]of B){if(L.length<2)continue;let nv=0,ni=0,uv=0;
  for(const m of L){const g=m.geometry;nv+=g.attributes.position.count;ni+=g.index?g.index.count:g.attributes.position.count;if(g.attributes.uv)uv=1;}
  const P=new Float32Array(nv*3),N=new Float32Array(nv*3),U=uv?new Float32Array(nv*2):null,I=nv>65535?new Uint32Array(ni):new Uint16Array(ni);let vo=0,io=0;
  for(const m of L){const g=m.geometry,pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv;M4.multiplyMatrices(inv,m.matrixWorld);nm.getNormalMatrix(M4);const fl=M4.determinant()<0;
   for(let i=0;i<pa.count;i++){const k=(vo+i)*3;v.fromBufferAttribute(pa,i).applyMatrix4(M4);P[k]=v.x;P[k+1]=v.y;P[k+2]=v.z;v.fromBufferAttribute(na,i).applyMatrix3(nm).normalize();N[k]=v.x;N[k+1]=v.y;N[k+2]=v.z;if(ua&&U){U[(vo+i)*2]=ua.getX(i);U[(vo+i)*2+1]=ua.getY(i);}}
   const ix=g.index,n=ix?ix.count:pa.count;
   for(let i=0;i<n;i+=3){const a=vo+(ix?ix.getX(i):i),b=vo+(ix?ix.getX(i+1):i+1),c=vo+(ix?ix.getX(i+2):i+2);if(fl){I[io+i]=a;I[io+i+1]=c;I[io+i+2]=b;}else{I[io+i]=a;I[io+i+1]=b;I[io+i+2]=c;}}
   vo+=pa.count;io+=n;}
  const G=new THREE.BufferGeometry();G.setAttribute('position',new THREE.BufferAttribute(P,3));G.setAttribute('normal',new THREE.BufferAttribute(N,3));if(U)G.setAttribute('uv',new THREE.BufferAttribute(U,2));G.setIndex(new THREE.BufferAttribute(I,1));G.userData.mg=1;
  const mm=new THREE.Mesh(G,mat);mm.renderOrder=L[0].renderOrder;root.add(mm);
  for(const m of L){m.parent.remove(m);if(!m.geometry.userData.sh)m.geometry.dispose();}}}
const rnd=(a,b)=>a+Math.random()*(b-a),ri=n=>Math.floor(Math.random()*n),pick=a=>a[ri(a.length)],cl=(x,a,b)=>Math.max(a,Math.min(b,x));
const LET=[..."АВЕКМНОРСТУХ"],REG=["102","82","77","178","197","116","161","50","78","99","152","24"];
const mkPlate=()=>pick(LET)+(100+ri(900))+pick(LET)+pick(LET)+" "+pick(REG);
const HUES=[0,28,50,120,260,310,170,200],LX=[-6,-2,2,6];
const CSS=`.rw-ped{position:absolute;bottom:max(18px,env(safe-area-inset-bottom));width:74px;height:92px;border-radius:20px;display:none;align-items:center;justify-content:center;flex-direction:column;font-size:11px;font-weight:800;letter-spacing:1px;color:#fff;border:1px solid rgba(255,220,170,.45);background:rgba(20,10,16,.55);box-shadow:0 4px 14px rgba(0,0,0,.45);touch-action:none;-webkit-tap-highlight-color:transparent;opacity:.8}
.rw.m .rw-ped{display:flex}.rw.intro .rw-ped{display:none}.rw-ped svg{width:30px;height:30px;margin-bottom:4px}.rw-ped.g{right:16px;background:linear-gradient(#3fcf62,#1c8a3a)}.rw-ped.k{left:16px;background:linear-gradient(#ff5a3c,#b81e0a)}.rw-ped.on{transform:scale(.94);opacity:1;filter:brightness(1.25)}
.rw{position:relative;width:100%;height:100%;overflow:hidden;background:#0b0907;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffe3c2;touch-action:none;user-select:none;-webkit-user-select:none}
.rw canvas{display:block;position:absolute;inset:0}
.rw-hud{position:absolute;left:0;right:0;top:0;display:flex;justify-content:space-between;align-items:flex-start;padding:max(10px,env(safe-area-inset-top)) 14px 0;pointer-events:none;text-shadow:0 2px 8px #000}
.rw:after{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 42%,transparent 52%,rgba(10,3,8,.6) 100%)}
.rw-hud>div{background:rgba(20,10,16,.5);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,190,120,.2);border-radius:14px;padding:6px 14px;min-width:72px;box-shadow:0 4px 16px rgba(0,0,0,.35)}
.rw-hud b{font-size:28px;font-weight:800;font-variant-numeric:tabular-nums;color:#fff1d8}.rw-hud small{display:block;font-size:10px;opacity:.65;letter-spacing:2px}
.rw-stars{position:absolute;top:68px;left:0;right:0;text-align:center;color:#ffd54a;font:700 18px Arial,sans-serif;letter-spacing:3px;pointer-events:none}
.rw-hearts{font-size:22px;color:#ff5a3c;letter-spacing:3px;display:flex;align-items:center}
.rw-toast{position:absolute;left:0;right:0;top:34%;text-align:center;font-weight:800;font-size:22px;pointer-events:none;opacity:0;text-shadow:0 2px 10px #000}
.rw-toast.on{animation:rwt .9s ease-out}@keyframes rwt{0%{opacity:0;transform:translateY(14px) scale(.9)}15%{opacity:1}100%{opacity:0;transform:translateY(-34px)}}
.rw-menu{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:radial-gradient(ellipse at center,rgba(20,10,6,.62),rgba(6,3,2,.9));text-align:center;padding:20px}
.rw-menu h1{margin:0;font-size:clamp(28px,8vw,50px);font-weight:900;line-height:1.05;letter-spacing:1px;background:linear-gradient(#ffe27a,#ff8a1e);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 4px 18px rgba(255,110,20,.45))}
.rw-menu p{margin:0;opacity:.8;font-size:14px;line-height:1.55;max-width:340px}
.rw-plate{display:inline-flex;align-items:center;gap:8px;background:#f4f4ee;color:#111;border:3px solid #111;border-radius:9px;padding:3px 12px;font:700 36px Arial,sans-serif;letter-spacing:2px;box-shadow:0 6px 24px rgba(0,0,0,.6)}
.rw-plate i{font-style:normal;border-left:3px solid #111;padding-left:9px;font-size:26px;line-height:1;position:relative}
.rw-plate i:after{content:"RUS";display:block;font-size:9px;letter-spacing:1px;margin-top:2px}
.rw-row{display:flex;gap:36px;justify-content:center}.rw-btn{border:1px solid rgba(255,220,170,.45);border-radius:16px;padding:15px 44px;font-size:19px;font-weight:800;letter-spacing:1px;color:#fff;background:linear-gradient(#ff8a2c,#e04a0a);box-shadow:0 8px 28px rgba(255,90,10,.5),inset 0 1px 0 rgba(255,255,255,.35);cursor:pointer;transition:transform .12s,filter .12s}.rw-btn:hover{filter:brightness(1.1)}
.rw-btn:active{transform:scale(.97)}.rw-stat{font-size:20px;font-weight:700}.rw-stat span{opacity:.6;font-size:13px;display:block;letter-spacing:2px}.rw.m .rw-hud>div{backdrop-filter:none;-webkit-backdrop-filter:none;background:rgba(20,10,16,.7)}.rw.m:after{display:none}.rw-bar{position:absolute;left:0;right:0;height:0;background:#000;z-index:3;pointer-events:none;transition:height .6s ease}.rw-bar.t{top:0}.rw-bar.b{bottom:0}.rw.intro .rw-bar{height:11%}.rw-skip{position:absolute;right:14px;bottom:calc(11% + 14px);z-index:4;display:none;border:1px solid rgba(255,220,170,.4);border-radius:12px;padding:8px 16px;font-size:13px;font-weight:700;letter-spacing:1px;color:#fff;background:rgba(20,10,16,.6);cursor:pointer}.rw.intro .rw-skip{display:block}
.rw-flash,.rw-spd{position:absolute;inset:0;z-index:2;pointer-events:none;opacity:0}
.rw.cops .rw-flash{opacity:1;animation:rwfl .36s steps(1) infinite}
@keyframes rwfl{0%{background:radial-gradient(ellipse at 8% 55%,rgba(255,30,30,.5),transparent 62%)}50%{background:radial-gradient(ellipse at 92% 55%,rgba(40,100,255,.5),transparent 62%)}}
.rw-spd{background:repeating-conic-gradient(from 0deg at 50% 46%,transparent 0 4.2deg,rgba(255,236,205,.2) 4.2deg 5deg);-webkit-mask-image:radial-gradient(ellipse at 50% 46%,transparent 28%,#000 85%);mask-image:radial-gradient(ellipse at 50% 46%,transparent 28%,#000 85%);transition:opacity .25s}
.rw.nitro .rw-spd{opacity:1;animation:rwsp .09s linear infinite}
@keyframes rwsp{from{transform:rotate(0deg) scale(1.02)}to{transform:rotate(5deg) scale(1.1)}}
.rw-tt{position:absolute;left:0;right:0;top:19%;z-index:2;text-align:center;pointer-events:none;opacity:0;text-shadow:0 4px 26px #000}
.rw-tt b{display:block;font-size:clamp(24px,6.5vw,52px);font-weight:900;letter-spacing:.16em;color:#ffe3c2}
.rw-tt i{display:block;margin-top:8px;font-style:normal;font-size:clamp(11px,2.4vw,16px);letter-spacing:.5em;color:#ff8a5a;font-weight:800}
.rw-tt.on{animation:rwtt 2.7s ease-out forwards}
@keyframes rwtt{0%{opacity:0;transform:scale(1.2)}16%{opacity:1}72%{opacity:1}100%{opacity:0;transform:scale(1)}}
.rw-radio{position:absolute;top:96px;right:0;z-index:4;width:min(76vw,272px);transform:translateX(100%);transition:transform .3s cubic-bezier(.2,.8,.2,1);text-shadow:none}
.rw-radio.open{transform:none}
.rw-rtab{position:absolute;left:-46px;top:0;width:46px;height:54px;border-radius:14px 0 0 14px;background:rgba(20,10,16,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border:1px solid rgba(255,190,120,.3);border-right:0;font-size:22px;display:flex;align-items:center;justify-content:center;cursor:pointer}
.rw-rtab b{position:absolute;top:-7px;left:-7px;min-width:18px;height:18px;padding:0 4px;box-sizing:border-box;border-radius:9px;background:#ff3b30;color:#fff;font-size:11px;line-height:18px;text-align:center;display:none}
.rw-rtab.new{animation:rwrp .55s ease-in-out infinite alternate}
@keyframes rwrp{to{box-shadow:0 0 16px #4aa8ff;border-color:#4aa8ff}}
.rw-rbody{background:rgba(14,8,14,.8);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border:1px solid rgba(255,190,120,.25);border-right:0;border-radius:14px 0 0 14px;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.45)}
.rw-rh{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;font-size:11px;font-weight:800;letter-spacing:1.5px;color:#9fd0ff;border-bottom:1px solid rgba(255,190,120,.18)}
.rw-rm{font-size:10px;letter-spacing:0;font-weight:700;color:#ffe3c2;background:rgba(255,255,255,.12);border-radius:8px;padding:3px 7px;cursor:pointer}
.rw-rlog{height:min(40vh,300px);overflow-y:auto;padding:6px 10px 10px;font-size:12.5px;line-height:1.35;font-family:ui-monospace,Menlo,Consolas,monospace;color:#ffe3c2}
.rw-rl{margin:0 0 7px;animation:rwrl .25s ease-out}
.rw-rl s{text-decoration:none;opacity:.5;margin-right:6px;font-size:10px}
.rw-rl b{margin-right:5px}
@keyframes rwrl{from{opacity:0;transform:translateX(10px)}}
.rw-ty{opacity:.55;font-style:italic}
.rw-pk{position:absolute;right:calc(100% + 54px);top:2px;width:max-content;max-width:min(62vw,250px);background:rgba(14,8,14,.86);border:1px solid rgba(255,190,120,.3);border-radius:12px;padding:7px 10px;font-size:12.5px;line-height:1.3;color:#ffe3c2;opacity:0;pointer-events:none}
.rw-pk.on{animation:rwpk 4s ease-out forwards}
@keyframes rwpk{0%{opacity:0;transform:translateX(12px)}8%{opacity:1;transform:none}85%{opacity:1}100%{opacity:0}}
.rw-radio.open .rw-pk{display:none}`;

const cvs=(w,h,f)=>{const k=document.createElement('canvas');k.width=w;k.height=h;f(k.getContext('2d'),w,h);const t=new THREE.CanvasTexture(k);t.encoding=THREE.sRGBEncoding;t.anisotropy=MOBILE?4:8;return t;};
const plateTex=(s,fr)=>cvs(256,64,(g,w,h)=>{g.fillStyle='#f4f4ee';g.fillRect(0,0,w,h);g.strokeStyle=fr||'#111';g.lineWidth=fr?9:5;g.strokeRect(3,3,w-6,h-6);
 const[m,r]=s.split(' ');g.fillStyle='#111';g.textBaseline='middle';g.textAlign='center';g.font='700 40px Arial';g.fillText(m,92,35);g.fillRect(170,9,3,h-18);
 g.font='700 28px Arial';g.fillText(r,208,26);g.font='700 11px Arial';g.fillText('RUS',206,50);
 g.fillStyle='#fff';g.fillRect(228,44,18,4);g.fillStyle='#1c57c7';g.fillRect(228,48,18,4);g.fillStyle='#d52b1e';g.fillRect(228,52,18,4);});

/* Косметика ивента (id и цвета зеркалят supabase/event.sql, это сверяет tests/event.test.mjs) */
const SKIN={ev_c_orange:{c:'#e0661a'},ev_c_taxi:{c:'#e0b020'},ev_c_olive:{c:'#6b7a3a'},ev_c_red:{c:'#c8372d'},ev_c_lime:{c:'#8fd13a'},ev_c_blue:{c:'#2f5fb3'},ev_c_dps:{c:'#e8ecf2'},ev_c_violet:{c:'#6b3fa0',rg:.25,mt:.85},ev_c_black:{c:'#15161a',rg:.55,mt:.2},ev_c_gold:{c:'#d9a932',rg:.2,mt:.95},ev_c_mirror:{c:'#cfd3da',rg:.06,mt:1},ev_c_ghost:{c:'#aeb4c2',rg:.6,mt:.1}};
const FRAME={ev_f_asphalt:'#5a5f68',ev_f_rust:'#9a5a35',ev_f_tape:'#e6b800',ev_f_barrier:'#d63a3a',ev_f_dps:'#2f5fb3',ev_f_cone:'#e0661a',ev_f_hazard:'#f5b400',ev_f_carbon:'#2b2d33',ev_f_beacon:'#2f6bff',ev_f_chrome:'#c8ccd4',ev_f_gold:'#d9a932',ev_f_king:'#ff4d6d'};
const TRAIL={ev_tr_dust:{c:'#a98457',s:.9,g:2,l:.8,y:.35,a:.55},ev_tr_smoke:{c:'#8d8d93',s:1.1,g:2.2,l:.9,y:.5,a:.5},ev_tr_skid:{c:'#17171a',s:.5,g:1.2,l:1.6,y:.05,a:.7},ev_tr_frost:{c:'#bfe9ff',s:.8,g:1.8,l:.9,y:.4,a:.6},ev_tr_spark:{c:['#ffd54a','#ff8a1d'],s:.35,g:.9,l:.7,y:.25,a:.95},ev_tr_tape:{c:['#e6b800','#15151a'],s:.45,g:.6,l:1.1,y:.4,a:.9},ev_tr_fire:{c:['#ff6a1d','#ffd23a'],s:.8,g:1.6,l:.8,y:.5,a:.85},ev_tr_beacon:{c:['#e5484d','#2f6bff'],s:.6,g:1,l:1,y:.3,a:.9},ev_tr_gold:{c:['#f5c542','#fff3b0'],s:.5,g:1.1,l:1,y:.4,a:.9}};
/* Темы уровня: road — прежний вечер, sunset — закат (режим погони): краснее небо и туман, ниже и жарче солнце */
const THEMES={road:{fog:0x5c3338,fd:.0105,hemi:0xffb080,hg:0x3a2a30,hi:.8,dl:0xff8a3a,di:2.2,sun:0xffffff},sunset:{fog:0x7a2f2a,fd:.0125,hemi:0xff8f5a,hg:0x2a1a24,hi:.95,dl:0xff5a22,di:2.7,sun:0xff9a60}};
const STAR_M=2000;   // метров на звезду розыска (режим погони), зеркало EVENT.chase.starM
function mount(root,opts={}){
const CHASE=opts.mode==='chase';let FRAME_C=FRAME[opts.frame]||null;
if(!window.THREE){root.textContent='three.js не загрузился';return{destroy(){}}}
const sty=document.createElement('style');sty.textContent=CSS;document.head.appendChild(sty);
const box0=document.createElement('div');box0.className='rw'+(MOBILE?' m':'');root.appendChild(box0);
const R=new THREE.WebGLRenderer({antialias:!MOBILE,powerPreference:'high-performance'});R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.ACESFilmicToneMapping;R.toneMappingExposure=1.0;
box0.appendChild(R.domElement);
const hud=document.createElement('div');hud.className='rw-hud';hud.innerHTML='<div><small>ОЧКИ</small><b class=s>0</b></div><div class=rw-hearts></div><div style="text-align:right"><small>КМ/Ч</small><b class=k>0</b></div>';
const hStar=document.createElement('div');hStar.className='rw-stars';if(CHASE)box0.appendChild(hStar);
const toast=document.createElement('div');toast.className='rw-toast';const menu=document.createElement('div');menu.className='rw-menu';
const bt=document.createElement('div'),bb=document.createElement('div'),skipB=document.createElement('button');bt.className='rw-bar t';bb.className='rw-bar b';skipB.className='rw-skip';skipB.textContent='ПРОПУСТИТЬ ›';
skipB.onclick=ev=>{ev.stopPropagation();endIntro();};const ovF=document.createElement('div'),ovS=document.createElement('div'),ovT=document.createElement('div');ovF.className='rw-flash';ovS.className='rw-spd';ovT.className='rw-tt';box0.append(hud,toast,menu,ovF,ovS,ovT,bt,bb,skipB);
const hS=hud.querySelector('.s'),hK=hud.querySelector('.k'),hH=hud.querySelector('.rw-hearts');

const scene=new THREE.Scene();scene.fog=new THREE.FogExp2(0x5c3338,.0105);
const cam=new THREE.PerspectiveCamera(60,1,.1,800);
const PRmax=Math.min(devicePixelRatio||1,2);const WEAK=MOBILE&&((navigator.hardwareConcurrency||8)<=4||(navigator.deviceMemory||8)<=3);const PRfloor=Math.min(PRmax,1.4),PRhard=Math.min(PRmax,1.15);let PR=MOBILE?Math.min(PRmax,WEAK?1.5:1.75):PRmax,fAcc=0,fN=0,PRceil=PRmax,upAt=-9e9,frames=0,half=false,halfT=0;
function fit(){const w=root.clientWidth||innerWidth,h=root.clientHeight||innerHeight;R.setPixelRatio(PR);R.setSize(w,h);cam.aspect=w/h;cam.userData.b=w/h<1?74:60;cam.updateProjectionMatrix();}
const ro=new ResizeObserver(fit);ro.observe(root);fit();

/* sky + sun */
const sky=new THREE.Mesh(new THREE.SphereGeometry(500,24,16),new THREE.MeshBasicMaterial({fog:false,toneMapped:false,side:THREE.BackSide,map:cvs(512,512,(g,w,h)=>{
 const gr=g.createLinearGradient(0,0,0,h);[[0,'#10122a'],[.3,'#3a2447'],[.42,'#c4502a'],[.5,'#ff9a3a'],[.52,'#5c3338'],[1,'#3a2024']].forEach(a=>gr.addColorStop(a[0],a[1]));g.fillStyle=gr;g.fillRect(0,0,w,h);
 for(let i=0;i<70;i++){g.fillStyle=`rgba(${ri(2)?'30,12,36':'255,120,40'},${rnd(.08,.25)})`;g.beginPath();g.ellipse(rnd(0,w),rnd(h*.25,h*.46),rnd(30,110),rnd(3,11),0,0,7);g.fill();}})}));
scene.add(sky);
const sun=new THREE.Sprite(new THREE.SpriteMaterial({fog:false,toneMapped:false,depthWrite:false,blending:THREE.AdditiveBlending,map:cvs(128,128,(g)=>{const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,'#fff4d0');r.addColorStop(.18,'#ffc060');r.addColorStop(.4,'rgba(255,120,30,.45)');r.addColorStop(1,'rgba(255,90,20,0)');g.fillStyle=r;g.fillRect(0,0,128,128);})}));
sun.scale.set(150,150,1);sun.position.set(0,24,-400);scene.add(sun);
/* reflections: sky -> env map (paint, glass, wet asphalt) */
{const pm=new THREE.PMREMGenerator(R);scene.environment=pm.fromEquirectangular(sky.material.map).texture;pm.dispose();}
const HL=new THREE.HemisphereLight(0xffb080,0x3a2a30,.8);scene.add(HL);
const dl=new THREE.DirectionalLight(0xff8a3a,2.2);dl.position.set(0,14,-120);scene.add(dl);
const applyTheme=n=>{const T=THEMES[n]||THEMES.road;scene.fog.color.setHex(T.fog);scene.fog.density=T.fd;HL.color.setHex(T.hemi);HL.groundColor.setHex(T.hg);HL.intensity=T.hi;dl.color.setHex(T.dl);dl.intensity=T.di;sun.material.color.setHex(T.sun);};applyTheme(CHASE?'sunset':'road');
const fill=new THREE.DirectionalLight(0x9aaeff,.6);fill.position.set(0,8,30);scene.add(fill);

/* ground, road */
const gt=cvs(256,256,(g,w,h)=>{g.fillStyle='#3c2c20';g.fillRect(0,0,w,h);for(let i=0;i<3000;i++){const l=ri(40);g.fillStyle=`rgba(${l+30},${l+20},${l+14},${rnd(.2,.5)})`;g.fillRect(rnd(0,w),rnd(0,h),rnd(1,3),rnd(1,3));}});
gt.wrapS=gt.wrapT=THREE.RepeatWrapping;gt.repeat.set(40,60);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(500,800),new THREE.MeshStandardMaterial({map:gt,roughness:1}));ground.rotation.x=-Math.PI/2;ground.position.set(0,-.02,-300);scene.add(ground);
const rt=cvs(512,512,(g,w,h)=>{g.fillStyle='#2e2f35';g.fillRect(0,0,w,h);
 for(let i=0;i<24000;i++){const l=ri(70);g.fillStyle=`rgba(${l+38},${l+38},${l+46},${rnd(.05,.2)})`;g.fillRect(rnd(0,w),rnd(0,h),rnd(1,2),rnd(1,2));}
 for(const c of[64,192,320,448])for(const o of[-24,24]){const gr=g.createLinearGradient(c+o-18,0,c+o+18,0);gr.addColorStop(0,'rgba(0,0,0,0)');gr.addColorStop(.5,'rgba(0,0,0,.09)');gr.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=gr;g.fillRect(c+o-18,0,36,h);}
 const paint=(x,y,ww,hh)=>{g.fillStyle='#ecece4';g.fillRect(x,y,ww,hh);for(let k=0;k<ww*hh/40;k++){g.fillStyle=`rgba(46,47,53,${rnd(.25,.6)})`;g.fillRect(x+rnd(0,ww),y+rnd(0,hh),rnd(1,2),rnd(1,2));}};
 paint(14,0,8,h);paint(490,0,8,h);for(const x of[124,252,380])for(const y of[0,256])paint(x,y,8,96);});
rt.anisotropy=Math.min(8,R.capabilities.getMaxAnisotropy());
rt.wrapS=rt.wrapT=THREE.RepeatWrapping;rt.repeat.set(1,25);
const road=new THREE.Mesh(new THREE.PlaneGeometry(16,400),new THREE.MeshStandardMaterial({map:rt,roughness:.85,metalness:0}));
road.rotation.x=-Math.PI/2;road.position.set(0,0,-170);scene.add(road);road.material.roughness=.9;
const onP=new THREE.Mesh(new THREE.PlaneGeometry(3.8,400),new THREE.MeshBasicMaterial({color:0xff2a1a,transparent:true,opacity:.13,depthWrite:false}));onP.rotation.x=-Math.PI/2;onP.position.set(-6,.03,-170);onP.visible=false;scene.add(onP);{const r2=road.clone();r2.position.z=230;scene.add(r2);}

/* helpers + materials */
const GC={};const geo=(w,h,d)=>{const k=[w,h,d].join();return GC[k]||(GC[k]=(q=>(q.userData.sh=1,q))(new THREE.BoxGeometry(w,h,d)));};
const MS=(c,r,m)=>new THREE.MeshStandardMaterial({color:c,roughness:r==null?.6:r,metalness:m||0});
const M={dark:MS(0x0c0c10,.8),glass:MS(0x0a1018,.04,.9),tail:new THREE.MeshBasicMaterial({color:0xff2a18}),amber:new THREE.MeshBasicMaterial({color:0xffb100}),white:MS(0xd8dde2,.5),orange:MS(0xe8601a,.5),conc:MS(0xe4e4e0,.8),pole:MS(0x39383e,.7,.5),
 tire:MS(0x0a0a0c,.9),rim:MS(0xc4c8d0,.25,.9),bed:MS(0xe0a018,.5,.2),
 blk:new THREE.MeshBasicMaterial({color:0,transparent:true,opacity:.5,depthWrite:false})};
const ZN=MS(0x9a9da4,.35,.85),DK=MS(0x24232a,.6,.5),rflM=new THREE.MeshBasicMaterial({color:0xff4a2a});
const RIMF=new THREE.MeshStandardMaterial({roughness:.35,metalness:.6,map:cvs(64,64,g=>{g.fillStyle='#15151a';g.fillRect(0,0,64,64);g.fillStyle='#c9cdd5';g.beginPath();g.arc(32,32,30,0,7);g.fill();g.fillStyle='#202229';
 for(let i=0;i<5;i++){const a=i*1.2566+.35;g.beginPath();g.moveTo(32,32);g.arc(32,32,25,a,a+.78);g.closePath();g.fill();}
 g.fillStyle='#dde0e6';g.beginPath();g.arc(32,32,8,0,7);g.fill();g.fillStyle='#202229';g.beginPath();g.arc(32,32,2.6,0,7);g.fill();})});
const rfG=[1,-1].map(s=>{const q=new THREE.CircleGeometry(.25,20);q.rotateY(s*Math.PI/2);return q;});
const wheelG=new THREE.CylinderGeometry(.38,.38,.3,18);wheelG.rotateZ(Math.PI/2);
const rimG=new THREE.CylinderGeometry(.24,.24,.32,12);rimG.rotateZ(Math.PI/2);
const bx=(g,w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(geo(w,h,d),m);o.position.set(x,y,z);g.add(o);return o;};
const wheel=(g,x,y,z,s)=>{const q=Math.sign(x),G=new THREE.Group(),w=new THREE.Mesh(wheelG,M.tire),r=new THREE.Mesh(rimG,M.rim),f=new THREE.Mesh(rfG[q>0?0:1],RIMF);G.position.set(x,y,z);G.scale.setScalar(s);G.userData.keep=1;f.position.x=q*.165;G.add(w,r,f);g.add(G);(g.userData.sw||(g.userData.sw=[])).push(G);};
const addSpin=g=>{const W=g.userData.sw;if(W)g.userData.spin=(dt,v0)=>{const d=Math.min(v0/.68*dt*.5,.5);for(const w of W)w.rotation.x-=d;};return g;};
const stripe=cvs(128,32,(g,w,h)=>{g.fillStyle='#f2f2f2';g.fillRect(0,0,w,h);g.fillStyle='#e8601a';for(let i=-2;i<8;i++){g.beginPath();g.moveTo(i*24,h);g.lineTo(i*24+12,h);g.lineTo(i*24+12+h,0);g.lineTo(i*24+h,0);g.fill();}});
const SM=new THREE.MeshStandardMaterial({map:stripe,roughness:.6});
const mkBlock=()=>{const g=new THREE.Group();bx(g,3.6,1.0,.9,0,.5,0,SM);bx(g,3.2,.12,.5,0,1.06,0,M.dark);const l=new THREE.Mesh(new THREE.SphereGeometry(.16,10,8),new THREE.MeshBasicMaterial({color:0xffb100}));l.position.set(-1.3,1.25,0);g.add(l);g.userData.lamp=l;return g;};
const goldM=new THREE.MeshBasicMaterial({map:cvs(128,40,(g,w,h)=>{g.fillStyle='#ffd23a';g.fillRect(0,0,w,h);g.strokeStyle='#7a5200';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);g.fillStyle='#4a3000';g.font='700 28px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('777 ₽',w/2,h/2+2);}),side:THREE.DoubleSide});
const glowM=new THREE.SpriteMaterial({blending:THREE.AdditiveBlending,depthWrite:false,map:sun.material.map,color:0xffd040});
const mkToken=()=>{const g=new THREE.Group(),p=new THREE.Mesh(new THREE.PlaneGeometry(1.6,.5),goldM),s=new THREE.Sprite(glowM);s.scale.set(4,4,1);p.position.y=1.2;s.position.y=1.2;g.add(p,s);g.userData.p=p;return g;};
const mkHeart=()=>{const hs=new THREE.Shape();hs.moveTo(0,-.55);hs.bezierCurveTo(-.15,-.4,-.7,-.1,-.7,.25);hs.bezierCurveTo(-.7,.65,-.15,.75,0,.4);hs.bezierCurveTo(.15,.75,.7,.65,.7,.25);hs.bezierCurveTo(.7,-.1,.15,-.4,0,-.55);
 if(!mkHeart.G){mkHeart.G=new THREE.ExtrudeGeometry(hs,{depth:.25,bevelEnabled:true,bevelThickness:.08,bevelSize:.08,bevelSegments:2,curveSegments:10});mkHeart.G.center();mkHeart.M=new THREE.MeshStandardMaterial({color:0xff2a40,emissive:0xff1030,emissiveIntensity:.9,roughness:.3,metalness:.1});}
 const g=new THREE.Group(),p=new THREE.Mesh(mkHeart.G,mkHeart.M),s=new THREE.Sprite(glowR);p.scale.setScalar(1.15);s.scale.set(4.2,4.2,1);p.position.y=1.2;s.position.y=1.2;g.add(p,s);g.userData.p=p;return g;};
const mkShield=()=>{if(!mkShield.G){const s=new THREE.Shape();s.moveTo(-.6,.55);s.lineTo(.6,.55);s.lineTo(.6,0);s.bezierCurveTo(.6,-.35,.2,-.6,0,-.78);s.bezierCurveTo(-.2,-.6,-.6,-.35,-.6,0);s.lineTo(-.6,.55);
 mkShield.G=new THREE.ExtrudeGeometry(s,{depth:.22,bevelEnabled:true,bevelThickness:.07,bevelSize:.07,bevelSegments:2,curveSegments:10});mkShield.G.center();
 mkShield.M=new THREE.MeshStandardMaterial({color:0x39a0ff,emissive:0x1d6bff,emissiveIntensity:1,roughness:.25,metalness:.3});
 mkShield.S=new THREE.SpriteMaterial({blending:THREE.AdditiveBlending,depthWrite:false,map:sun.material.map,color:0x3aa0ff});}
 const g=new THREE.Group(),p=new THREE.Mesh(mkShield.G,mkShield.M),s=new THREE.Sprite(mkShield.S);p.scale.setScalar(1.2);s.scale.set(4.4,4.4,1);p.position.y=1.2;s.position.y=1.2;g.add(p,s);g.userData.p=p;return g;};
const speedTex=cvs(512,120,(g,w,h)=>{g.fillStyle='#07080b';g.fillRect(0,0,w,h);for(const[x,t]of[[70,'80'],[442,'120']]){g.strokeStyle='#ff3a24';g.lineWidth=9;g.beginPath();g.arc(x,60,44,0,7);g.stroke();g.fillStyle='#ffd8a8';g.font='700 40px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText(t,x,62);}
 g.fillStyle='#ffb100';g.font='700 30px Arial';g.fillText('ДОРОЖНЫЕ РАБОТЫ',256,50);g.font='20px Arial';g.fillText('снизьте скорость',256,84);});
const gSph=new THREE.SphereGeometry(.22,10,8),gPanM=[M.dark,M.dark,M.dark,M.dark,new THREE.MeshBasicMaterial({map:speedTex,toneMapped:false}),M.dark];
const glowAm=new THREE.SpriteMaterial({blending:THREE.AdditiveBlending,depthWrite:false,map:sun.material.map,color:0xffa000});
const mkGantry=()=>{const g=new THREE.Group(),P=M.pole,dg=(x0,y0,x1,y1,z,t)=>{const o=bx(g,t,Math.hypot(x1-x0,y1-y0),t,(x0+x1)/2,(y0+y1)/2,z,P);o.rotation.z=Math.atan2(-(x1-x0),y1-y0);};
 for(const x of[-11,11]){bx(g,1.7,.3,1.7,x,.15,0,M.conc);bx(g,1.0,.06,1.0,x,.33,0,ZN);
  for(const sx of[-1,1])for(const sz of[-1,1]){bx(g,.14,8.1,.14,x+sx*.3,4.38,sz*.3,P);bx(g,.07,.12,.07,x+sx*.43,.42,sz*.43,ZN);}
  for(const z of[-.3,.3])for(let k=0;k<6;k++){const y0=.5+k*1.3,y1=y0+1.3;k%2?dg(x-.3,y1,x+.3,y0,z,.06):dg(x-.3,y0,x+.3,y1,z,.06);}
  for(let k=0;k<=6;k++)for(const z of[-.3,.3])bx(g,.6,.05,.05,x,.5+k*1.3,z,P);}
 bx(g,.52,1.3,.72,-10.3,1.15,0,ZN);bx(g,.02,.5,.4,-10.03,1.25,0,DK);
 for(const z of[-.3,.3]){bx(g,22.8,.11,.11,0,8.4,z,P);bx(g,22.8,.11,.11,0,7.6,z,P);
  for(let i=0;i<11;i++){const x0=-11.4+i*2.0727,x1=x0+2.0727;i%2?dg(x0,8.4,x1,7.6,z,.07):dg(x0,7.6,x1,8.4,z,.07);bx(g,.08,.8,.08,x0,8,z,P);}bx(g,.08,.8,.08,11.4,8,z,P);}
 for(let i=0;i<=11;i+=2){const x=-11.4+i*2.0727;bx(g,.07,.07,.6,x,8.4,0,P);bx(g,.07,.07,.6,x,7.6,0,P);}
 bx(g,22.8,.12,.12,0,8.9,0,P);bx(g,22.8,.08,.08,0,8.65,0,P);
 for(let i=0;i<9;i++)bx(g,.08,.5,.08,-10+i*2.5,8.65,0,P);
 bx(g,8.4,2.1,.2,0,6.2,0,P);
 const pm=new THREE.Mesh(geo(8.2,1.9,.3),gPanM);pm.position.set(0,6.2,0);g.add(pm);
 for(const x of[-3.6,-1.2,1.2,3.6]){bx(g,.12,.55,.12,x,7.35,0,P);bx(g,.1,.1,.62,x,7.6,0,P);}
 bx(g,.1,.4,.1,5.6,7.35,0,P);bx(g,.36,.3,.8,5.6,7.0,0,M.dark);bx(g,.14,.14,.05,5.6,7.0,.42,M.glass);
 const lp=new THREE.Group();for(const x of[-10.4,0,10.4]){bx(g,.3,.14,.3,x,8.97,0,P);const s=new THREE.Mesh(gSph,M.amber);s.position.set(x,9.14,0);lp.add(s);const f=new THREE.Sprite(glowAm);f.scale.set(3.4,3.4,1);f.position.set(x,9.14,0);lp.add(f);}
 g.add(lp);g.userData.lamp=lp;return g;};
const signTex=cvs(128,128,(g)=>{g.clearRect(0,0,128,128);g.fillStyle='#c9210f';g.beginPath();g.moveTo(64,4);g.lineTo(124,116);g.lineTo(4,116);g.fill();g.fillStyle='#f4b81a';g.beginPath();g.moveTo(64,28);g.lineTo(104,102);g.lineTo(24,102);g.fill();
 g.fillStyle='#111';g.beginPath();g.arc(58,56,7,0,7);g.fill();g.fillRect(52,64,13,24);g.fillRect(40,82,28,6);g.save();g.translate(60,70);g.rotate(.8);g.fillRect(0,0,34,4);g.restore();});
const sgPole=new THREE.CylinderGeometry(.05,.056,3.9,10),sgPlane=new THREE.PlaneGeometry(1.7,1.7),sgPl=new THREE.PlaneGeometry(1.1,.28),sgCol=new THREE.CylinderGeometry(.078,.078,.09,10),sgLens=new THREE.SphereGeometry(.12,10,8);
const sgTri=(()=>{const s=new THREE.Shape();s.moveTo(0,.8);s.lineTo(.8,-.69);s.lineTo(-.8,-.69);const e=new THREE.ExtrudeGeometry(s,{depth:.05,bevelEnabled:false});e.translate(0,0,-.025);return e;})();
const sgF=new THREE.MeshBasicMaterial({map:signTex,transparent:true,alphaTest:.4}),sgB=new THREE.MeshBasicMaterial({map:signTex,transparent:true,alphaTest:.4,color:0x6a6a70}),sgPlM=new THREE.MeshBasicMaterial({map:plateTex("A728BK 102")});
const mkSign=side=>{const g=new THREE.Group();const p=new THREE.Mesh(sgPole,M.pole);p.position.y=1.95;g.add(p);
 bx(g,.7,.12,.7,0,.06,0,M.conc);bx(g,.4,.04,.4,0,.14,0,ZN);for(const sx of[-1,1])for(const sz of[-1,1])bx(g,.05,.07,.05,sx*.15,.19,sz*.15,ZN);
 for(const y of[.75,1.7]){const c=new THREE.Mesh(sgCol,ZN);c.position.y=y;g.add(c);}
 const t=new THREE.Mesh(sgTri,ZN);t.position.y=2.95;g.add(t);
 const f=new THREE.Mesh(sgPlane,sgF);f.position.set(0,2.95,.03);g.add(f);const b=new THREE.Mesh(sgPlane,sgB);b.rotation.y=Math.PI;b.position.set(0,2.95,-.03);g.add(b);
 bx(g,.13,.1,.2,0,2.5,0,ZN);bx(g,.13,.1,.2,0,3.3,0,ZN);
 bx(g,.1,.1,.1,0,3.93,0,ZN);const lp=new THREE.Group(),l=new THREE.Mesh(sgLens,M.amber);l.position.y=4.05;lp.add(l);const gs=new THREE.Sprite(glowAm);gs.scale.set(2,2,1);gs.position.y=4.05;lp.add(gs);g.add(lp);g.userData.lamp=lp;
 bx(g,1.16,.34,.04,0,1.2,.03,M.dark);const q=new THREE.Mesh(sgPl,sgPlM);q.position.set(0,1.2,.06);g.add(q);
 g.position.x=side*10.3;return g;};

/* extruded side profiles (Chaikin-smoothed) -> rounded car bodies */
const chai=(p,n)=>{for(;n--;){const q=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];q.push([a[0]*.75+b[0]*.25,a[1]*.75+b[1]*.25],[a[0]*.25+b[0]*.75,a[1]*.25+b[1]*.75]);}p=q;}return p;};
const ex=(pts,w,bev)=>{pts=chai(pts,2);const s=new THREE.Shape();pts.forEach((p,i)=>i?s.lineTo(p[0],p[1]):s.moveTo(p[0],p[1]));
 const g=new THREE.ExtrudeGeometry(s,{depth:w,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:4,steps:1});
 g.rotateY(-Math.PI/2);g.computeBoundingBox();g.translate(-(g.boundingBox.max.x+g.boundingBox.min.x)/2,0,0);return g;};
const glowR=new THREE.SpriteMaterial({blending:THREE.AdditiveBlending,depthWrite:false,map:sun.material.map,color:0xff2a10});
const glow=(g,x,y,z,s,m)=>{const p=new THREE.Sprite(m||glowR);p.scale.set(s,s,1);p.position.set(x,y,z);g.add(p);return p;};
const exG=new THREE.CylinderGeometry(.065,.065,.25,12);exG.rotateX(Math.PI/2);
const CT={
 0:{L:2.15,bw:1.86,cw:1.6,ry:1.5,b:[[-2.15,.3],[-2.15,.66],[-1.9,.82],[-.9,.96],[1.3,1.02],[2.1,.97],[2.15,.8],[2.15,.3]],c:[[-.85,.95],[-.3,1.5],[1.05,1.5],[1.6,.98]]},
 2:{L:2.15,bw:1.92,cw:1.5,ry:1.3,b:[[-2.15,.28],[-2.15,.58],[-1.5,.78],[-.6,.9],[1.4,.96],[2.1,.93],[2.15,.75],[2.15,.28]],c:[[-.55,.9],[.1,1.3],[1.0,1.3],[1.65,.95]]},
 3:{L:2.0,bw:1.84,cw:1.6,ry:1.52,b:[[-2,.3],[-2,.66],[-1.75,.8],[-.85,.94],[2,.98],[2,.3]],c:[[-.75,.93],[-.2,1.52],[1.6,1.52],[2,.98]]},
 4:{L:2.15,bw:2.0,cw:1.8,ry:1.85,b:[[-2.15,.38],[-2.15,.9],[-1.9,1.06],[-.9,1.16],[2.15,1.2],[2.15,.38]],c:[[-.95,1.15],[-.4,1.85],[2.0,1.85],[2.15,1.2]]},
 5:{L:2.5,bw:1.94,cw:1.8,ry:2.0,b:[[-2.5,.34],[-2.5,.95],[-2.3,1.12],[-1.2,1.2],[2.5,1.24],[2.5,.34]],c:[[-1.35,1.18],[-.85,2.0],[2.4,2.0],[2.5,1.3]]}};
const wetG=new THREE.PlaneGeometry(2.4,4.6);wetG.rotateX(-Math.PI/2);
const wetM=new THREE.MeshBasicMaterial({map:sun.material.map,color:0xff2210,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false});
const arrowTx=m=>new THREE.MeshBasicMaterial({toneMapped:false,map:cvs(128,64,(g,w,h)=>{g.fillStyle='#050505';g.fillRect(0,0,w,h);if(m===1){g.translate(w,0);g.scale(-1,1);}
 g.fillStyle=m===2?'#ff3020':'#ffb100';const d=(x,y)=>{g.beginPath();g.arc(x,y,3.6,0,7);g.fill();};
 if(m===2){for(let k=-3;k<=3;k++){d(64+k*10,32+k*9);d(64+k*10,32-k*9);}}
 else{for(let x=26;x<=106;x+=10)d(x,32);for(let k=1;k<=3;k++)for(const q of[-1,1])d(26+k*9,32+q*k*9);}})});
const arrowG=new THREE.PlaneGeometry(1.64,.78),arrowM=arrowTx(0);
const arrowMR=arrowTx(1),arrowMX=arrowTx(2);
const headM=new THREE.MeshBasicMaterial({color:0xfff2cc});
function mkCar(hue,pl,ty){const g=new THREE.Group(),tex=plateTex(pl),gl=[];g.userData.tex=tex;
 const bm=MP({color:new THREE.Color().setHSL(hue/360,.85,.5),roughness:.3,metalness:.55,clearcoat:1,clearcoatRoughness:.04}),tm=new THREE.MeshBasicMaterial({color:0xb01a0c});
 let py,pz,sh,Lr;
 if(ty!==1){const c=CT[ty]||CT[0],L=c.L,u1=c.c[1][0],u2=c.c[2][0],bw=c.bw,uz=(u1+u2)/2,hw=bw/2+.07,cy=c.c[0][1],van=ty===5;Lr=L;
  g.add(new THREE.Mesh(c.bg||(c.bg=ex(c.b,bw,.07)),bm));g.add(new THREE.Mesh(c.cg||(c.cg=ex(c.c,c.cw,.05)),M.glass));
  bx(g,c.cw-.04,.05,u2-u1+.05,0,c.ry+.02,uz,bm);
  if(ty===0||ty===4){bx(g,c.cw-.55,.012,.75,0,c.ry+.055,uz,M.glass);bx(g,.02,.4,.02,.55,c.ry+.22,u2-.1,M.dark);}
  if(ty===3){bx(g,c.cw-.1,.05,.3,0,c.ry-.02,u2+.12,bm);for(const x of[-1,1])bx(g,.05,.16,.28,x*(c.cw/2-.1),c.ry-.1,u2+.12,bm);}
  if(ty===4)for(const x of[-1,1]){bx(g,.05,.06,u2-u1-.3,x*(c.cw/2-.1),c.ry+.08,uz,M.dark);for(const z of[u1+.4,u2-.4])bx(g,.05,.06,.07,x*(c.cw/2-.1),c.ry+.04,z,M.dark);}
  if(!van){const dz=c.c[3][0]-u2,dy=c.c[3][1]-c.ry,l=Math.hypot(dz,dy);
   for(const x of[-1,1]){const px=x*(c.cw/2+.04);bx(g,.07,c.ry-cy,.08,px,(c.ry+cy)/2,uz-.05,bm);const o=bx(g,.07,l,.08,px,(c.ry+c.c[3][1])/2,(u2+c.c[3][0])/2,bm);o.rotation.x=Math.atan2(dz,dy);}}
  else{bx(g,.5,.1,.5,0,c.ry+.07,.9,M.dark);
   for(const x of[-1,1])bx(g,.05,.8,2.8,x*(c.cw/2+.015),1.6,.95,bm);
   bx(g,bw-.16,.8,.06,0,1.6,L+.06,bm);for(const x of[-1,1])bx(g,.7,.3,.04,x*.42,1.85,L+.1,M.glass);bx(g,.02,.8,.02,0,1.6,L+.095,M.dark);bx(g,.12,.05,.04,.1,1.5,L+.1,M.rim);}
  for(const x of[-1,1]){const sx=x*(hw+.006);bx(g,.02,.46,.025,sx,.64,uz-.05,M.dark);bx(g,.02,.4,.025,sx,.64,u1-.12,M.dark);bx(g,.02,.4,.025,sx,.64,uz+.9,M.dark);
   bx(g,.03,.035,.2,x*(hw+.015),cy-.14,uz-.3,M.rim);bx(g,.03,.035,.2,x*(hw+.015),cy-.14,uz+.45,M.rim);}
  bx(g,bw-.1,.3,2*L-.4,0,.28,0,M.dark);
  bx(g,bw+.02,.2,.16,0,.44,L,M.dark);bx(g,bw+.02,.2,.16,0,.44,-L,M.dark);
  bx(g,bw-.3,.04,.03,0,.36,L+.1,M.rim);bx(g,bw-.5,.1,.1,0,.3,L+.06,M.dark);bx(g,.14,.05,.03,0,.8,L+.09,M.rim);
  bx(g,.95,.2,.05,0,.56,-L-.05,M.dark);bx(g,.95,.03,.05,0,.67,-L-.05,M.rim);
  bx(g,bw-.5,.03,.04,0,.87,L+.07,tm);
  for(const x of[-1,1]){const wx=x*(bw/2-.08),tx=x*(bw/2-.4);wheel(g,wx,.38,-L+.8,1);wheel(g,wx,.38,L-.8,1);
   bx(g,.1,.09,.2,x*(bw/2+.06),cy+.03,c.c[0][0]+.12,bm);bx(g,.06,.09,2*L-1.5,x*(bw/2+.06),.35,0,M.dark);
   bx(g,.64,.2,.05,tx,.84,L+.06,M.dark);bx(g,.54,.09,.05,tx,.87,L+.075,tm);bx(g,.54,.045,.05,tx,.76,L+.075,M.amber);gl.push(glow(g,tx,.84,L+.16,1.4));
   bx(g,.2,.05,.03,x*(bw/2-.2),.44,L+.09,rflM);
   bx(g,.42,.11,.06,x*(bw/2-.38),.72,-L-.02,headM);
   const e=new THREE.Mesh(exG,M.rim);e.position.set(x*.55,.3,L+.05);g.add(e);}
  if(ty===2){bx(g,1.75,.05,.42,0,1.22,L-.2,bm);for(const x of[-.65,.65])bx(g,.06,.22,.18,x,1.09,L-.2,M.dark);for(const x of[-.88,.88])bx(g,.04,.14,.44,x,1.2,L-.2,M.dark);}
  py=.64;pz=L+.06;sh=[bw+.7,2*L+.8];}
 else{const bed=M.bed;Lr=4.1;
  bx(g,2.1,.4,9,0,.65,-.4,M.dark);
  bx(g,2.4,2.2,2.2,0,1.9,-3.8,bm);bx(g,2.2,.8,.06,0,2.5,-4.92,M.glass);bx(g,2.44,.7,1.2,0,2.55,-3.6,M.glass);bx(g,2.5,.25,.2,0,.9,-4.95,M.dark);
  bx(g,1.8,.1,.15,0,3.05,-4.45,M.amber);bx(g,.5,.18,.3,0,3.1,-3.5,M.amber);glow(g,0,3.25,-3.5,3,glowAm);
  bx(g,.16,1.6,.16,1.3,2.9,-2.65,M.rim);
  bx(g,2.5,1.5,6.2,0,1.9,1.0,bed);
  for(const z of[-1.6,0,1.6,3.2])bx(g,2.58,1.4,.1,0,1.9,z,M.dark);
  bx(g,2.62,.15,6.3,0,2.7,1.0,M.dark);bx(g,2.5,1.0,.08,0,1.55,4.12,SM);
  bx(g,2.45,.16,.14,0,.62,4.3,M.dark);for(const x of[-1,1]){bx(g,.34,.07,.03,x*.95,.62,4.39,rflM);for(const z of[-1,.5,2,3.5])bx(g,.05,.07,.14,x*1.36,.95,z,M.amber);
   bx(g,.1,.45,.2,x*1.45,2.45,-4.5,M.dark);bx(g,.3,.05,.05,x*1.3,2.5,-4.5,M.dark);}
  for(const x of[-.7,.7])bx(g,.08,.5,.08,x,3.0,4.0,M.dark);bx(g,1.8,.95,.1,0,3.55,4.05,M.dark);
  const ar=new THREE.Mesh(arrowG,arrowM);ar.position.set(0,3.55,4.12);g.add(ar);ar.userData.keep=1;g.userData.arrow=ar;
  for(const x of[-1.15,1.15]){for(const z of[-3.8,2.2,3.3])wheel(g,x,.5,z,1.35);bx(g,.6,.5,.04,x,.45,4.1,M.dark);bx(g,.1,.5,6,x*1.12,1.0,1.4,M.dark);bx(g,.5,.45,.04,x,.35,3.9,M.dark);
   bx(g,.46,.22,.05,x,.95,4.15,M.dark);bx(g,.38,.14,.05,x,.97,4.18,tm);bx(g,.38,.05,.05,x,.83,4.18,M.amber);gl.push(glow(g,x,.95,4.3,1.8));}
  py=1.2;pz=4.2;sh=[3.2,10.4];}
 const p=new THREE.Mesh(new THREE.PlaneGeometry(1,.27),new THREE.MeshBasicMaterial({map:tex}));p.position.set(0,py,pz);g.add(p);bx(g,1.08,.33,.02,0,py,pz-.02,M.dark);
 const s=new THREE.Mesh(new THREE.PlaneGeometry(sh[0],sh[1]),M.blk);s.rotation.x=-Math.PI/2;s.position.set(0,.03,ty===1?-.4:0);g.add(s);
 const wt=new THREE.Mesh(wetG,wetM);wt.position.set(0,.045,Lr+2.5);wt.scale.x=ty===1?1.3:(CT[ty]||CT[0]).bw/1.9;g.add(wt);
 const bk=on=>{tm.color.setHex(on?0xff6a48:0xb01a0c);for(const q of gl)q.scale.setScalar(on?2.6:1.3);};g.userData.brk=bk;bk(0);
 if(MOBILE)mergeStatic(g);return addSpin(g);}

/* ===== грузовик-трамплин ===== */
const rampSignTx=cvs(256,96,(g,w,h)=>{g.fillStyle='#ffb100';g.fillRect(0,0,w,h);g.fillStyle='#111';
 for(let i=-1;i<10;i++)for(const y of[0,h-12]){g.beginPath();g.moveTo(i*30,y+12);g.lineTo(i*30+14,y+12);g.lineTo(i*30+26,y);g.lineTo(i*30+12,y);g.fill();}
 g.font='900 38px Arial';g.textAlign='center';g.textBaseline='middle';g.fillText('ТРАМПЛИН',w/2,38);g.font='700 17px Arial';g.fillText('▲ ЗАЕЗД СЗАДИ ▲',w/2,70);});
const rampSignM=new THREE.MeshBasicMaterial({map:rampSignTx,toneMapped:false}),rampSignG=new THREE.PlaneGeometry(2.1,.79);
const rampTopTx=cvs(128,512,(g,w,h)=>{g.fillStyle='#2a2a30';g.fillRect(0,0,w,h);
 for(let i=0;i<700;i++){g.fillStyle='rgba(190,190,205,.16)';g.fillRect(rnd(14,w-14),rnd(0,h),4,1.5);}
 g.fillStyle='#ffb100';g.fillRect(0,0,12,h);g.fillRect(w-12,0,12,h);g.fillStyle='#111';for(let y=0;y<h;y+=32){g.fillRect(0,y,12,16);g.fillRect(w-12,y,12,16);}
 g.strokeStyle='#ffb100';g.lineWidth=11;g.lineJoin='miter';for(let k=0;k<6;k++){const y=50+k*78;g.beginPath();g.moveTo(26,y+30);g.lineTo(64,y);g.lineTo(102,y+30);g.stroke();}});
const rampTopM=new THREE.MeshStandardMaterial({map:rampTopTx,emissiveMap:rampTopTx,emissive:0xffffff,emissiveIntensity:.3,roughness:.5,metalness:.45});
const rampMats=[M.dark,M.dark,rampTopM,M.dark,M.dark,M.dark];
const rampPaint=MP({color:0xe8601a,roughness:.28,metalness:.55,clearcoat:1,clearcoatRoughness:.05,envMapIntensity:1.3});
const deckM=MS(0x2c2c33,.45,.65);
const rampStackG=new THREE.CylinderGeometry(.07,.07,2.1,10),rampTankG=(q=>{q.rotateX(Math.PI/2);return q;})(new THREE.CylinderGeometry(.34,.34,1.5,16));
const rampCabP=[[-5.0,1.05],[-5.0,2.2],[-4.8,3.5],[-4.4,3.72],[-3.0,3.72],[-2.9,3.5],[-2.9,1.05]];
let rampCabG=null;
const mkRamp=()=>{const g=new THREE.Group(),P=rampPaint,tm=M.tail;
 if(!rampCabG)rampCabG=ex(rampCabP,2.34,.07);
 g.add(new THREE.Mesh(rampCabG,P));
 /* рама */
 for(const x of[-.8,.8])bx(g,.26,.32,6.6,x,.74,-1.7,M.dark);
 for(const z of[-4.2,-2.6,-1.2,.2,1.3])bx(g,1.9,.18,.22,0,.7,z,M.dark);
 /* подплатформенный каркас */
 bx(g,2.1,.65,3.6,0,1.33,-.95,M.dark);for(const x of[-1,1])bx(g,.04,.5,3.4,x*1.07,1.33,-.95,M.orange);
 /* кабина */
 bx(g,2.18,1.22,.05,0,2.88,-4.91,M.glass).rotation.x=.15;
 bx(g,1.5,.8,.07,0,1.62,-5.1,M.dark);for(const y of[1.4,1.6,1.8])bx(g,1.4,.05,.03,0,y,-5.15,M.rim);
 bx(g,2.55,.34,.3,0,.92,-5.0,M.dark);bx(g,2.56,.12,.31,0,.92,-5.02,SM);
 bx(g,2.0,.5,.5,0,4.0,-3.1,P);bx(g,1.5,.1,.3,0,3.88,-4.3,M.dark);bx(g,1.4,.1,.2,0,3.78,-4.3,M.dark);
 for(const x of[-1,1]){
  bx(g,.05,.95,1.35,x*1.25,2.85,-4.05,M.glass);
  bx(g,.04,1.7,.04,x*1.255,2.1,-3.35,M.dark);bx(g,.04,.04,1.3,x*1.255,1.25,-4.1,M.dark);bx(g,.05,.05,.28,x*1.27,2.25,-3.55,M.rim);
  bx(g,.09,.2,.5,x*1.3,.82,-4.15,M.dark);
  bx(g,.05,.5,.05,x*1.37,3.0,-4.75,M.pole);bx(g,.14,.62,.34,x*1.52,3.0,-4.7,M.dark);
  bx(g,.46,.28,.06,x*.88,1.98,-5.1,headM);bx(g,.46,.09,.06,x*.88,1.74,-5.1,M.amber);bx(g,.16,.14,.05,x*1.0,1.2,-5.1,headM);}
 /* мигалки: крыша кабины и оголовок */
 const lp=new THREE.Group(),lp2=new THREE.Group(),spl=(grp,x,y,z,s)=>{const o=new THREE.Mesh(gSph,M.amber);o.position.set(x,y,z);grp.add(o);const f=new THREE.Sprite(glowAm);f.scale.set(s,s,1);f.position.set(x,y,z);grp.add(f);};
 for(const x of[-.55,-.18,.18,.55])spl(lp,x,3.99,-4.3,2.6);
 for(const x of[-1.12,1.12]){bx(g,.14,.12,.14,x,3.44,-2.7,M.dark);spl(lp2,x,3.62,-2.7,3.0);}
 g.add(lp,lp2);g.userData.lamp=lp;g.userData.lamp2=lp2;
 /* оголовок с табличкой */
 for(const x of[-1.15,1.15])bx(g,.12,1.5,.12,x,2.65,-2.7,M.pole);
 bx(g,2.4,.1,.14,0,3.35,-2.7,M.pole);bx(g,2.3,.95,.08,0,2.62,-2.7,M.pole);
 const sgn=new THREE.Mesh(rampSignG,rampSignM);sgn.position.set(0,2.62,-2.65);g.add(sgn);
 /* платформа */
 bx(g,2.5,.16,3.85,0,1.82,-.925,deckM);
 for(const z of[-2.4,-1.8,-1.2,-.6,0,.6])bx(g,2.3,.02,.07,0,1.91,z,M.pole);
 for(const x of[-1,1]){bx(g,.1,.38,3.85,x*1.27,1.68,-.925,M.orange);bx(g,.03,.06,3.6,x*1.33,1.7,-.925,rflM);
  for(const z of[-2.4,-1.4,-.4,.6])bx(g,.05,.07,.12,x*1.33,1.58,z,M.amber);}
 bx(g,2.5,.18,.2,0,1.88,1.0,ZN);
 /* колёса, крылья, баки, трубы */
 for(const x of[-1,1]){const wx=x*1.15;wheel(g,wx,.5,-3.95,1.35);for(const z of[-.25,1.1]){wheel(g,wx,.5,z,1.35);wheel(g,x*.72,.5,z,1.35);}
  bx(g,.5,.07,2.9,wx,1.1,.42,M.dark);bx(g,.5,.07,1.3,wx,1.1,-3.95,M.dark);
  bx(g,.55,.5,.04,wx,.62,1.75,M.dark);bx(g,.4,.08,.05,wx,.5,1.78,rflM);
  const tk=new THREE.Mesh(rampTankG,ZN);tk.position.set(x*1.0,.9,-2.1);g.add(tk);
  const stk=new THREE.Mesh(rampStackG,M.rim);stk.position.set(x*1.12,2.75,-2.95);g.add(stk);
  bx(g,.1,.7,.1,x*1.18,2.25,.85,M.pole);bx(g,.2,.15,.12,x*1.18,2.68,.85,tm);bx(g,.2,.09,.12,x*1.18,2.52,.85,M.amber);bx(g,.2,.06,.1,x*1.18,2.4,.85,rflM);
  glow(g,x*1.18,2.68,1.0,1.8);
  link(g,[x*.75,1.5,.4],[x*.75,1.15,1.65],.13,ZN);link(g,[x*.75,1.15,1.65],[x*.75,.82,2.9],.07,M.rim);}
 /* сам трамплин */
 const rp=new THREE.Group();rp.position.set(0,.97,2.65);rp.rotation.x=.495;g.add(rp);
 bx(rp,2.4,.14,3.75,0,0,0,rampMats);
 for(const x of[-1,1]){bx(rp,.12,.26,3.75,x*1.26,.1,0,M.orange);bx(rp,.04,.05,3.6,x*1.26,.26,0,M.amber);glow(rp,x*1.26,.4,1.85,1.8,glowAm);}
 for(const z of[-1.5,0,1.5])bx(rp,2.3,.14,.1,0,-.12,z,M.dark);
 bx(rp,2.4,.06,.4,0,-.06,1.95,SM);
 /* тень и свет у основания */
 const sh=new THREE.Mesh(new THREE.PlaneGeometry(3.4,10.8),M.blk);sh.rotation.x=-Math.PI/2;sh.position.set(0,.03,-.4);g.add(sh);
 glow(g,0,.2,4.5,3.4,glowAm);
 if(MOBILE)mergeStatic(g);return addSpin(g);};
const coneG=new THREE.CylinderGeometry(.07,.27,.72,20),cb1=new THREE.CylinderGeometry(.187,.22,.12,20),cb2=new THREE.CylinderGeometry(.132,.16,.1,20);
const CM=new THREE.MeshStandardMaterial({color:0xe8501a,roughness:.45,emissive:0x3a1000}),CW=new THREE.MeshStandardMaterial({color:0xf4f4f4,roughness:.3,emissive:0x303030});
const mkCone=()=>{const g=new THREE.Group();bx(g,.7,.06,.7,0,.03,0,M.dark);
 for(const[geom,m,y]of[[coneG,CM,.42],[cb1,CW,.32],[cb2,CW,.53]]){const o=new THREE.Mesh(geom,m);o.position.y=y;g.add(o);}return g;};

/* roadside pools */
const barr=[],cones=[],pines=[],lamps=[];
const jp=new THREE.Shape();[[-.35,0],[.35,0],[.3,.35],[.14,.9],[-.14,.9],[-.3,.35]].forEach((p,i)=>i?jp.lineTo(p[0],p[1]):jp.moveTo(p[0],p[1]));
const jg=new THREE.ExtrudeGeometry(jp,{depth:3.9,bevelEnabled:false});jg.translate(0,0,-1.95);
for(let i=0;i<75;i++){const m=new THREE.Mesh(jg,i%2?M.conc:M.orange);m.position.set(8.9,0,20-i*4);scene.add(m);barr.push(m);}
for(let i=0;i<30;i++){const c=mkCone();c.position.set(-8.7,0,20-i*10);scene.add(c);cones.push(c);}
const lampGlow=new THREE.SpriteMaterial({blending:THREE.AdditiveBlending,depthWrite:false,map:sun.material.map,color:0xffa84a});
const lpM=MS(0x4a4850,.45,.7),lpC=new THREE.CylinderGeometry(.1,.17,8.2,12),lpB=new THREE.CylinderGeometry(.24,.31,.95,8),lpF=new THREE.CylinderGeometry(.37,.37,.06,12),lpK=new THREE.CylinderGeometry(.19,.19,.12,12),lpCap=new THREE.ConeGeometry(.11,.26,10),
 lpL=new THREE.PlaneGeometry(1.08,.36),lpLM=new THREE.MeshBasicMaterial({color:0xffc060}),lpV=a=>new THREE.Vector3(a[0],a[1],0),
 lpArm=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0,7.7],[.25,8.35],[.9,8.8],[1.8,9.05],[2.6,9.12]].map(lpV)),20,.065,8),
 lpStr=new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[0,7.0],[.7,7.9],[1.5,8.75]].map(lpV)),10,.035,6),
 lpPool=new THREE.PlaneGeometry(13,13),lpCone=new THREE.ConeGeometry(3.4,8.9,18,1,true);lpPool.rotateX(-Math.PI/2);
const lpPoolM=new THREE.MeshBasicMaterial({map:sun.material.map,color:0xff9a40,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false}),
 lpConeM=new THREE.MeshBasicMaterial({color:0xffa040,transparent:true,opacity:.055,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
for(let i=0;i<10;i++){const g=new THREE.Group(),m=(q,y,mt,s)=>{const o=new THREE.Mesh(q,mt||lpM);o.position.y=y;if(s)o.scale.set(s,1,s);g.add(o);return o;};
 bx(g,.9,.2,.9,0,.1,0,M.conc);m(lpF,.24,ZN);for(const sx of[-1,1])for(const sz of[-1,1])bx(g,.07,.1,.07,sx*.3,.32,sz*.3,ZN);
 m(lpB,.75).rotation.y=Math.PI/8;bx(g,.03,.5,.22,.27,.72,0,DK);bx(g,.04,.06,.05,.29,.72,.07,ZN);
 m(lpC,4.2);m(lpK,1.25,ZN);m(lpK,4.5,ZN,.85);m(lpK,7.2,ZN,.68);bx(g,.1,.4,.18,.19,2.3,0,DK);m(lpCap,8.43);
 g.add(new THREE.Mesh(lpArm,lpM),new THREE.Mesh(lpStr,lpM));
 bx(g,1.3,.2,.5,2.95,9.16,0,lpM);bx(g,1.36,.06,.56,2.95,9.04,0,DK);bx(g,1.1,.08,.4,2.95,9.31,0,DK);bx(g,.34,.1,.3,2.5,9.38,0,DK);bx(g,.08,.1,.08,3.3,9.4,0,ZN);bx(g,.3,.16,.22,2.35,9.12,0,ZN);
 const u=new THREE.Mesh(lpL,lpLM);u.rotation.x=Math.PI/2;u.position.set(2.95,9.0,0);g.add(u);
 glow(g,2.95,8.7,0,8,lampGlow);
 if(!MOBILE){const pl=new THREE.Mesh(lpPool,lpPoolM);pl.position.set(2.95,.05,0);g.add(pl);const cn=new THREE.Mesh(lpCone,lpConeM);cn.position.set(2.95,4.55,0);g.add(cn);}
 if(MOBILE)mergeStatic(g);g.position.set(-9.7,0,20-i*30);scene.add(g);cones.push(g);lamps.push(g);}
/* delineator posts on the concrete barrier */
{const dlG=new THREE.CylinderGeometry(.045,.055,.95,8),dlB=new THREE.CylinderGeometry(.057,.057,.16,8),dlR=new THREE.BoxGeometry(.1,.14,.03),dlM=MS(0xf2f2ee,.5),dlK=MS(0x111114,.6);
 for(let i=0;i<30;i++){const g=new THREE.Group(),a=(q,mt,y,z)=>{const o=new THREE.Mesh(q,mt);o.position.set(0,y,z||0);g.add(o);};
  a(dlG,dlM,.48);a(dlB,dlK,.3);a(dlB,dlK,.62);a(dlR,rflM,.82,.055);g.position.set(8.9,.9,20-i*10);scene.add(g);cones.push(g);}}
/* 2D painted backdrop: far skyline + billboard trees/houses */
const bd=new THREE.Mesh(new THREE.PlaneGeometry(1000,190),new THREE.MeshBasicMaterial({fog:false,transparent:true,depthWrite:false,toneMapped:false,map:cvs(1024,256,(g,w,h)=>{
 const B=h*.73;g.fillStyle='#4a2a3e';g.beginPath();g.moveTo(0,h);for(let x=0;x<=w;x+=8)g.lineTo(x,B-12-Math.sin(x*.011)*12-Math.sin(x*.041)*6);g.lineTo(w,h);g.fill();
 for(let x=0;x<w;){const bw=rnd(14,36),bh=rnd(14,62);g.fillStyle=pick(['#2a1a2f','#241628','#33203a']);g.fillRect(x,B-bh,bw,bh+h);
  g.fillStyle='rgba(255,160,70,.5)';g.fillRect(x+bw-2,B-bh,2,bh);for(let k=0;k<bh/7;k++)if(Math.random()<.3){g.fillStyle='rgba(255,190,100,.85)';g.fillRect(x+rnd(3,bw-5),B-bh+k*7+2,2,3);}x+=bw+rnd(0,4);}
 const hz=g.createLinearGradient(0,B-40,0,B+6);hz.addColorStop(0,'rgba(92,51,56,0)');hz.addColorStop(1,'rgba(92,51,56,1)');g.fillStyle=hz;g.fillRect(0,B-40,w,h);
 g.fillStyle='#5c3338';g.fillRect(0,B+6,w,h);})}));
bd.position.set(0,50,-430);scene.add(bd);
const treeT=[0,1].map(n=>cvs(128,256,(g,w,h)=>{g.fillStyle='#16100e';g.fillRect(60,190,8,66);
 for(let k=0;k<(n?4:5);k++){const y=14+k*(n?48:38),hw=(n?60:50)-k*(n?6:5),y2=y+(n?70:60);g.fillStyle='#0f1f17';g.beginPath();g.moveTo(64,y);g.lineTo(64+hw,y2);g.lineTo(64-hw,y2);g.fill();
  g.fillStyle='rgba(60,70,40,.55)';g.beginPath();g.moveTo(64,y);g.lineTo(64+hw,y2);g.lineTo(64+hw*.4,y2);g.fill();
  g.strokeStyle='rgba(255,150,70,.75)';g.lineWidth=2;g.beginPath();g.moveTo(64,y);g.lineTo(64+hw,y2);g.stroke();}}));
const houseT=[0,1].map(n=>cvs(128,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,n?'#3a2638':'#2f2236');gr.addColorStop(1,'#1c1420');g.fillStyle=gr;g.fillRect(8,10,112,h-10);
 g.fillStyle='#14101a';g.fillRect(4,2,120,10);g.fillStyle='rgba(255,150,70,.7)';g.fillRect(118,10,3,h);
 for(let y=26;y<h-14;y+=22)for(let x=18;x<108;x+=24){g.fillStyle=Math.random()<.4?`rgba(255,${180+ri(50)},${100+ri(50)},.95)`:'#1f1a2a';g.fillRect(x,y,14,12);}}));
const fol=[0x2f5a35,0x3a6a3c,0x4f6a2c,0xa0602a].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.85,flatShading:true})),tM=MS(0x3a2418,1);
const tkG=new THREE.CylinderGeometry(.3,.45,2.6,6),tiG=[0,1,2,3,4,5].map(i=>new THREE.ConeGeometry(2.8-i*.4,3.2,7)),blG=new THREE.IcosahedronGeometry(1,1),tk2=new THREE.CylinderGeometry(.35,.55,3.6,7);
const LB=[[0,5.2,0,2.4],[1.5,4.4,.5,1.8],[-1.4,4.5,-.6,1.9],[.3,6.7,.4,1.7],[-.2,4.2,1.6,1.7],[.4,4.6,-1.5,1.6]];
const mkTree=()=>{const g=new THREE.Group(),f=pick(fol),k=rnd(.8,1.4);
 if(Math.random()<.6){const t=new THREE.Mesh(tkG,tM);t.position.y=1.3;g.add(t);tiG.forEach((q,i)=>{const c=new THREE.Mesh(q,f);c.position.y=2.6+i*1.5;c.rotation.y=i*.8;g.add(c);});}
 else{const t=new THREE.Mesh(tk2,tM);t.position.y=1.8;g.add(t);for(const l of LB){const o=new THREE.Mesh(blG,f);o.position.set(l[0],l[1],l[2]);o.scale.setScalar(l[3]*rnd(.85,1.1));o.rotation.set(rnd(0,3),rnd(0,3),0);g.add(o);}}
 if(MOBILE)mergeStatic(g);g.scale.set(k,k*rnd(.9,1.25),k);g.rotation.y=rnd(0,6.3);return g;};
const wtex=['#2a2030','#33242c','#222838'].map(c=>cvs(256,256,(g,w,h)=>{g.fillStyle=c;g.fillRect(0,0,w,h);for(let y=0;y<8;y++)for(let x=0;x<8;x++){g.fillStyle=Math.random()<.35?`rgb(255,${170+ri(60)},${90+ri(50)})`:'#14101a';g.fillRect(x*32+7,y*32+7,18,20);}}));
const roofM=MS(0x1a141c,.9),antM=MS(0x555058,.5,.6),redM=new THREE.MeshBasicMaterial({color:0xff2a20});
const mkBld=()=>{const w=rnd(12,22),h=rnd(24,62),d=rnd(12,22),g=new THREE.Group(),t=pick(wtex).clone();t.needsUpdate=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(w/16,h/16);
 const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({map:t,emissiveMap:t,emissive:0xffffff,emissiveIntensity:.8,roughness:.8}));m.position.y=h/2;g.add(m);
 bx(g,w+.8,.7,d+.8,0,h+.35,0,roofM);bx(g,w*.5,2.5,d*.5,rnd(-2,2),h+1.9,0,roofM);
 if(Math.random()<.6){const a=new THREE.Mesh(new THREE.CylinderGeometry(.08,.12,7,6),antM);a.position.set(w*.2,h+5,0);g.add(a);const l=new THREE.Mesh(new THREE.SphereGeometry(.3,8,6),redM);l.position.set(w*.2,h+8.6,0);g.add(l);}
 if(MOBILE)mergeStatic(g);return g;};
const put=(g,x,z)=>{g.position.set(x,0,z);pines.push(g);scene.add(g);};
const spots=[];
const spot=(x0,x1,r)=>{for(let k=0;k<300;k++){const x=(ri(2)?1:-1)*rnd(x0,x1),z=20-rnd(0,320);
 if(spots.every(q=>{let dz=Math.abs(z-q.z);dz=Math.min(dz,320-dz);return Math.hypot(x-q.x,dz)>=r+q.r;})){spots.push({x,z,r});return[x,z];}}return null;};
for(let i=0;i<(WEAK?4:MOBILE?8:16);i++){const p=spot(52,100,13);if(p)put(mkBld(),p[0],p[1]);}
for(let i=0;i<(WEAK?18:MOBILE?34:70);i++){const p=spot(17,36,4.4);if(p)put(mkTree(),p[0],p[1]);}
const wrap=(arr,dz,per)=>{for(const m of arr){m.position.z+=dz;if(m.position.z>20)m.position.z-=per;}};
/* rain + sparks */
const RN=260,rp=new Float32Array(RN*6);for(let i=0;i<RN;i++){const x=rnd(-20,20),y=rnd(0,14),z=rnd(-40,12);rp.set([x,y,z,x+.04,y+.7,z+.1],i*6);}
const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.BufferAttribute(rp,3));
const rain=new THREE.LineSegments(rg,new THREE.LineBasicMaterial({color:0xb8c4e0,transparent:true,opacity:.28}));rain.frustumCulled=false;scene.add(rain);
const SN=80,sp=new Float32Array(SN*3).fill(-999),sv=new Float32Array(SN*3),sl=new Float32Array(SN);let si=0;
const sg=new THREE.BufferGeometry();sg.setAttribute('position',new THREE.BufferAttribute(sp,3));
const sparks=new THREE.Points(sg,new THREE.PointsMaterial({color:0xffb347,size:.3,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false}));sparks.frustumCulled=false;scene.add(sparks);
const burst=(x,y,z,n,s)=>{for(let i=0;i<n;i++){const k=si++%SN;sp.set([x,y,z],k*3);sv.set([rnd(-s,s),rnd(1,s),rnd(-s,s)],k*3);sl[k]=rnd(.3,.8);}};

/* След за машиной (косметика ивента, opts.trail): пул матовых спрайтов, без свечения */
const TRN=28,TRS=[];let TRD=TRAIL[opts.trail],tri=0,trA=0;
if(TRD||opts.showroom){const tx0=cvs(32,32,g=>{g.fillStyle='#fff';g.beginPath();g.arc(16,16,15,0,7);g.fill();});for(let i=0;i<TRN;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tx0,transparent:true,depthWrite:false,opacity:0}));m.visible=false;m.userData={l:0,m:1};scene.add(m);TRS.push(m);}}
const trailTick=dt=>{if(!TRD)return;if(st==='play'){trA-=dt;while(trA<=0){trA+=.05;const m=TRS[tri++%TRN];m.material.color.set(Array.isArray(TRD.c)?TRD.c[tri&1]:TRD.c);m.position.set(P.x+rnd(-.5,.5),(P.y||0)+TRD.y,PHD+.2);m.userData={l:TRD.l,m:TRD.l};m.scale.set(TRD.s,TRD.s,1);m.visible=true;}}
 for(const m of TRS){if(!m.visible)continue;const u=m.userData;u.l-=dt;if(u.l<=0){m.visible=false;continue;}m.position.z+=v*dt;const k=1-u.l/u.m;m.scale.setScalar(TRD.s*(1+TRD.g*k));m.material.opacity=TRD.a*(1-k);if(TRD.y>.2)m.position.y+=dt*.6;}};

/* ================= HERO CAR (машина игрока) ================= */
const BODY0=[[-2.18,.70,.30,.48,2.6],[-2.14,.84,.28,.58,2.8],[-2.04,.91,.27,.66,2.9],[-1.85,.95,.26,.74,3],[-1.6,.96,.25,.82,3],[-1.1,.975,.25,.90,3.1],[-.6,.98,.25,.94,3.2],[-.2,.985,.25,.96,3.2],[.4,.99,.25,.97,3.2],[1.0,1.0,.25,.99,3.2],[1.5,1.0,.25,1.0,3.2],[1.85,.97,.26,1.0,3.2],[2.05,.94,.28,.99,3.3],[2.14,.89,.30,.96,3.6],[2.16,.84,.31,.94,3.8]];
const CAB0=[[-.8,.66,.92,.95,3],[-.6,.72,.90,1.12,3],[-.2,.78,.89,1.38,3.2],[.2,.80,.88,1.47,3.4],[.7,.80,.88,1.47,3.4],[1.05,.77,.88,1.38,3.2],[1.4,.72,.88,1.14,3],[1.68,.66,.90,.98,3],[1.7,.64,.92,.96,3]];
function loft(st,N,ox,bf){N=N||40;ox=ox||0;const pos=[],idx=[];
 const R=st.map(s=>{const[z,w,yb,yt,e]=s,ym=(yb+yt)/2,hh=(yt-yb)/2,p=[];for(let j=0;j<N;j++){const a=j/N*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);{const px=w*Math.sign(c)*Math.pow(Math.abs(c),2/e);p.push([ox+px,ym+hh*Math.sign(sn)*Math.pow(Math.abs(sn),2/e)+(bf?bf(z,px,sn):0),z]);}}return p;});
 R.forEach(r=>r.forEach(p=>pos.push(...p)));
 for(let i=0;i<R.length-1;i++)for(let j=0;j<N;j++){const j2=(j+1)%N,A=i*N+j,B=i*N+j2,C=(i+1)*N+j,D=(i+1)*N+j2;idx.push(A,B,C,B,D,C);}
 const cap=(i,fr)=>{const b0=pos.length/3,s=st[i];R[i].forEach(p=>pos.push(...p));pos.push(ox,(s[2]+s[3])/2,s[0]);const c=b0+N;for(let j=0;j<N;j++){const a=b0+j,b=b0+(j+1)%N;fr?idx.push(c,b,a):idx.push(c,a,b);}};
 cap(0,true);cap(R.length-1,false);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
const lerpSt=(st,z)=>{if(z<=st[0][0])return st[0];for(let i=0;i<st.length-1;i++){const a=st[i],b=st[i+1];if(z<=b[0]){const k=(z-a[0])/((b[0]-a[0])||1);return a.map((v,q)=>v+(b[q]-v)*k);}}return st[st.length-1];};
const surf=(st,z,y)=>{const s=lerpSt(st,z),ym=(s[2]+s[3])/2,hh=(s[3]-s[2])/2,r=Math.min(.995,Math.abs((y-ym)/hh));return s[1]*Math.pow(1-Math.pow(r,s[4]),1/s[4]);};
const topY=(st,z)=>lerpSt(st,z)[3];
const link=(g,a,b,t,m,t2)=>{const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),o=new THREE.Mesh(new THREE.BoxGeometry(t,t2||t,A.distanceTo(B)),m);o.position.copy(A).add(B).multiplyScalar(.5);o.lookAt(B);g.add(o);return o;};
const sm=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const bumpY=(z,x,n)=>{if(n<=0)return 0;const ax=Math.abs(x),rh=.1*sm(-2.15,-1.8,z)*(1-sm(-1.2,-.5,z)),dh=.04*sm(-2.05,-1.7,z)*(1-sm(-1.1,-.6,z));return n*(rh*Math.exp(-Math.pow((ax-.68)/.17,2))-dh*Math.exp(-Math.pow(ax/.3,2)));};
const hyS=(st,x,z)=>{const t=lerpSt(st,z),ym=(t[2]+t[3])/2,hh=(t[3]-t[2])/2;return ym+hh*Math.pow(Math.max(0,1-Math.pow(Math.min(.995,Math.abs(x)/t[1]),t[4])),1/t[4])+bumpY(z,x,1);};
const spt=(st,z,a,k)=>{const q=lerpSt(st,z),ym=(q[2]+q[3])/2,hh=(q[3]-q[2])/2,c=Math.cos(a),n=Math.sin(a),e=2/q[4];return[q[1]*k*Math.sign(c)*Math.pow(Math.abs(c),e),ym+hh*k*Math.sign(n)*Math.pow(Math.abs(n),e),z];};
const mkPatch=(P,nu,nv,m)=>{const pos=[],idx=[],uv=[];for(let i=0;i<=nu;i++)for(let j=0;j<=nv;j++){pos.push(...P(i/nu,j/nv));uv.push(i/nu,j/nv);}for(let i=0;i<nu;i++)for(let j=0;j<nv;j++){const a=i*(nv+1)+j,c=a+nv+1;idx.push(a,a+1,c,a+1,c+1,c);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return new THREE.Mesh(g,m);};
const D=m=>(m.side=2,m);
const mkHero=(plate,o)=>{
 const hero=!o;o=o||{};const K=mkHero.K||(mkHero.K={}),sh1=(k,f)=>K[k]||(K[k]=f()),gm=(k,f)=>sh1('g_'+k,()=>{const q=f();q.userData.sh=1;return q;});
 const g=new THREE.Group(),S=new THREE.Group();g.add(S);const ud=g.userData;ud.tex=plateTex(plate,hero&&FRAME_C);if(!hero)ud.own=true;

 const V=o.v||{},vid=V.id||0,dk=V.dk||0,vc=V.cw||1;
 const BODY=hero?BODY0:BODY0.map(s=>{const z=s[0],wf=cl((-.4-z)/1.2,0,1),wr=cl((z-1)/.9,0,1);return[z,s[1]*(V.bw||1),s[2],s[3]+(V.hd||0)*wf+dk*wr,s[4]*(V.e||1)];});
 const CAB=hero?CAB0:CAB0.map(s=>[s[0],s[1]*vc,s[2],.95+(s[3]-.95)*(V.ch||1),s[4]]);
 /* materials */
 const HS=hero&&SKIN[opts.skin];const paint=MP({color:HS?new THREE.Color(HS.c):new THREE.Color().setHSL((o.h??212)/360,o.s??.9,o.l??.4),roughness:HS&&HS.rg!=null?HS.rg:(o.rg??.3),metalness:HS&&HS.mt!=null?HS.mt:(o.mtl??.7),clearcoat:1,clearcoatRoughness:o.cr??.03,envMapIntensity:1.4});
 const{cT,cW}=sh1('ct',()=>{const cT=cvs(64,64,(c,w,h)=>{c.fillStyle='#0b0b0d';c.fillRect(0,0,w,h);for(let y=0;y<16;y++)for(let x=0;x<16;x++){const a=(x+y)%2,gr=c.createLinearGradient(x*4,y*4,a?x*4+4:x*4,a?y*4:y*4+4);gr.addColorStop(0,'#33343a');gr.addColorStop(1,'#07070a');c.fillStyle=gr;c.fillRect(x*4,y*4,4,4);}});
 cT.wrapS=cT.wrapT=THREE.RepeatWrapping;const cW=cT.clone();cW.needsUpdate=true;cW.repeat.set(14,14);cT.repeat.set(2,2);return{cT,cW};});
 const{carbon,carbonW}=sh1('cm',()=>{const carbon=MP({map:cT,roughness:.4,metalness:.3,clearcoat:1,clearcoatRoughness:.08}),carbonW=MP({map:cW,roughness:.4,metalness:.3,clearcoat:1,clearcoatRoughness:.08});return{carbon,carbonW};});
 const glass=MP({color:0x0a121c,roughness:.03,metalness:.85,transparent:true,opacity:.82,envMapIntensity:1.6,clearcoat:1});
 const chrome=new THREE.MeshStandardMaterial({color:0xe2e6ed,roughness:.12,metalness:1,side:THREE.DoubleSide}),gloss=MS(0x050507,.25,.5),inner=MS(0x0b0c10,.9);
 const stripeM=MP({color:o.st??0xf1f4f8,roughness:.45,metalness:.1,clearcoat:.6,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
 const tailM=new THREE.MeshBasicMaterial({color:0xc41c0e}),ledM=new THREE.MeshBasicMaterial({color:0x2a0505});
 /* body shell, greenhouse, roof */
 S.add(new THREE.Mesh(gm('body'+vid,()=>loft(BODY,44,0,bumpY)),paint));
 S.add(new THREE.Mesh(gm('cab'+vid,()=>loft(CAB,48)),paint));
 const glT=sh1('glT',()=>cvs(256,256,(g,w,h)=>{const gr=g.createLinearGradient(0,0,0,h);gr.addColorStop(0,'#0d1824');gr.addColorStop(1,'#04070b');g.fillStyle=gr;g.fillRect(0,0,w,h);

  g.fillStyle='#000';const b=9;g.fillRect(0,0,w,b);g.fillRect(0,h-b,w,b);g.fillRect(0,0,b,h);g.fillRect(w-b,0,b,h);
  for(let k=0;k<3;k++)for(let x=0;x<w;x+=8){g.beginPath();g.arc(x+4,b+4+k*7,3-k,0,7);g.fill();g.beginPath();g.arc(x+4,h-b-4-k*7,3-k,0,7);g.fill();}}));
 const gl2=D(new THREE.MeshStandardMaterial({map:glT,roughness:.4,metalness:0,envMapIntensity:.35})),rub=D(MS(0x050507,.4,.2)),chW=D(MS(0xcfd3da,.2,1));
 const WP=(f,nu,nv)=>{for(const[g,k,m]of[[.042,1.004,chW],[.035,1.008,rub],[0,1.012,gl2]])S.add(mkPatch((u,v)=>f(u,v,g,k),nu,nv,m));};
 WP((u,v,g,k)=>spt(CAB,-.78+(.4+g)*v,(.55-1.2*g)+(Math.PI-1.1+2.4*g)*u,k),20,6);
 WP((u,v,g,k)=>spt(CAB,1.26-g+(.38+1.3*g)*v,(.72-1.2*g)+(Math.PI-1.44+2.4*g)*u,k),20,6);
 for(const q of[-1,1])WP((u,v,g,k)=>{const a=-.5+(.92+1.2*g)*u,z0=-.5+.35*u-g,z1=1.5-.35*u+g;return spt(CAB,z0+(z1-z0)*v,q>0?a:Math.PI-a,k);},12,24);

 const roofSt=[-.34,-.1,.2,.7,1.0,1.22].map(z=>{const s=lerpSt(CAB,z);return[z,s[1]*.9,s[3]-.1,s[3]+.014,3.2];});
 S.add(new THREE.Mesh(gm('roof'+vid,()=>loft(roofSt,36)),o.rf?carbon:paint));
 /* racing stripes */
 for(const q of(o.sq||[-1,1])){const ox=q*(o.sx??.17),ys=zs=>zs.map(z=>[z,.065,hyS(BODY,ox,z)-.014,hyS(BODY,ox,z)+.009,3]);
  S.add(new THREE.Mesh(gm('sa'+ox+vid,()=>loft(ys(Array.from({length:13},(_,i)=>-2.06+i*.1)),12,ox)),stripeM));
  S.add(new THREE.Mesh(gm('sb'+ox+vid,()=>loft(ys(Array.from({length:7},(_,i)=>1.52+i*.093)),12,ox)),stripeM));
  S.add(new THREE.Mesh(gm('sc'+ox+vid,()=>loft(roofSt.slice(1,5).map(s=>[s[0],.065,s[3]-.012,s[3]+.004,3]),12,ox)),stripeM));}
 /* sides: door cuts, handles, vents, skirts, wells, mirrors, hood vents */
 const dkM=D(MS(0x07080c,.5,.3)),chM=D(MS(0xc9ccd4,.2,1)),vtM=D(MS(0x0d0d11,.4,.6)),amM=new THREE.MeshBasicMaterial({color:0xffb100,side:2});
 const sideP=(q,z0,z1,y0,y1,k,m)=>S.add(mkPatch((u,v)=>{const z=z0+(z1-z0)*u,y=y0+(y1-y0)*v;return[q*(surf(BODY,z,y)+k),y,z];},Math.max(2,Math.ceil((z1-z0)/.12)),Math.max(1,Math.ceil((y1-y0)/.08)),m));
 const hy=(x,z)=>hyS(BODY,x,z);
 const topP=(f,nu,nv,k,m)=>S.add(mkPatch((u,v)=>{const[x,z]=f(u,v);return[x,hy(x,z)+k,z];},nu,nv,m));
 for(const q of[-1,1]){
  sideP(q,-.62,-.6,.4,.9,.01,dkM);sideP(q,.43,.45,.4,.93,.01,dkM);sideP(q,-.6,.45,.4,.412,.01,dkM);
  sideP(q,.12,.34,.83,.86,.014,chM);sideP(q,-.95,.95,.28,.37,.011,dkM);sideP(q,-1.78,-1.7,.55,.6,.012,amM);
  for(let i=0;i<3;i++)sideP(q,-1.12,-.78,.58+i*.055,.6+i*.055,.012,dkM);
  link(S,[q*.72,1.0,-.52],[q*.9,1.03,-.56],.03,dkM);
  const mh=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),paint);mh.scale.set(.045,.06,.11);mh.position.set(q*.94,1.04,-.58);S.add(mh);
 }
 if(V.ex==='rack'){const rt=lerpSt(CAB,.5)[3]+.012;for(const q of[-1,1])bx(S,.04,.05,1.5,q*.5,rt+.045,.5,gloss);for(const z of[-.1,.4,.9])bx(S,1.0,.04,.05,0,rt+.07,z,gloss);}
 if(V.ex==='scoop'){const y=topY(BODY,-1.2);bx(S,.34,.08,.46,0,y+.04,-1.2,carbon);bx(S,.26,.05,.05,0,y+.06,-1.42,gloss);}
 if(V.ex==='bar'){const rt=lerpSt(CAB,.1)[3]+.012;bx(S,1.0,.07,.1,0,rt+.045,.1,carbon);for(const x of[-.35,-.12,.12,.35])bx(S,.14,.05,.03,x,rt+.05,-.0,M.amber);}
 if(V.ex==='fins'){for(const q of[-1,1]){bx(S,.04,.05,.5,q*.78,topY(BODY,-1.0)+.03,-1.0,carbon);bx(S,.04,.05,.6,q*.82,topY(BODY,1.7)+.03,1.7,carbon);}}
  bx(S,.03,.07,.22,0,lerpSt(CAB,.95)[3]+.05,.95,paint);
 /* wing */
 const wp=[[-.26,0],[-.22,.035],[-.1,.058],[.1,.045],[.25,.028],[.26,.004],[.2,-.008],[-.05,-.01],[-.2,-.012]];
 const W=new THREE.Group();W.position.set(0,1.2,1.88);W.rotation.x=-.1;
 W.add(new THREE.Mesh(gm('wing',()=>ex(wp,1.74,.006)),carbonW));
 for(const q of[-1,1]){const e=bx(W,.025,.2,.56,q*.89,0,0,carbon);bx(W,.04,.012,.5,q*.89,.1,0,M.amber).visible=false;}
 W.position.y+=dk*.98;if(o.wg===0)W.visible=false;if(o.wg===2){W.position.y=1.03+dk;W.scale.set(.8,1.5,1);}S.add(W);
 if(o.wg===0||o.wg===2){}else for(const q of[-1,1]){link(S,[q*.5,.98+dk,1.84],[q*.5,1.17+dk,1.9],.04,carbon,.07);}
 /* tail: blackout, lenses, LED bar */
 bx(S,1.5,.24,.012,0,.72,2.169,gloss);
 const lensG=q=>{const s=new THREE.Shape();[[.42,.80],[.78,.84],[.80,.77],[.77,.66],[.70,.60],[.42,.68]].forEach((p,i)=>i?s.lineTo(p[0]*q,p[1]):s.moveTo(p[0]*q,p[1]));return new THREE.ExtrudeGeometry(s,{depth:.03,bevelEnabled:true,bevelThickness:.008,bevelSize:.008,bevelSegments:2});};
 const gl=[];
 for(const q of[-1,1]){const l=new THREE.Mesh(lensG(q),tailM);l.position.z=2.172;S.add(l);
  for(const y of[.76,.72,.68])bx(S,.3,.012,.01,q*.6,y,2.214,ledM);
  bx(S,.2,.03,.02,q*.58,.655,2.214,M.amber);bx(S,.1,.04,.02,q*.72,.40,2.17,rflM);
  gl.push(glow(S,q*.6,.74,2.45,1.5));
  const tg=new THREE.CylinderGeometry(.06,.058,.2,18,1,true);tg.rotateX(Math.PI/2);
  for(const x of[.29,.5]){const t=new THREE.Mesh(tg,chrome);t.position.set(q*x,.345,2.2);S.add(t);const d=new THREE.Mesh(new THREE.CircleGeometry(.055,16),M.dark);d.position.set(q*x,.345,2.17);S.add(d);}
 }
 bx(S,.84,.03,.03,0,.80,2.185,tailM);bx(S,.2,.028,.02,0,.78,2.19,tailM);
 bx(S,.5,.04,.03,0,1.01+dk*.67,1.6,tailM);
 bx(S,1.7,.1,.3,0,.34,2.05,carbon);for(let i=-3;i<=3;i++)bx(S,.015,.09,.22,i*.19,.325,2.11,carbon);
 bx(S,1.78,.04,.3,0,.29,2.2,carbon);
 /* plate */
 const pm=new THREE.MeshBasicMaterial({map:ud.tex}),p=new THREE.Mesh(new THREE.PlaneGeometry(.86,.215),pm);p.position.set(0,.56,2.185);S.add(p);bx(S,.92,.27,.02,0,.56,2.17,gloss);
 for(const x of[-.3,.3])bx(S,.05,.015,.03,x,.7,2.19,new THREE.MeshBasicMaterial({color:0xfff6e0}));
 ud.setPlate=pl=>{const t=plateTex(pl,hero&&FRAME_C);pm.map=t;pm.needsUpdate=true;ud.tex.dispose();ud.tex=t;};
 /* front */
 const lampM=D(MS(0x05080d,.08,.8)),ledW=new THREE.MeshBasicMaterial({color:0xffffff,side:2}),drl=new THREE.MeshBasicMaterial({color:0xffb100,side:2});
 const mT=sh1('mT',()=>{const t=cvs(32,32,(g,w,h)=>{g.fillStyle='#050608';g.fillRect(0,0,w,h);g.strokeStyle='#3a3e48';g.lineWidth=2;g.beginPath();g.moveTo(0,h/2);g.lineTo(w/2,0);g.lineTo(w,h/2);g.lineTo(w/2,h);g.closePath();g.stroke();});t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(12,2);return t;});
 const mshM=D(new THREE.MeshStandardMaterial({map:mT,roughness:.4,metalness:.7}));
 const fzf=(x,y)=>{for(let z=-2.2;z<-1.4;z+=.004){const t=lerpSt(BODY,z);if(Math.abs(x)<t[1]){const ym=(t[2]+t[3])/2,hh=(t[3]-t[2])/2,d=hh*Math.pow(Math.max(0,1-Math.pow(Math.abs(x)/t[1],t[4])),1/t[4]);if(y>=ym-d&&y<=hy(x,z))return z;}}return -1.4;};
 const FP=(f,nu,nv,k,m)=>S.add(mkPatch((u,v)=>{const p=f(u,v);return[p[0],p[1],fzf(p[0],p[1])-k];},nu,nv,m));
 const barM=D(MS(0x9a9fa8,.28,1)),frM=D(MS(0xc9ccd4,.2,1));
 const TB=(pts,rad,k,m)=>{const P=pts.map(p=>new THREE.Vector3(p[0],p[1],fzf(p[0],p[1])-k));S.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(P),Math.max(8,P.length*2),rad,6),m));};
 const LN=(x0,y0,x1,y1,rad,k,m,n)=>{n=n||16;const a=[];for(let i=0;i<=n;i++){const t=i/n;a.push([x0+(x1-x0)*t,y0+(y1-y0)*t]);}TB(a,rad,k,m);};
 const BOX=(x0,x1,y0,y1,rad,k,m)=>{LN(x0,y0,x1,y0,rad,k,m);LN(x0,y1,x1,y1,rad,k,m);LN(x0,y0,x0,y1,rad,k,m,6);LN(x1,y0,x1,y1,rad,k,m,6);};
 const GR=(x0,x1,y0,y1,nb)=>{FP((u,v)=>[x0+(x1-x0)*u,y0+(y1-y0)*v],20,3,.003,rub);for(let i=1;i<=nb;i++){const y=y0+(y1-y0)*i/(nb+1);LN(x0+.01,y,x1-.01,y,.0055,.012,barM,20);}BOX(x0,x1,y0,y1,.007,.012,frM);};
 const LPt=(q,U,V)=>{const b=.488+.05*U,t=.52+.1*U;return[q*(.3+.54*U),b+(t-b)*V];};
 const LF=(q,U0,U1,V0,V1,k,m)=>FP((u,v)=>LPt(q,U0+(U1-U0)*u,V0+(V1-V0)*v),12,3,k,m);
 const STR=(q,U0,V0,U1,V1,h,k,m)=>FP((u,v)=>{const a=LPt(q,U0,V0),b=LPt(q,U1,V1);return[a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u+(v-.5)*2*h];},8,1,k,m);
 for(const q of[-1,1]){LF(q,-.05,1.05,-.25,1.25,.004,rub);LF(q,0,1,0,1,.008,lampM);for(const V of[.2,.5,.8])STR(q,.08,V,.72,V,.0035,.012,ledW);
  GR(Math.min(q*.62,q*.84),Math.max(q*.62,q*.84),.345,.44,2);
  for(const[rad,k,mm]of[[.03,.014,frM],[.023,.016,lampM],[.012,.018,ledW]])FP((u,v)=>{const a=u*Math.PI*2,r=rad*v,c=LPt(q,.86,.5);return[c[0]+r*Math.cos(a),c[1]+r*Math.sin(a)];},16,2,k,mm);
  topP((u,v)=>[q*(.3+.24*u),-1.45+.45*v],8,4,.012,vtM);for(let i=0;i<4;i++)topP((u,v)=>[q*(.31+.22*u),-1.4+.1*i+.02*v],4,1,.016,chM);}
 GR(-.46,.46,.395,.47,3);GR(-.52,.52,.29,.36,2);
 FP((u,v)=>{const a=u*Math.PI*2,r=.034*v;return[r*Math.cos(a),.54+r*Math.sin(a)];},24,2,.012,frM);
 for(const dy of[-.012,0,.012])FP((u,v)=>[-.022+.044*u,.54+dy+(v-.5)*.007],4,1,.016,rub);
 S.add(new THREE.Mesh(loft([[-2.24,.5,.255,.29,6],[-2.12,.78,.255,.29,6],[-1.95,.93,.255,.29,6],[-1.8,.95,.255,.29,6]],32),gloss));
 
 /* wheels */
 const tireT=sh1('tireT',()=>cvs(256,128,(c,w,h)=>{c.fillStyle='#17171a';c.fillRect(0,0,w,h);c.fillStyle='#0b0b0d';for(let x=0;x<w;x+=8)c.fillRect(x,h*.28,3,h*.44);c.fillRect(0,h*.5-2,w,4);c.fillStyle='#26262b';c.fillRect(0,h*.1,w,2);c.fillRect(0,h*.9,w,2);}));
 const tireM=new THREE.MeshStandardMaterial({map:tireT,roughness:.9});
 const rimT=sh1('rimT',()=>cvs(256,256,(c,w,h)=>{c.clearRect(0,0,w,h);c.save();c.translate(128,128);for(let k=0;k<5;k++){const a=k*Math.PI*2/5,P=(r,t)=>[Math.cos(a+t)*r,Math.sin(a+t)*r];c.fillStyle='#6a707c';c.beginPath();c.moveTo(...P(28,-.3));c.lineTo(...P(112,-.2));c.lineTo(...P(112,.2));c.lineTo(...P(28,.3));c.closePath();c.fill();c.strokeStyle='#d4d8e0';c.lineWidth=4;c.stroke();}c.restore();
  c.strokeStyle='#cfd3db';c.lineWidth=14;c.beginPath();c.arc(128,128,119,0,7);c.stroke();c.fillStyle='#3d414b';c.beginPath();c.arc(128,128,36,0,7);c.fill();c.strokeStyle='#aeb3be';c.lineWidth=3;c.stroke();
  c.fillStyle='#c8ccd4';for(let i=0;i<5;i++){const a=i*1.2566;c.beginPath();c.arc(128+Math.cos(a)*22,128+Math.sin(a)*22,4,0,7);c.fill();}c.fillStyle='#1c57c7';c.beginPath();c.arc(128,128,10,0,7);c.fill();
  c.fillStyle='#ff3a24';c.beginPath();c.arc(128+98,128,10,0,7);c.fill();c.fillStyle='#fff';c.fillRect(128+86,128-3,24,6);}));
 const rimFace=new THREE.MeshStandardMaterial({map:rimT,color:o.rc??0xffffff,alphaTest:.5,roughness:.3,metalness:.85}),rotorM=MS(0xa9adb5,.35,.85),calM=MP({color:o.cc??0xd41414,roughness:.3,clearcoat:1}),barrelM=MS(0x14151a,.5,.6);
 rimFace.transparent=true;const blurT=sh1('blurT',()=>cvs(128,128,(g)=>{const r=g.createRadialGradient(64,64,10,64,64,62);r.addColorStop(0,'rgba(20,20,24,.9)');r.addColorStop(.25,'rgba(70,74,84,.55)');r.addColorStop(.8,'rgba(150,155,168,.5)');r.addColorStop(1,'rgba(180,185,195,.7)');g.fillStyle=r;g.beginPath();g.arc(64,64,62,0,7);g.fill();g.strokeStyle='rgba(220,225,235,.25)';g.lineWidth=2;for(let i=0;i<14;i++){const a=rnd(0,6);g.beginPath();g.arc(64,64,rnd(14,56),a,a+rnd(.5,1.5));g.stroke();}}));
 const blurM=new THREE.MeshBasicMaterial({map:blurT,transparent:true,opacity:0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1});
 const spins=[],steer=[];
 const mkW=(q,x,z,r,wd,front)=>{const a=new THREE.Group(),sp=new THREE.Group(),rr=r-.115;x=q*(surf(BODY,z,.62)+.06-wd/2);a.position.set(x,r,z);
  const prof=[[r-.12,-wd/2],[r-.08,-wd/2-.005],[r-.015,-wd*.465],[r,-wd*.3],[r,wd*.3],[r-.015,wd*.465],[r-.08,wd/2+.005],[r-.12,wd/2]].map(v=>new THREE.Vector2(v[0],v[1]));
  const tg=gm('tg'+r+'_'+wd,()=>{const t=new THREE.LatheGeometry(prof,44);t.rotateZ(Math.PI/2);return t;});sp.add(new THREE.Mesh(tg,tireM));
  const br=new THREE.Mesh(new THREE.CylinderGeometry(rr,rr,wd*.8,28,1,true),barrelM);br.rotation.z=Math.PI/2;br.material.side=THREE.DoubleSide;sp.add(br);
  const f=new THREE.Mesh(new THREE.CircleGeometry(rr+.005,40),rimFace);f.rotation.y=q*Math.PI/2;f.position.x=q*(wd/2-.03);sp.add(f);const bk=new THREE.Mesh(new THREE.CircleGeometry(rr,32),inner);bk.rotation.y=q*Math.PI/2;bk.position.x=q*(wd/2-.045);sp.add(bk);const bl=new THREE.Mesh(new THREE.CircleGeometry(rr+.006,40),blurM);bl.rotation.y=q*Math.PI/2;bl.position.x=q*(wd/2-.025);sp.add(bl);
  const ro=new THREE.Mesh(new THREE.CylinderGeometry(rr*.82,rr*.82,.03,32),rotorM);ro.rotation.z=Math.PI/2;ro.position.x=q*.03;sp.add(ro);
  a.userData.keep=1;a.add(sp);const ca=new THREE.Mesh(new THREE.BoxGeometry(.08,.15,.2),calM);ca.position.set(q*.045,.14,.1);a.add(ca);
  {const Rw=r+.075,zc=z,yc=r;let yt=.3;for(let y=.3;y<1;y+=.01)if(surf(BODY,z,y)>=.86*lerpSt(BODY,z)[1])yt=y;const Rv=Math.max(r+.03,Math.min(Rw,yt-r)),kv=Rv/Rw;
  S.add(mkPatch((u,v)=>{const th=-.12+(Math.PI+.24)*u,rho=(r-.03)+(Rw-r+.03)*v,zz=zc+Math.cos(th)*rho,yy=yc+Math.sin(th)*rho*kv;return[q*(surf(BODY,zz,yy)+.007),yy,zz];},30,3,D(MS(0x050507,.95))));
  const pts=[];for(let k=0;k<=30;k++){const al=-1.45+2.9*k/30,zz=zc+Math.sin(al)*Rw,yy=yc+Math.cos(al)*Rv;pts.push(new THREE.Vector3(q*(surf(BODY,zz,yy)+.012),yy,zz));}
  S.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),48,.03,8),paint));}
  S.add(a);spins.push(sp);if(front)steer.push(a);};
 for(const q of[-1,1]){mkW(q,q*.84,-1.38,.37*(V.wr||1),.28,1);mkW(q,q*.83,1.32,.39*(V.wr||1),.34,0);}
 /* ground effects */
 const shT=sh1('shT',()=>cvs(64,128,(c)=>{c.scale(1,2);const r=c.createRadialGradient(32,32,4,32,32,32);r.addColorStop(0,'rgba(0,0,0,.85)');r.addColorStop(.6,'rgba(0,0,0,.55)');r.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=r;c.fillRect(0,0,64,64);}));
 const sh=new THREE.Mesh(new THREE.PlaneGeometry(3.3,5.8),new THREE.MeshBasicMaterial({map:shT,transparent:true,depthWrite:false}));sh.rotation.x=-Math.PI/2;sh.position.y=.03;g.add(sh);
 const ug=new THREE.Mesh(new THREE.PlaneGeometry(3.4,5.6),new THREE.MeshBasicMaterial({map:sun.material.map,color:0x2a60ff,transparent:true,opacity:.4,blending:THREE.AdditiveBlending,depthWrite:false}));ug.rotation.x=-Math.PI/2;ug.position.y=.045;if(hero)g.add(ug);
 const wm=wetM.clone(),wt=new THREE.Mesh(wetG,wm);wt.position.set(0,.05,4.7);wt.scale.x=1.05;g.add(wt);
 /* flames */
 const fl=[];if(hero)for(const q of[-1,1])for(const x of[.29,.5]){const s=glow(S,q*x,.345,2.38,.001,glowAm);fl.push(s);}
 if(!hero)S.scale.set(1+rnd(-.03,.04),1+rnd(-.06,.04),1+rnd(-.03,.03));
 /* animation */
 ud.spin=(dt,v0)=>{const d=Math.min(v0/.38*dt*.5,.5);for(const s of spins)s.rotation.x-=d;};
 let pitch=0,lastV=null,str=0,holdT=0,pop=0,lastB=-1;
 ud.anim=(dt,c)=>{const dv=lastV==null?0:(c.v-lastV)/Math.max(dt,.001);lastV=c.v;const brk=!!c.brk||dv<-5;
  pitch+=(cl(dv*.0022,-.05,.05)-pitch)*Math.min(1,dt*6);S.rotation.x=pitch;
  ud.spin(dt,c.v);
  str+=(cl(-c.vx*.028,-.4,.4)-str)*Math.min(1,dt*10);for(const a of steer)a.rotation.y=str;
  if(brk!==lastB){lastB=brk;tailM.color.setHex(brk?0xff5a3a:0xc41c0e);for(const s of gl)s.scale.setScalar(brk?3.4:1.5);wm.opacity=brk?.55:.3;}
  if(c.thr){holdT+=dt;}else{if(holdT>.5&&c.v>20)pop=.14;holdT=0;}pop-=dt;
  const f=pop>0?3:(c.thr&&Math.random()<.4?1.2:0);for(const s of fl){s.visible=f>0;s.scale.setScalar(f*(.5+Math.random()*.7)||.001);}
  return brk;};
 {let lb=-1;ud.brk=hero?()=>{}:(on=>{on=!!on;if(on===lb)return;lb=on;tailM.color.setHex(on?0xff5a3a:0xc41c0e);for(const s of gl)s.scale.setScalar(on?3.4:1.5);wm.opacity=on?.55:.3;});}
 if(MOBILE||!hero)mergeStatic(S);return g;};
/* traffic cars: same model as the hero, different paint / stripes / wing / rims */
const PAL=[[0,.85,.42],[24,.95,.5],[50,.95,.5],[135,.7,.32],[172,.8,.35],[195,.9,.5],[268,.65,.4],[315,.8,.45],[0,0,.92],[220,.05,.7],[240,.1,.07],[220,.12,.22],[345,.9,.3],[85,.75,.4]];
const RIMS=[0xffffff,0xffffff,0x2a2a2a,0xffc860,0xff6a5a,0xb0c8ff],CALS=[0xd41414,0xe8c020,0x2060e0,0x20b040,0xe0e0e0],STR=[0xf1f4f8,0x101014,0xffd21a,0xff7a1a,0xd42020,0x1c57c7];
const ARCH=[{id:0},{id:1,ch:.8,hd:-.05,dk:-.03,bw:1.04,e:1.15,cw:1.03,wr:1.06,ex:'scoop'},{id:2,ch:1.3,hd:.07,dk:.1,bw:.97,e:.9,cw:.97,wr:1.08,ex:'rack'},{id:3,ch:1.05,hd:0,dk:.06,bw:1,e:1,cw:1.04,ex:'fins'},{id:4,ch:.9,hd:-.08,dk:.07,bw:1.02,e:1.1,cw:.98,wr:.96},{id:5,ch:.95,hd:.05,dk:0,bw:1.04,e:.85,cw:1,wr:1.04,ex:'scoop'},{id:6,ch:1.15,hd:.02,dk:.12,bw:1,e:.95,cw:1.02,wr:1.03,ex:'bar'}];
const carOpts=()=>{const p=pick(PAL),r=Math.random(),sr=Math.random(),o={h:p[0],s:p[1],l:p[2],v:pick(ARCH),wg:pick([0,1,1,2,2]),rc:pick(RIMS),cc:pick(CALS),rf:Math.random()<.35};
 if(sr<.45){o.sq=[];}else if(sr<.75){o.st=pick(STR);}else{o.st=pick(STR);o.sq=[1];o.sx=0;}
 if(p[1]<.15&&o.st===0xf1f4f8)o.st=0xd42020;
 if(r<.15){o.rg=.55;o.cr=.3;o.mtl=.4;}return o;};
const mkCop=()=>{const g=mkHero(mkPlate(),{h:0,s:0,l:.93,v:ARCH[0],wg:0,rc:0xffffff,cc:0x2060e0,rf:false,st:0x1c57c7,sq:[]}),ud=g.userData,sb=ud.brk;
 const M2=mkCop.M||(mkCop.M=[0xff2020,0x2a5cff].map(c=>new THREE.MeshBasicMaterial({color:c,toneMapped:false})));
 bx(g,1.2,.07,.34,0,1.5,.45,M.dark);const A=[],B=[];
 for(const x of[-.42,-.14])A.push(bx(g,.26,.12,.28,x,1.56,.45,M2[0]));for(const x of[.14,.42])B.push(bx(g,.26,.12,.28,x,1.56,.45,M2[1]));
 ud.sir=on=>{for(const m of A)m.material=M2[on?0:1];for(const m of B)m.material=M2[on?1:0];};return g;};


/* player */
let car=null;const tl=new THREE.PointLight(0xff2a10,2.2,16);const hl=new THREE.SpotLight(0xffe2b0,1.2,70,.5,.6);hl.target.position.set(0,0,-30);scene.add(hl.target);if(!MOBILE)scene.add(hl,tl);
const P={x:0,vx:0,y:0,vy:0,plate:opts.plate||mkPlate()};
const shB=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0x4aa8ff,transparent:true,opacity:.28,depthWrite:false,blending:THREE.AdditiveBlending}));shB.scale.set(1.5,1.25,2.9);shB.visible=false;scene.add(shB);
function buildPlayer(){P.plate=opts.plate||mkPlate();if(!car){car=mkHero(P.plate);car.rotation.order='YXZ';scene.add(car);}else car.userData.setPlate(P.plate);}
/* state */
let ci=0,IS=0,IC=null,DY=0,DZ=0,DX=0,fx=0,ext=[],cpl=null,HB={x:0,j:0},copWarn=0,FT=0,FS=0,FG=null,FC=null,heartCD=20,shT=0,shCD=60,introSeen=false,st='menu',t=0,v=12,dist=0,bonus=0,lives=3,best=0,inv=0,shake=0,rowT=0,gT=0,sT=0,endT=0,rampCD=0,zCD=0,onT=0,onCD=0,copCD=0,LS=[],E=[],SC=[],alive=true,raf=0,last=0;
try{best=+localStorage.getItem('rw_best')||0}catch(e){}best=Math.max(best,+opts.best||0);
let ST={cd:0,clean:0,near:0,ramps:0,pk:0},lastStars=0;
/* Детали машины (ивент): FX — бонусы от установленных деталей в промилле, их присылает сервер (opts.setRun после ev_start), потолок +20%.
   PKT — времена появления ящиков с деталями (сколько их, решает сервер). Максимальная скорость деталями не растёт: серверный потолок 80 м/с остаётся. */
let FX={acc:0,grip:0,hand:0,brk:0,tb:0,dur:0},PKT=[];const fxv=k=>Math.min(200,Math.max(0,FX[k]||0))/1000,invT=()=>1.6*(1+fxv('dur')*2),soak=()=>{const p=fxv('dur');if(p>0&&Math.random()<p){inv=invT();say('🛡 Кузов выдержал!','#8fe3ff');return true;}return false;};const stars=()=>CHASE?Math.min(5,1+Math.floor(dist/STAR_M)):0,runStats=()=>({clean:Math.round(Math.max(ST.clean,ST.cd)),near:ST.near,ramps:ST.ramps,stars:stars(),pk:ST.pk});
const keys={};let tx=null,drag0=null;
const mkPed=(cls,key,label,pts)=>{const b=document.createElement('div');b.className='rw-ped '+cls;b.innerHTML='<svg viewBox="0 0 24 24" fill="#fff"><path d="'+pts+'"/></svg>'+label;
const on=e=>{e.stopPropagation();e.preventDefault();keys[key]=1;b.classList.add('on');try{b.setPointerCapture(e.pointerId)}catch(_){}};
const off=e=>{e.stopPropagation();keys[key]=0;b.classList.remove('on');};
b.addEventListener('pointerdown',on);b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);b.addEventListener('contextmenu',e=>e.preventDefault());return b;};
const pedG=mkPed('g','ArrowUp','ГАЗ','M12 3l9 12h-6v6H9v-6H3z'),pedK=mkPed('k','ArrowDown','СТОП','M12 21L3 9h6V3h6v6h6z');
box0.insertBefore(pedK,menu);box0.insertBefore(pedG,menu);

const score=()=>Math.floor(dist/4+bonus);

/* ================= РАЦИЯ ДПС ================= */
const WHO={D:['Люда','#7fb2ff'],P:['Петрович','#ffb04a'],S:['Сидоров','#ffd54a']};
/* одиночные реплики и мини-диалоги на события: строка 'К|текст' или массив строк */
const RAD={
new:['P|Двенадцатый на связи. Вижу тачку #N. Ща прижму, ~блин~.','P|Ага, вот ты где, голубчик. Держу дистанцию, ~сука~.','S|Сидоров на связи. Вижу нарушителя, номер #N. ~Ну наконец-то~.',['D|Двенадцатый, ты на месте?','P|Вижу цель. Белая, быстрая, ~наглая~.','D|Не упусти, Петрович.']],
siren:['D|Всем постам: нарушитель, номер #N. Ловите, ~блин~.',['D|Нарушитель, номер #N.','S|Принял, выезжаю! ~Допью только~.']],
nitro:['P|Нитро включил, ~сука~! Догоняй, Сидоров!','S|Да я и так жму, ~блин~, у меня служебная ~шестёрка~!',['D|Он что, на ракете?','P|Да хрен его знает, ~сука~ уходит!']],
wh:['P|Люда, ~пиздец~... он на заднем колесе едет! Это вообще законно?','S|Ты глянь, ~блин~, как мотоциклист! А на тачке!','P|Двадцать лет на службе, такого цирка не видел, ~ёб твою мать~.',['D|Двенадцатый, что у вас там за шум?','P|Он ~встал на дыбы~, Люда! На дыбы!','D|Это машина или ~лошадь~?'],['S|Петрович, я снимаю! Это точно в тренды!','P|Убери телефон, ~идиот~, смотри на дорогу!'],'D|Только не говорите, что он ~опять~ на заднем...'],
wc:['S|Да сколько можно ехать на заднем? Это ~жесть~!','P|Люда, он до сих пор на заднем, ~ёб твою~!','D|Снимите кто-нибудь на видео, ~блин~, мне не поверят.',['S|У меня тикток уже ~разрывается~!','P|Сидоров, пошёл ты со своим тиктоком.'],['P|Он там что, ~живёт~ на задних?','D|Петрович, держи дистанцию, ~упадёт~ же.']],
wend:['P|Приземлился... ~охренеть~. Записываю в протокол: цирк.','S|Красиво поехал, ~сука~. Жалко, что нарушитель.','D|Двенадцатый, это был номер или ~глюк~? Подтверди.',['D|Ну что, жив, акробат?','P|Это не я, Люда, это он жив. ~К сожалению~.']],
sk:['P|Он на носу тормозит! ~Нахуй~ такие трюки на моей смене.','S|Ха! Стоппи, ~сука~! Красиво же.',['D|Что за звук? Как будто ~шины орут~.','P|Он встал на нос, ~блин~, будто ему мама разрешила.']],
pr:['P|Беру в коробочку. Не уйдёшь, ~сука~!','P|Прижимаю справа, держись, ~долбоёб~.','S|Давай-давай, зажимай его к отбойнику!',['P|Сидоров, заходи слева!','S|У меня тут ~конус~!','P|Дави его ~нахуй~, он картонный!'],'D|Только без фанатизма, ребята. ~Бумаги~ потом ваши.'],
ov:['P|Захожу слева. Только не дёргайся, ~блин~.','P|Обгоняю, ща подрежу ~гада~.',['S|Петрович, ты ~куда~?','P|~Тихо~, я в манёвре.']],
rd:['P|Читает мои манёвры, ~сука~ умная!','S|Он нас вычислил, ~блин~.','D|Он ~не дурак~, ребята, перестаньте дёргаться.'],
bump:['P|Ай ~блядь~, бампер! Люда, у нас ДТП, ~пиздец~!','S|Он нас таранит, ты чё творишь, ~мудак~!',['D|Что за скрежет?','P|Он меня ~поцеловал~ в зад!','D|Пишем «в зад» в рапорт.']],
spin:['P|Ааа, ~ёб твою~, меня крутит! Держите меня!','S|Двенадцатый, ты где? Тебя развернуло, ~блин~!',['P|Я крутился как ~юла~.','D|Живой?','P|Живой. ~Тошнит~ только.']],
near:['P|Он зеркало мне чуть не снёс, ~псих~!','S|Ну ты и ~отморозок~, водитель.','D|Он впритирку, как по линейке. ~Мастер~.'],
gone:['P|Ушёл, ~гад~! Люда, потеряли объект!','D|~Блин~, двенадцатый, ты чем смотрел?!',['S|Я его не видел.','D|Сидоров, ты вообще ~что~ видел?','S|Ну... шаурму.']],
work:['D|Наезд на дорожника! Всем патрулям срочно на трассу, ~пиздец~!','P|Двенадцатый, принял. Ща этого ~урода~ возьмём.','S|Мужики, это уже ~статья~, наверное.'],
head:['D|Слышу лобовое! Двенадцатый, что там ~за хрень~?','S|Грохот на всю трассу, ~ёб твою~.','P|Там кто-то по встречке гонял, ~блин~.'],
dead:['D|Всё, отъездился ~красавчик~. Оформляем протокол, ~блин~.','P|Принял. Забираем тачку, ~наконец-то~.',['S|Мы его поймали?!','P|Не мы, он сам. Но в рапорте напишем, что ~мы~.']],
hit:['S|Ого, звук был ~пиздецкий~. Живой там вообще?','P|Кто-то ~влетел~ на трассе, слышите?','D|Всем быть ~внимательнее~.'],
ramp:['P|Он перепрыгнул трамплин! ~Нахуй~ я такое вообще вижу?','S|Форсаж ~блин~ какой-то.',['D|Что значит «улетел»?','P|Люда, он ~взлетел~! Как самолёт!']],
ice:['D|На участке гололёд, ~блин~. Осторожнее там.','P|Опять лёд? Снегопад же не обещали, ~сука~.'],
pud:['S|Он в лужу ~влетел~, ха!','P|Люди купаются, ~блин~.'],
pit:['S|Яма! Ха, ~сам виноват~.','P|Дорожники опять ~не доделали~.'],
low:[['D|У нарушителя, по моим данным, ~одна жизнь~ осталась.','P|Добиваем?','D|Только аккуратно, он нам ещё рапорт должен.'],'S|Он на последнем издыхании! Ща ~возьмём~!'],
mile:['D|Он набрал #P очков. Это ~рекорд~ для нашей трассы.','S|Ничего себе, #P! Я столько ~в жизни не зарабатывал~.','P|Люда, у него #P. ~Хоть бы упал~.'],
fast:['P|Скорость #S! У меня ~спидометр~ плавится!','S|Я в его след ~не вписываюсь~, Петрович!','D|#S? Куда он ~так~ несётся?']};
/* сценки в эфире: c — когда на хвосте ДПС, n — когда ДПС нет */
const SCN={c:[
['D|Двенадцатый, доклад по нарушителю.','P|Номер #N, скорость под #S. Гонит как ~ненормальный~.','D|Принято. Сидоров, ты там живой?','S|Живой, Людмила Петровна. Шаурму ем.','P|~Блин~, Сидоров, ты на задании!','S|Я голодный был, ~чё сразу орать~.'],
['D|Ребят, у меня Барсик на клавиатуру сел. Если пришлю «ыыыыыы» — это не код.','P|Люда, ты рацию кошкой управляешь?','D|Он умнее вас обоих, ~блин~.','S|Передайте Барсику, что я хочу в эфир.'],
['P|Люда, у меня кофе остыл. Я его ~нахуй~ вылью в окно.','D|Не смей, там внизу рабочие.','P|Тогда допью. Холодный, как моя жена.','D|Петрович, Тамара тебя слышит, у неё второй приёмник.','P|...Тамара, солнышко, я пошутил.'],
['S|Петрович, я это снимаю на телефон. Будет миллион просмотров!','P|Убери телефон, ~идиот~, ты за рулём!','S|Камера на торпеде, всё по правилам.','D|Сидоров, ты снимаешь служебный эфир?! Уволю, ~блин~.','S|Людмила Петровна, а вы лайк ~поставите~?'],
['P|У меня тачка скрипит как ~дверь в подъезде~.','S|Это не тачка, Петрович, это ты скрипишь.','P|Сидоров, я тебя после смены ~найду~.','D|Не ругайтесь, нарушитель уходит.'],
['P|Люда, у меня бензин на нуле.','D|Опять? Ты ж вчера заправлялся.','P|Ну, ~блин~, я канистру другу на дачу отдал.','D|Господи, Петрович...'],
['S|Петрович, если я его поймаю, меня повысят?','P|Тебя повысят до ~посмешища~, по версии начальника.','D|Сидоров, повысят до сержанта.','S|Вы ~серьёзно~?! Мама будет гордиться!','P|Только служебную не разбей, ~прошу~.'],
['D|Ловим радаром? Скорость #S.','P|Радар сломан, Люда. Показывает 200, а я вижу, что он быстрее.','S|Мой тикток это тоже ~подтвердит~.'],
['D|Дорожные работы там идут, между прочим.','P|Да я вижу, рабочие как ~тараканы~ ползают.','D|Не называй людей тараканами, они асфальт кладут.','P|~Тараканы~ в касках.'],
['D|Кто съел печенье из общей коробки?','S|Я не ел.','P|Сидоров, у тебя крошки в рации слышно.','S|Это... ~шаурма~ была.','D|Двенадцатый, вечером убираешь за него.'],
['P|Люда, Тамара звонила, спрашивала, когда домой.','D|Скажи, что на задании.','P|Сказал. Она говорит: «опять с ~Людкой~ в эфире сидишь».','D|~Ничего себе~! Петрович!','S|Ха-ха, мыльная опера!'],
['S|Петрович, а зачем мы его ловим?','P|Затем, что он нарушитель.','S|А что он нарушил?','P|Всё, ~блин~! Скорость, разметку, моё терпение!','D|И график смены, он мне сорвал.'],
['S|По моим подсчётам, у него осталось #L попыток. Я на пальцах считал.','P|Сидоров, у тебя пальцев ровно ~десять~.','S|Вот я и ~не вмещаюсь~.'],
['P|Сидоров, выключи ~шансон~ в эфире!','S|Это не я, это у вас помехи.','D|Помехи — это ваш голос, дорогие мои. Заткнитесь ~оба~.'],
['S|Петрович, а у тебя собака есть?','P|Была.','S|Простите.','P|Да ладно, ~зараза~, она меня всё равно не любила.','D|Мужики, не грузите эфир.'],
['P|Мне до пенсии три месяца и четыре дня.','D|Не накаркай, Петрович.','P|Если этот гонщик меня не угробит, я вообще ~в рай~ попаду.'],
['D|Скоро обед, ребята, держимся.','S|Я уже держусь за ~шаурму~.','P|А я за руль, как за ~последнюю надежду~.'],
['P|Он едет так, будто у него ~гараж горит~.','S|Может, правда горит?','D|Не рассуждайте, ловите.','S|А если горит, мы ему ~поможем~?'],
['D|Запомните: после этой гонки рапорты пишете оба.','P|Только не про дыбы, меня ~засмеют~.','S|А про шаурму можно?','D|Сидоров, про шаурму в рапорте ничего.'],
['D|У меня смена закончилась десять минут назад.','P|Иди домой, Люда.','D|Не могу, пока вы живы.','S|Вы нас ~любите~?!','D|Нет. Я ~ответственная~.'],
['S|Петрович, у меня идея: прижмём его с двух сторон.','P|Идея хорошая, только у меня справа ~забор~.','D|А у меня слева чай. Ловите.']],
n:[
['D|Всем постам, на трассе гонит белая тачка, номер #N.','P|Двенадцатый принял. Выезжаю.','S|Я тоже! Только ~шаурму допью~.'],
['D|Тишина в эфире. Подозрительно.','S|А вы дежурите одна?','D|С тобой и Петровичем. Хуже ~одиночества~.'],
['P|Сижу в засаде. Рядом ~сугроб~. Хотя сейчас осень.','S|Это куст, Петрович.','P|~Блин~, правда.'],
['D|Кто-нибудь видит нарушителя?','S|Вижу машину. Белая такая.','D|Какая именно?','S|Ну... ~быстрая~.'],
['D|Передаю сводку: в районе дорожных работ может быть оживлённо.','P|Это как «оживлённо»?','D|Один лихач и куча конусов. ~Радуйтесь~.'],
['S|Петрович, у вас есть мечта?','P|Чтобы Люда замолчала.','D|Я всё ~слышу~, Петрович.','P|Это и была мечта. ~Не сбылась~.'],
['P|Я на трассе. Тут скучно как в ~библиотеке~.','D|А ты бывал в библиотеке?','P|Один раз. Меня ~попросили выйти~.'],
['D|Сидоров, ты где?','S|На парковке у шаурмы!','D|Это ~не пост~!','S|Зато стратегическая точка ~вкуса~.'],
['D|Ребята, у меня кот съел ваш рапорт.','P|Какой?','D|~Тот самый~.','S|Слава ~Барсику~!'],
['P|Радио сломано? Слышу только Люду.','D|Я и есть радио, ~дурак~.'],
['S|Петрович, правда, что на этой трассе ~призрак~ ездит?','P|Какой призрак, ~блин~?','S|Говорят, белая тачка, на заднем колесе.','D|Не пугайте меня, у меня смена одна.'],
['D|Погода хорошая, асфальт свежий. ~Живём~.','P|Асфальт свежий, а мы старые, ~блин~.']]};
/* ===== дополнение: майор Зубов, новые сценки и реакции ===== */
WHO.M=['Майор','#ff7a7a'];
const rdCoolK={coin:22000,land:16000,heal:3000,shield:5000};
SCN.c.push(
['M|Двенадцатый, Сидоров! Майор Зубов на связи. Почему так вяло гонитесь?','P|Товарищ майор, он быстрее нас.','M|Мне плевать! Догнать!','S|Есть догнать! А чем?','M|Колёсами, Сидоров, ~блин~!'],
['S|Петрович, а ты в детстве кем хотел стать?','P|Машинистом поезда.','S|И как?','P|Рельс не хватило. Стал вот ментом, ~блин~.','D|Не грустите, мальчики.'],
['D|Двенадцатый, у тебя фара моргает, ты в курсе?','P|Это не фара, это нервный тик.','S|У машины?','P|У меня, Сидоров, у меня. ~Блин~.'],
['P|Люда, а правда, что ты в молодости на ралли ездила?','D|Правда. Второе место в районе.','S|А первое кто?','D|Мой муж. Потом я его бросила.','P|Вот это женщина. Уважаю.'],
['M|Слушайте внимательно. Если упустите, премии не будет.','P|А если поймаем?','M|Тоже не будет. Но я вас запомню.','S|Мотивация просто огонь.'],
['S|Петрович, смотри, у него номер #N!','P|Я знаю, что у него номер #N.','S|Красивый номер, как у депутата.','D|Сидоров, это не повод его прощать.'],
['P|Что-то колено болит. Видимо, к дождю.','D|Сегодня ясно.','P|Значит, к чьей-то смерти.','S|Петрович, не пугай, ~блин~.'],
['S|Мужики, а можно я ему посигналю?','P|Нельзя.','S|Ну чуть-чуть?','D|Сидоров, ты не в такси.','S|Эх... скучная работа.'],
['D|Повторяю для особо одарённых: нарушитель не должен уйти.','P|А если он очень хочет?','D|Тогда пусть хочет в обезьяннике.'],
['P|Я, кажется, забыл выключить утюг.','S|Утюг — это серьёзно.','D|Петрович, не отвлекайся.','P|А если дача сгорит?','D|Дача и так сгорит, ~блин~, там проводка.'],
['S|Вижу его! Он справа!','P|Он слева, Сидоров.','S|А... я перепутал право и лево.','D|Сидоров, ты в школу ходил?','S|Ходил! Правда, не доходил.'],
['P|Люда, он меня опять подрезал.','D|Запиши номер.','P|У меня руки заняты рулём, ~блин~!','S|Я запишу! #N, так?','D|Молодец, Сидоров. Хоть что-то умеешь.'],
['D|Скорость #S. Это уже не гонка, это самолёт.','P|Мне страшно, Люда.','S|Мне тоже, но ~пиздец~ как весело!'],
['M|Двенадцатый, у вас в эфире бардак!','P|Это Сидоров.','S|Я не!','M|Сидоров, ты уволен!','S|За что?!','M|За всё.'],
['P|А мы за это премию получим?','D|Нет.','P|А благодарность?','D|Тоже нет.','S|А печенье?','D|Ну... печенье может быть.'],
['S|Петрович, мне приснилось, что я его поймал.','P|И что?','S|Он оказался моим соседом.','D|Вот это поворот.'],
['P|У меня сирена хрипит.','D|Починим после смены.','P|После смены я умру.','S|Тогда сирену запишем на меня.'],
['D|Двенадцатый, дополни рапорт до трёхсотой страницы.','P|У меня их всего восемь.','D|Тогда допиши.','P|~Блин~, Люда, я не Толстой.'],
['S|Вот бы мне такую тачку.','P|Ты на зарплату шаурму едва тянешь.','S|Ну я же мечтаю!','D|Мечтай, Сидоров. Это бесплатно.'],
['P|Люда, а если мы его не поймаем?','D|Тогда увольняемся все.','S|А печенье?','D|Печенье останется.'],
['M|Через три минуты вы мне покажете нарушителя в наручниках.','P|Товарищ майор, через три минуты мы будем в реанимации.','M|Значит, в наручниках оба. ~Блин~!'],
['S|Мне кажется, он нас троллит.','P|Он просто едет.','S|Нет, у него задние фары троллят.','D|Сидоров, откуда ты видишь, как фары троллят?','S|Ну... чувствую.'],
['P|Старею я, ребят.','D|Не жалуйся.','P|Раньше таких пачками ловил.','S|А сейчас?','P|Сейчас радикулит, ~сука~.'],
['D|Внимание всем: если вы чайник, выключите.','S|Это про меня?','D|Это про Барсика, он тыкнул на кнопку.'],
['P|Люда, а я ведь тебя в школе знал.','D|Знаю. Ты мне записки писал.','P|И что я писал?','D|«Дай списать».','S|Вот это любовь, ~блин~.'],
['S|Петрович, а если он вообще не нарушитель?','P|А кто?','S|Ну... любитель скорости.','D|Любитель скорости — это и есть нарушитель.'],
['P|Я устал. Давайте ловить по очереди.','S|Я первый!','D|Нет, первый Петрович.','P|~Блядь~, ну почему всегда я?'],
['D|Кто там ржёт в эфире?','S|Это не я.','P|Это я. Он на дорожную бочку чуть не въехал.','D|Над нарушителем смеёшься?','P|Над ним и над собой, Люда.'],
['S|Петрович, а у меня шина мягкая.','P|Какая?','S|Ну... левая.','P|Какая левая?!','S|Задняя. Ой, ~блин~, нет, передняя.'],
['D|Двенадцатый, ты чего замолчал?','P|Думаю.','D|Это опасно.','P|Да я знаю, ~сука~. Но надо.'],
['S|Я вчера смотрел «Форсаж». Там они ловят таких без проблем.','P|Там ещё и вертолёт, и танк.','S|Давайте попросим вертолёт?','D|Попроси у майора. Он тебе ~фиг~ даст.'],
['M|Двенадцатый, вы за чем гонитесь?','P|За нарушителем, товарищ майор.','M|А я думал, за призраком.','S|Он ещё и призраком может?','M|Всё может. ~Блин~, работайте!']);
SCN.n.push(
['D|Ребята, проверка связи. Как слышно?','P|Слышно хорошо.','S|А меня слышно?','D|Тебя слышно даже когда ты молчишь.'],
['S|Петрович, а ты веришь в НЛО?','P|Я верю в ~пиздец~ на работе.','S|Это не одно и то же.','P|Одно, Сидоров. Одно.'],
['M|Всем постам. Ситуация на трассе ~хреновая~. Повторяю: ~хреновая~.','D|Принято, товарищ майор.','S|А что делать?','M|Что-нибудь!'],
['P|Люда, а ты где обедаешь?','D|Дома. На диване. С котом.','P|Завидую.','D|Не завидуй. У кота на тебя аллергия.'],
['S|Я посчитал: за смену мы ловим шесть нарушителей.','P|А сегодня?','S|Сегодня ноль.','D|Сидоров, ты считать не умеешь. У нас вчера было ноль.'],
['P|Не нравится мне эта тишина.','D|Мне тоже.','S|А мне нравится! Можно поспать.','P|Сидоров, ~блин~!'],
['D|Кто-нибудь видел мою кружку?','S|Какую?','D|С котом.','P|Я видел. Она у Сидорова в бардачке.','S|Это эксперимент!'],
['P|Дорожники сегодня ленивые. Вон один спит в будке.','D|Не засматривайся, Петрович.','P|Сам завидую.'],
['D|Прогноз погоды: ясно, видимость хорошая.','S|А нарушители?','D|Прогноз по нарушителям: ~многовато~.'],
['P|Слушай, Сидоров, а у тебя девушка есть?','S|Есть. Шаурма.','P|Это не девушка, Сидоров.','S|Она добрая.'],
['M|Мне сегодня жена звонила.','P|Что хотела?','M|Хотела знать, почему я не дома.','D|И что вы сказали?','M|Что вы идиоты, и я не могу вас оставить.'],
['S|Петрович, а пончик вкуснее шаурмы?','P|Нет.','S|А блины?','P|Блины лучше всего.','D|Давайте потом, ребят.'],
['D|Всем постам! Пропал конус на семнадцатом километре!','P|Ну и ~хрен~ с ним.','D|Это казённый, Петрович.','S|Может, он просто ушёл погулять?'],
['P|Я тут в засаде, ничего не вижу.','S|А окно ты открыл?','P|Какое окно, у меня тонировка.','D|Петрович, сними плёнку, ты ослеп.'],
['D|Двенадцатый, ты где?','P|На посту.','D|На каком?','P|На том самом. Где беседка с шахматами.','D|~Блин~, Петрович!'],
['S|Люда, а можно вопрос по службе?','D|Давай.','S|А зарплата когда?','D|Не в эфире, Сидоров.'],
['S|А вы знали, что конус — это круглый треугольник?','P|Сидоров, помолчи.','D|Он не круглый.','S|А какой?','D|Конический. ~Блин~.'],
['D|Всем постам: если видите белую тачку, докладывайте.','S|А если она сзади?','D|Тоже докладывайте.'],
['P|Знаете, чего мне не хватает?','S|Шаурмы?','P|Нет. Тишины.','D|Ты же только что говорил, что тишина тебя бесит.','P|Бесит, но ~не хватает~.'],
['S|Петрович, а вот вы когда-нибудь в погоне были?','P|Был. Один раз. Потерял калошу.','S|Какую калошу?','P|Левую. До сих пор ищу.'],
['D|Двенадцатый, какой у тебя позывной?','P|Двенадцатый.','D|А у Сидорова?','S|Шаурма-один!','D|Нет. Ты — Тринадцатый.','S|Это ~несчастливое~ число!'],
['M|Люда, у вас там опять кот в эфире?','D|Нет, товарищ майор.','M|А кто мяукает?','D|Это Сидоров, он ~пробует~ новую рацию.','S|Мяу.'],
['P|Что-то стало скучно. Давайте ~кого-нибудь~ поймаем.','S|Давайте!','D|Только не меня.','P|Люда, ты и так ~в клетке~ сидишь.','D|~Хам~.']);
Object.assign(RAD,{
heal:['P|Он подобрал сердце? ~Блин~, у него теперь ещё жизнь!','S|Нечестно! У нас такого нет.','D|Жизнь — это не наша ~работа~, Сидоров.'],
shield:['S|У него щит! Прямо как в ~играх~!','P|Откуда у него щит, ~блин~?','D|Не ворчите, ловите так.'],
coin:['S|Он подбирает какие-то штуки! Это улики?','P|Это ~хрен~ знает что.','D|Записывайте всё, пригодится.'],
land:['P|Приземлился, ~блин~. Как кот.','S|Я бы так не смог.','D|Сидоров, ты бы и не поехал.'],
wrk:['D|Внимание: на трассе рабочие! Не сбивайте их, ~блин~!','P|Принял. Хотя этот ~мудак~ не услышит.','S|Они хоть в касках?']});
const rdAdd=(k,a)=>{RAD[k].push(...a);};
rdAdd('pr',['P|Не ~вертись~, не вертись!','S|Петрович, а можно я ему просто помашу?','P|Сидоров, ~заткнись~ и прижимай.']);
rdAdd('ov',['P|Иду на обгон. Сидоров, ты меня ~прикрываешь~?','S|Да я просто рядом еду.','P|Это и есть ~прикрытие~, ты ж ~дебил~.']);
rdAdd('rd',['P|Он как будто ~знает~, куда я поеду.','S|Телепат, ~блин~!']);
rdAdd('bump',['P|Он мне ~зад~ помял! Люда, это ~статья~!','D|Статья, статья. Запиши номер.','S|Я запишу! ~Блин~, у меня ручка кончилась.']);
rdAdd('spin',['P|Меня закрутило, ~нахуй~! Всё, я в ~кювете~.','S|Петрович, держись!','D|Держится он, ~как за соломинку~.']);
rdAdd('near',['P|Он ~впритирку~, ты видел?!','S|Я зажмурился, ~блин~.']);
rdAdd('gone',['P|Ну ты видел?! Ушёл как ~вода~ в песок!','M|Что значит «ушёл»?! Ищите ~сука~!']);
rdAdd('work',['M|Что там с рабочими? Мне звонят из ~администрации~!','P|Он ~сбил~, товарищ майор.','M|Задержать! Сейчас же!']);
rdAdd('head',['M|Двенадцатый! Что за лобовое?! Мне ~жена~ звонит!','P|Не знаю, товарищ майор, ~блин~, сам слышал.']);
rdAdd('dead',['M|Нарушитель задержан?!','P|Скорее, ~остановлен~.','M|Принято. Премии всё равно не будет.']);
rdAdd('hit',['P|Он, похоже, ~влетел~. Или его ~влетели~.','D|Слушай, ты говоришь ~как Сидоров~.']);
rdAdd('ramp',['M|Двенадцатый, он ~улетел~?','P|Так точно, товарищ майор.','M|Куда?','P|Не знаю. Куда-то ~вверх~.']);
rdAdd('nitro',['M|Что за вой двигателя?! Я слышу его ~через стену~!','P|Это он, товарищ майор. Нитро.']);
rdAdd('siren',['M|Всем постам, нарушитель в зоне. ~Не упустить~.']);
rdAdd('ice',['S|Лёд, ха! Он ~скользит~!','P|Мы тоже, Сидоров.']);
rdAdd('pud',['P|Лужа глубокая, ~блин~. Я бы не поехал.','D|Тебе и не надо.']);
rdAdd('pit',['P|Яма! Видел? ~Подвеска~ у него страдает.','S|А у меня ещё нет подвески.']);
rdAdd('low',['M|Двенадцатый, он почти готов?','P|Почти, товарищ майор.','M|Тогда не ~тормозите~!']);
rdAdd('mile',['M|Нарушитель набирает очки. Это что, ~соревнование~?','D|Нет, товарищ майор, это ~погоня~.']);
rdAdd('fast',['M|Скорость #S?! Вы там ~самолёт~ ловите?','P|Почти, товарищ майор.']);
rdAdd('new',['P|Нашёл! ~Блин~, как вовремя.','M|Двенадцатый, доклад!','P|Нарушитель в зоне видимости, номер #N.']);
/* ===== ещё фраз: Гена, эфирные помехи, поведенческие реакции ===== */
WHO.T=['Гена','#9be37a'];WHO.N=['Эфир','#8a8a8a'];
Object.assign(rdCoolK,{wall:28000,weave:26000,slow:28000,gas:32000,onc:22000,brk:30000,cone:14000,time:25000,two:3000});
const NOISE=['кхх... приём... кхх...','[шипение в эфире]','[кто-то громко жуёт шаурму]','[мяуканье Барсика]','[долгая тишина]','[где-то играет шансон]','[эхо: «Сидоров!»]','[Люда чихнула]','[хлопнула дверь]','[кто-то уронил рацию]','[у кого-то звонит телефон: «Смешарики»]','[Петрович вздохнул]','кхх... не слышно... кхх...','[скрип сиденья]','[шорох фантика]','[кто-то включил и выключил сирену]','[чей-то кашель]','[Гена ругается на эвакуатор]','[помехи, обрывок песни]','[в эфире стучит ложка в кружке]'];
const rdW={wall:0,weave:0,slow:0,gas:0,onc:0,brk:0};let rdTmN=30,rdN4=0;
SCN.c.push(
['T|Эвакуатор Гена на связи. Мужики, мне кого забирать?','P|Пока никого.','T|А я уже выехал. Бензин тратил, ~блин~.','D|Гена, жди команды.','T|Жду. С пирожками.'],
['S|Петрович, а если он остановится, что мне ему говорить?','P|«Документы предъявите».','S|А если он скажет «нет»?','P|Тогда «~сука~, документы!».','S|Понял! Записал.'],
['D|Двенадцатый, у тебя сын экзамен сдавал?','P|Сдал. На тройку.','D|Молодец!','P|Какой молодец, это позор! У нас в семье одни пятёрки.','S|Ты в школе троечником был, Петрович.','P|Заткнись, Сидоров, ~блин~.'],
['M|Слушайте, я сегодня утром ел кашу.','P|И как?','M|Гадость. Но съел.','S|Товарищ майор, а к чему вы?','M|К тому, что вы тоже должны это съесть. ~Блин~, быстрее!'],
['S|Петрович, а ты когда-нибудь падал с мотоцикла?','P|Падал. С велосипеда.','S|И что?','P|Зуб потерял. Вот этот. Золотой.','D|Мы знаем, Петрович. Он у тебя на каждом фото блестит.'],
['D|Двенадцатый, ты там не засыпаешь?','P|Нет, я моргаю медленно.','D|Это одно и то же.','S|А можно я тоже моргну?'],
['P|Люда, а правда, что ты за майора замуж вышла?','D|Что?! Кто сказал?!','S|Я! Я слышал, как вы вчера вместе ужинали.','D|Сидоров, это было совещание!','M|Я всё слышу, ребята.','P|~Пиздец~...'],
['S|Мне кажется, у него в багажнике золото.','P|Откуда?','S|Ну он так быстро едет.','D|Или шаурма у него.','S|~Блин~, надо догнать!'],
['P|Тамара ругается: говорит, я дома ничего не делаю.','D|А ты что делаешь?','P|Ловлю нарушителей, ~блин~.','D|Скажи, что это работа.','P|Она говорит, работа — это когда деньги платят.'],
['S|А у меня сегодня день рождения.','P|Поздравляю.','D|С днём рождения, Сидоров!','M|Поздравляю. Подарка не будет.','S|Спасибо, это лучший подарок.'],
['T|Эвакуатор Гена. Люда, ты мне за простой заплатишь?','D|Нет.','T|А премию?','D|Нет.','T|~Блин~, ну вы и скупердяи.'],
['P|Диспетчер, ты чувствуешь, как пахнет асфальтом?','D|Нет.','P|Свежим. Красота.','S|Я чувствую запах шаурмы.','P|Сидоров, ты неисправим, ~блин~.'],
['D|Двенадцатый, ты рапорт про вчерашнюю погоню написал?','P|Нет.','D|Почему?','P|Руки не дошли.','D|Тебе ноги оторвать, чтоб дошли?'],
['S|А что, если он сейчас остановится и скажет: «Я сдаюсь»?','P|Тогда мы победили.','S|А потом?','D|Потом обед.','S|Ура!'],
['P|Я в детстве мечтал стать лётчиком.','S|И что?','P|Зрение подвело.','D|Слух тоже.','P|~Блин~, Люда!'],
['M|Двенадцатый, вы где его видели в последний раз?','P|Прямо перед нами, товарищ майор.','M|А сейчас?','P|Тоже прямо.','M|~Блин~, и чего вы ждёте?!'],
['S|Я вчера нашёл в бардачке пряник. Засохший.','P|И что?','S|Съел.','D|Сидоров, это казённое!','S|Он тоже был нервный.'],
['P|Мне кажется, у моей тачки душа есть.','S|Это душа ржавчины, Петрович.','P|Заткнись.','D|Петрович, твоя душа ушла в отпуск ещё в девяностых.'],
['D|Ребята, а давайте сегодня все вместе поужинаем?','P|Где?','D|У меня дома.','S|А шаурма будет?','D|Будет. И Барсик.'],
['T|Мужики, я не понял. А что происходит?','D|Погоня, Гена.','T|А где?','P|Перед тобой.','T|~Блин~, я тут стою уже час.'],
['S|Петрович, а у тебя нога не затекла?','P|Затекла.','S|А что делать?','P|Терпеть, Сидоров. Терпеть.'],
['P|Люда, ты слышишь этот шум?','D|Какой?','P|Двигатель у него как у ракеты.','S|Это не двигатель, это мои нервы.'],
['M|Жду результатов через пять минут. Сроки горят!','D|Ясно, товарищ майор.','M|Ясно ей. А у меня давление, ~блин~.','S|Давайте я ему помашу, он испугается.'],
['D|Люди, прошу без крови.','P|Это не я.','S|Это не я.','M|Это никто, ~блин~.','T|А это кто?!'],
['P|Знаете, чем я горжусь?','S|Чем?','P|Тем, что за двадцать лет ни разу не опоздал.','D|Ты вчера опоздал на два часа.','P|Это исключение, Люда.'],
['S|Петрович, а если он нас сейчас обгонит?','P|Тогда ему повезёт.','S|А нам?','P|А нам нет.','D|Вот так всегда.'],
['D|Двенадцатый, кто сидит у тебя за спиной?','P|Никто.','D|А сирена?','P|Это Сидоров.','S|Это я! Я просто дую в неё.'],
['M|Через час у меня совещание. Ловите быстрее.','P|Товарищ майор, а без совещания никак?','M|Никак. Там пончики дают.','S|Я тоже хочу пончики!'],
['P|Слушай, Сидоров, а ты права получил?','S|Получил.','P|Сам сдавал?','S|Ну... почти.','D|Сидоров, ~блин~!'],
['D|Двенадцатый, у меня к тебе вопрос.','P|Слушаю.','D|Ты правда любишь свою работу?','P|Нет.','D|И я нет.','S|А я люблю шаурму.'],
['P|Он ведь даже не оглядывается.','S|Может, у него зеркало сломано?','D|Или совесть.','P|Совесть — это ~роскошь~ в наше время.'],
['S|Петрович, а можно мне тоже спецсигнал?','P|У тебя он есть.','S|А можно громче?','D|Сидоров, нельзя.','S|Эх... жизнь ~тяжёлая~.'],
['D|Всем постам: напоминаю, что на обед у нас перерыв.','P|А погоня?','D|Погоня подождёт.','S|Но он же ~убежит~!','D|Тогда без обеда, ~блин~.'],
['T|Люда, я слышал, у вас там ~драйв~.','D|Какой драйв, Гена?','T|Ну... погоня. Мне бы на неё посмотреть.','P|Приезжай. Только ~не мешай~.','T|Еду!']);
SCN.n.push(
['D|Всем постам: сегодня на трассе тишина. Подозрительно.','S|А можно я посплю?','P|Не сметь.','D|Сидоров, ты на посту.'],
['T|Эвакуатор Гена. Люда, я тут стою, мне скучно.','D|Гена, потерпи.','T|Скучно, ~блин~, сил нет.','S|А у меня шаурма. Хочешь?','T|Давай!'],
['P|Диспетчер, а вы знаете, что Барсик на радио в эфир попал?','D|Не может быть.','P|Мяукал всю ночь.','D|Это были помехи, ~блин~.'],
['S|Петрович, а вот вы бы смогли жить без работы?','P|Смог бы.','S|И чем бы занимались?','P|Спал бы. И Люду не слушал.','D|Я всё слышу, Петрович.'],
['M|Двенадцатый, как там обстановка?','P|Тихо.','M|А почему тихо?','P|Потому что мы не мешаем.','M|~Блин~, вы же должны мешать!'],
['D|Кто-нибудь видел, куда делась моя ручка?','S|Какая?','D|С Барсиком на конце.','P|Она у меня в кармане. Случайно.','D|Верни, ~сука~, это подарок!'],
['S|Петрович, у вас дети есть?','P|Двое.','S|А как зовут?','P|Не скажу, а то заберёшь.','D|Куда он их заберёт, Петрович?'],
['P|Диспетчер, где у нас сегодня радары?','D|На километре пятом.','P|А мы где?','D|На десятом.','P|~Блин~, так мы в ~другую~ сторону поехали?'],
['T|Гена на связи. Слушайте анекдот.','D|Не надо.','T|Приходит эвакуатор...','P|Гена, ~заткнись~.','T|...а там ~уже~ забрали.','S|Ха-ха!'],
['S|А можно я сегодня домой пораньше?','D|Нет.','S|А на обед?','D|Нет.','S|А на шаурму?','D|Ну ладно. На шаурму можно.'],
['D|Внимание всем: на трассе возможно появление белой тачки.','P|Опять?','D|Опять.','S|А ведь она красивая, ~блин~.','D|Сидоров, ты ~не фанат~, а полицейский.'],
['M|Люда, у вас там кто-то поёт?','D|Нет, товарищ майор.','M|А кто поёт «Прилетит вдруг волшебник»?','S|Это не я!','P|Это я. ~Ностальгия~.'],
['P|Мне жена сказала: «Принеси хлеба».','D|И что?','P|Забыл.','S|А она что?','P|Сказала, что не вернёт меня в дом без ~батона~.','D|Петрович, купи хлеб, ~блин~.'],
['D|Двенадцатый, ты видел новую форму?','P|Видел. Тесная.','D|А мне нравится.','S|А мне велика.','M|А мне ~пофиг~, надевайте!'],
['S|А вы знаете, что у светофора три цвета?','P|Знаем.','S|А у нас сколько?','P|Два. Красный и ~блин~.','D|Какой ещё второй?','P|~Матерный~.'],
['D|Ребята, а у кого ещё остались ~пончики~?','S|У меня.','D|Съешь?','S|Съел.','D|~Сука~, Сидоров!'],
['P|Тишина какая... как перед ~грозой~.','S|Будет гроза?','P|Будет. Лёд ещё ~не растаял~.','D|Какой лёд? ~Осень~ же!','P|А, ~блин~.'],
['T|Гена на связи. Слушайте, а у вас кофе есть?','D|Есть.','T|Дайте!','P|Приезжай.','T|Не могу. Эвакуатор ~без бензина~.','S|~Блин~, бедолага.'],
['D|Двенадцатый, у тебя ~колесо~ спущено.','P|Какое?','D|Левое заднее.','P|~Блин~, откуда знаешь?','D|Я ~всё~ знаю, Петрович.'],
['S|Петрович, а правда, что на трассе водятся ~кабаны~?','P|Какие кабаны?!','S|Ну... ~дикие~.','P|Сидоров, ты ~идиот~.','D|Он ~не~ идиот. Просто ~молодой~.'],
['M|Слушайте меня. Через пять минут ~проверка~.','D|Какая?','M|Ну... ~внеплановая~.','P|А что проверять?','M|Что вы ~работаете~.','S|А мы ~работаем~?','M|~Это~ и проверим.'],
['P|Люда, у тебя ~голос~ красивый.','D|Спасибо.','P|Как у ~радио~.','D|Я ~и есть~ радио, Петрович.','P|~Блин~, точно.'],
['S|Скажите, а что будет, если я ~засну~ за рулём?','P|Мы ~тебя~ разбудим.','S|А если ~не~ получится?','D|Тогда ~уволим~.','S|А ~заплатят~?','D|~Нет~.'],
['D|Всем постам: если увидите ~призрака~ — не ловите.','S|Почему?','D|~Он~ быстрее вас.','P|Это ~белая тачка~?','D|Возможно.'],
['T|Гена на связи. Я тут нашёл ~конус~ у обочины.','D|Чей?','T|Не знаю. ~Красивый~.','P|~Блин~, Гена, это ~казённый~.','T|Тогда ~верну~.'],
['P|Диспетчер, а вы ~замужем~?','D|Нет.','P|Почему?','D|~Никого~ достойного не нашла.','S|А я?','D|Сидоров, ты ~шаурма~.'],
['D|Всем постам: проверка связи ~раз-два~.','S|Три.','P|Четыре.','M|Пять. ~Блин~, хватит!'],
['S|Петрович, а правда, что ~майор~ боится ~кота~?','P|Правда.','S|Какого?','P|~Барсика~.','M|Я ~всё~ слышу!'],
['P|У меня ~отпуск~ скоро.','D|Куда поедешь?','P|На дачу. Утюг ~выключить~.','S|А ~потом~?','P|~Потом~ вернусь.','D|Петрович, ты ~неисправим~.']);
const rdAdd2=(k,a)=>{RAD[k]=(RAD[k]||[]);RAD[k].push(...a);};
Object.assign(RAD,{
cone:['S|Он конус сбил! Это ~вандализм~!','P|Казённый конус, ~блин~! Штраф ему.','D|Записываю: ещё один конус повержен.','M|Каждый конус стоит денег! ~Блядь~.',['P|Опять конус.','S|Мне его жалко.','P|Сидоров, это пластик.'],'D|Дорожники плачут.','P|Конусы — не шутки, ~блин~.','S|Один конус — один штраф, да?','T|Мужики, мне там конус эвакуировать?','M|Конус — это государственное имущество!'],
wall:['P|Он к отбойнику прижимается, ~блин~, боится.','S|Он так хочет слиться со стеной.','D|Не прижимайтесь к разделителю, нарушитель!',['P|Он к краю жмётся.','S|Может, ему в туалет?','P|Сидоров, ты достал.'],'M|Что он там делает у обочины?'],
weave:['P|Виляет, ~сука~, как ужом!','S|Как по слалому едет!','D|Нарушитель, держитесь в полосе!','M|Мне тошно смотреть, как он перестраивается.',['P|Опять вильнул.','S|Он танцует.','D|Это не танец, это нарушение.']],
slow:['P|Чё он плетётся? Сломался?','S|Может, ему бензин жалко?','D|Нарушитель сбросил скорость. Подозрительно.','M|Остановить и проверить документы!',['P|Он тормозит.','S|Это ловушка!','P|Сидоров, ты перегрелся.']],
gas:['P|Он вжал газ в пол.','S|Педаль не отпускает!','D|Скорость растёт. ~Блин~.',['M|Что с топливом?','P|Горит, товарищ майор.']],
brk:['P|Тормозит. Нервы сдали, ~блин~?','S|Он передумал убегать!','D|Тормоза — это хорошо.'],
onc:['D|Он на встречку выехал!','P|Там же лоб в лоб, ~псих~!','S|Я не смотрю!','M|Это самоубийство, ~блин~!',['P|Он на встречке!','D|~Блядь~, там же машины!','S|Они ему сигналят.']],
time:['D|Погоня идёт уже #T секунд. Я умираю от скуки.','P|#T секунд на ногах. ~Блин~, я не мальчик.','S|#T секунд! Рекорд по моим ощущениям.','M|#T секунд! Нарушитель ещё на свободе!','T|Мужики, вы там уже #T секунд. Мне долго ждать?'],
near5k:['D|У нарушителя уже #P очков. Финиш близко, ~блин~.','P|Всё, конец погони скоро.','S|Я уже чувствую шаурму после смены.','M|Почти конец. Не ~упустите~!'],
two:['D|У него осталось две жизни.','P|Значит, ещё поживёт.','S|Две? А сколько нужно?'],
low:[['T|Люда, мне ехать на место?','D|Подожди, Гена.','T|А когда?','D|Скоро.']]});
rdAdd2('bump',[['T|Люда, у вас ДТП? Мне выезжать?','D|Подожди, Гена.','T|Всегда жду. ~Блин~.']]);
rdAdd2('dead',[['T|Люда, а мне кого забирать?','D|Нарушителя.','T|Вместе с машиной?','D|Вместе с ~совестью~.']]);
rdAdd2('hit',['T|Слышу грохот. Мне выезжать?','P|Подожди, Гена.']);
rdAdd2('spin',['M|Петрович, ты что ~крутишься~?','P|Это не я, товарищ майор, это дорога.']);
rdAdd2('near',['D|Он на волоске был. Ты видел?','P|Видел. Чуть ~не~ поседел.']);
rdAdd2('ramp',['T|Он что, ~улетел~?','D|Улетел.','T|А мне его ~потом~ с неба забирать?']);
rdAdd2('work',['T|Рабочего ~забирать~?','D|Только если живой.','T|Тогда ~быстро~ еду.']);
rdAdd2('new',['S|Он сам нас нашёл! Это же ~судьба~!','P|Это ~не~ судьба, это ~дорога~.']);
rdAdd2('mile',['T|Мужики, он набрал #P! ~Блин~, это ~дорогой~ товарищ.']);
rdAdd2('fast',['T|У меня ~эвакуатор~ так ~не~ разгоняется.']);
rdAdd2('pr',['D|Сидоров, ты что-то ~совсем~ молчишь.','S|Я ~уши~ закрыл.']);
rdAdd2('gone',['T|Он что, ~ушёл~? А мне ~что~ тогда делать?']);
rdAdd2('siren',['T|Гена на связи. Если что — я ~рядом~.']);
rdAdd2('nitro',['T|У него ~ракета~ в багажнике! Люда, ~блин~!']);
const rdWatch=dt=>{const w=rdW,up=!!(keys.ArrowUp||keys.w),dn=!!(keys.ArrowDown||keys.s);
 w.wall=Math.abs(P.x)>5.6?w.wall+dt:0;if(w.wall>3){w.wall=0;rad('wall');}
 w.weave=HB.j>5?w.weave+dt:0;if(w.weave>2.5){w.weave=0;rad('weave');}
 w.slow=v<25?w.slow+dt:0;if(w.slow>3){w.slow=0;rad('slow');}
 w.gas=up?w.gas+dt:0;if(w.gas>6){w.gas=0;rad('gas');}
 w.brk=dn?w.brk+dt:0;if(w.brk>2.5){w.brk=0;rad('brk');}
 w.onc=(onT>0&&P.x<-4.1)?w.onc+dt:0;if(w.onc>1.2){w.onc=0;rad('onc');}};
const rdIdle=hc=>{if(rdQ.length||rdTy)return false;if(Math.random()<.2){rdQ.push({w:'N',x:pick(NOISE),idle:1});return true;}return rdScn(hc?'c':'n');};
let rdOpen=0,rdUn=0,rdMat=1,rdCD=9,rdHC=false,rdV=null,rdQ=[],rdWt=1.5,rdTy=null,rdTyT=0,rdLv=3,rdMs=1000,rdFs=0,rdHint=1;const rdA=[],rdKC={},rdLs={},rdBag={};
try{if(localStorage.getItem('rw_mat')==='0')rdMat=0;}catch(e){}
const rdP=document.createElement('div'),rdTb=document.createElement('div'),rdBd=document.createElement('b'),rdBody=document.createElement('div'),rdHd=document.createElement('div'),rdMb=document.createElement('span'),rdL=document.createElement('div'),rdPk=document.createElement('div');
rdP.className='rw-radio';rdTb.className='rw-rtab';rdTb.textContent='📻';rdTb.title='Рация (R)';rdTb.appendChild(rdBd);rdPk.className='rw-pk';
rdBody.className='rw-rbody';rdHd.className='rw-rh';rdHd.innerHTML='<span>📻 РАЦИЯ ДПС</span>';rdMb.className='rw-rm';rdL.className='rw-rlog';
const RSW=/(бля|блин|пизд|ху[йеяё]|хрен|хрень|[её]б|сук|нах|мудак|долб|урод|гад|дебил|идиот|зараз|псих|отмороз|дурак)/i;
const rdFmt=x=>x.replace(/~([^~]+)~/g,(m,w)=>rdMat||!RSW.test(w)?w:w[0]+'*'.repeat(w.length-1));
const rdTk=x=>x.replace(/#N/g,P.plate||'').replace(/#S/g,Math.round(v*3.6)).replace(/#L/g,lives).replace(/#P/g,score()).replace(/#T/g,Math.round(t));
const rdR=()=>{rdL.textContent='';for(const m of rdA){const d=document.createElement('div'),a=document.createElement('s'),b=document.createElement('b'),x=document.createElement('span');d.className='rw-rl';a.textContent=m.t;b.textContent=m.w[0]+':';b.style.color=m.w[1];x.textContent=rdFmt(m.x);d.append(a,b,x);rdL.appendChild(d);}
 if(rdTy){const d=document.createElement('div');d.className='rw-rl rw-ty';d.textContent=WHO[rdTy.w][0]+' печатает…';rdL.appendChild(d);}rdL.scrollTop=1e9;};
const rdMt=()=>{rdMb.textContent=rdMat?'🤬 мат: вкл':'🙂 мат: выкл';};rdMt();
rdMb.onclick=ev=>{ev.stopPropagation();rdMat=rdMat?0:1;try{localStorage.setItem('rw_mat',String(rdMat))}catch(e){}rdMt();rdR();};
rdHd.appendChild(rdMb);rdBody.append(rdHd,rdL);rdP.append(rdPk,rdTb,rdBody);
const rdTog=()=>{rdOpen^=1;rdP.classList.toggle('open',!!rdOpen);if(rdOpen){rdUn=0;rdBd.style.display='none';rdTb.classList.remove('new');rdL.scrollTop=1e9;}};
rdTb.onclick=rdTog;rdP.addEventListener('pointerdown',ev=>ev.stopPropagation());
rdP.style.display='none';box0.appendChild(rdP);
const rdVis=()=>{const s=st==='play';if(s!==rdV){rdV=s;rdP.style.display=s?'flex':'none';}};
const rdPeek=(c,n,x)=>{rdPk.textContent='';const b=document.createElement('b'),sp=document.createElement('span');b.textContent=n?n+': ':'';b.style.color=c;sp.textContent=rdFmt(x);rdPk.append(b,sp);rdPk.classList.remove('on');void rdPk.offsetWidth;rdPk.style.animationDuration=(3.2+x.length*.05).toFixed(1)+'s';rdPk.classList.add('on');};
const rdClr=()=>{rdA.length=0;rdQ=[];rdTy=null;rdWt=1.5;rdUn=0;rdBd.style.display='none';rdTb.classList.remove('new');rdPk.classList.remove('on');rdCD=9;rdHC=false;rdLv=3;rdMs=1000;rdFs=0;rdHint=1;for(const k in rdKC)delete rdKC[k];for(const k in rdW)rdW[k]=0;rdTmN=30;rdN4=0;rdR();};
const rdEmit=m=>{const w=WHO[m.w],x=rdTk(m.x),q=Math.floor(t);rdA.push({t:String(Math.floor(q/60)).padStart(2,'0')+':'+String(q%60).padStart(2,'0'),w,x});if(rdA.length>80)rdA.shift();rdR();if(!rdOpen){rdUn++;rdBd.textContent=rdUn;rdBd.style.display='block';rdTb.classList.add('new');rdPeek(w[1],w[0],x);}};
const rdPump=dt=>{if(rdTy){rdTyT-=dt;if(rdTyT<=0){const m=rdTy;rdTy=null;rdWt=1.2+Math.min(1.6,m.x.length*.02);rdEmit(m);}return;}
 rdWt-=dt;if(rdWt>0||!rdQ.length)return;const m=rdQ.shift();rdTy=m;rdTyT=.7+Math.min(1.6,m.x.length*.022);rdR();};
const rdLines=it=>(Array.isArray(it)?it:[it]).map(l=>({w:l[0],x:l.slice(2)}));
const rad=(k,imp)=>{const p=RAD[k];if(!p)return;const n=performance.now();if(!imp&&rdKC[k]&&n-rdKC[k]<(rdCoolK[k]||7000))return;if(!imp&&rdQ.length>=5)return;rdKC[k]=n;let it;do{it=pick(p);}while(p.length>1&&it===rdLs[k]);rdLs[k]=it;rdQ=rdQ.filter(m=>!m.idle);for(const m of rdLines(it)){m.imp=!!imp;rdQ.push(m);}};
const rdScn=k=>{if(rdQ.length||rdTy)return false;const p=SCN[k];let b=rdBag[k];if(!b||!b.length)b=rdBag[k]=p.map((_,i)=>i).sort(()=>Math.random()-.5);for(const m of rdLines(p[b.pop()])){m.idle=1;rdQ.push(m);}return true;};
const RDX=[[/НА ЗАДНИЕ/,'wh'],[/СТОППИ/,'sk'],[/Прижимает/,'pr'],[/Обгоняет/,'ov'],[/Читает/,'rd'],[/ДПС въехал|ДПС задел|ДПС вас/,'bump'],[/закрутило/,'spin'],[/впритирку/,'near'],[/ушёл от ДПС/,'gone'],[/Сбил рабочего/,'work'],[/Лобовое/,'head'],[/Авария/,'dead'],[/Удар/,'hit'],[/ТРАМПЛИН/,'ramp'],[/НИТРО/,'nitro'],[/сзади сирена/,'siren'],[/ГОЛОЛЁД/,'ice'],[/ЛУЖА/,'pud'],[/ЯМА/,'pit'],[/Щит|ЩИТ/,'shield'],[/жизнь/,'heal'],[/^\+100|^\+150/,'coin'],[/РАБОЧИЕ/,'wrk'],[/Приземлился/,'land']];
const rdReact=s=>{if(st!=='play')return;for(const r of RDX)if(r[0].test(s)){rad(r[1],/Авария|Сбил/.test(s));return;}};
function rdTick(dt){const hc=E.some(e=>e.k==='cop');if(hc&&!rdHC)rad('new',1);rdHC=hc;if(lives<rdLv){if(lives===1)rad('low',1);else if(lives===2)rad('two',1);}rdLv=lives;
 const sc=score();if(sc>=rdMs){rdMs+=1000;rad('mile');}if(!rdFs&&v*3.6>=200){rdFs=1;rad('fast');}
 if(rdHint&&t>2){rdHint=0;rdPeek('#9fd0ff','','📻 Рация ДПС: жми R или вкладку справа');}
 rdWatch(dt);if(t>=rdTmN){rdTmN+=30;rad('time');}if(!rdN4&&sc>=4000){rdN4=1;rad('near5k',1);}
 rdCD-=dt;if(rdCD<=0){if(rdIdle(hc))rdCD=hc?rnd(9,15):rnd(14,22);else rdCD=2;}
 rdPump(dt);}
const say=(s,c)=>{toast.textContent=s;toast.style.color=c||'#ffd54a';toast.classList.remove('on');void toast.offsetWidth;toast.classList.add('on');rdReact(s);};
const hearts=()=>{hH.textContent='♥'.repeat(Math.max(0,lives))+'♡'.repeat(3-Math.max(0,lives));};
const mkCrate=()=>{if(!mkCrate.G){mkCrate.G=new THREE.BoxGeometry(1.1,.8,1.1);mkCrate.L=new THREE.BoxGeometry(1.2,.14,1.2);mkCrate.M=new THREE.MeshStandardMaterial({color:0xff9a1f,emissive:0xff6a00,emissiveIntensity:.55,roughness:.5,metalness:.25});mkCrate.D=new THREE.MeshStandardMaterial({color:0x4a3418,roughness:.7});}
 const g=new THREE.Group(),p=new THREE.Group(),b=new THREE.Mesh(mkCrate.G,mkCrate.M),l=new THREE.Mesh(mkCrate.L,mkCrate.D),s=new THREE.Sprite(glowM);l.position.y=.47;p.add(b,l);s.scale.set(4,4,1);p.position.y=1.2;s.position.y=1.2;g.add(p,s);g.userData.p=p;return g;};
function add(k,x,z,o){const e=Object.assign({k,x,z},o);if(MASS[k])e.g.rotation.order='YXZ';e.g.position.set(x,0,z);scene.add(e.g);E.push(e);}
function kill(e){scene.remove(e.g);e.g.userData.tex&&e.g.userData.tex.dispose();e.g.traverse(o=>{const q=o.geometry;if(q&&(q.userData.mg||(e.g.userData.own&&!q.userData.sh)))q.dispose();});}
const PHW=.92,PHD=2.1;
function laneOK(l,s,hd,oz){const z0=-175;
 for(const e of E){if(e.l!==l||e.fly||e.dead)continue;
  const ez=e.z+(e.oz||0),gap=(ez-e.hd)-(z0+oz+hd);
  if(gap<4)return false;
  if(e.s>s+.01){const tc=gap/(e.s-s),tl=(30-ez)/Math.max(3,v-e.s);if(tc<tl*1.5+2)return false;}}
 return true;}
function laneClear(e,l2){if(l2<0||l2>3)return 0;let c=999;
 for(const o of E){if(o===e||o.dead||o.fly||o.k==='token'||o.l!==l2)continue;const dz=o.z-e.z;if(dz>-12-o.hd&&dz<40+o.hd)return 0;c=Math.min(c,Math.abs(dz));}
 return c;}
function arrowDir(e){const a=laneClear(e,e.l-1),b=laneClear(e,e.l+1);return a<=0&&b<=0?0:a>b?-1:1;}
/* --- новые препятствия: лужа, яма, гололёд, рабочие --- */
const ZS={};function mkZ(i){if(!ZS.g){const mm=(c,o,e)=>new THREE.MeshStandardMaterial({color:c,transparent:true,opacity:o,roughness:.06,metalness:.55,emissive:e||0,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2});
const cg=r=>{const g=new THREE.CircleGeometry(r,28);g.rotateX(-Math.PI/2);g.userData.sh=1;return g;};
const pg=new THREE.PlaneGeometry(3.6,14);pg.rotateX(-Math.PI/2);pg.userData.sh=1;
ZS.g=[cg(1.5),cg(.9),pg];ZS.m=[mm(0x2c4466,.6,0x0a1624),mm(0x070605,.96,0),mm(0xa6dcff,.5,0x2a6a96)];}
const m=new THREE.Mesh(ZS.g[i],ZS.m[i]);m.position.y=.04+i*.005;if(i<2)m.scale.z=i?1.25:.85;m.renderOrder=2;return m;}
function mkWorker(){const g=new THREE.Group(),f=new THREE.Group(),M=(c,e)=>new THREE.MeshStandardMaterial({color:c,roughness:.7,emissive:e||0});
const bx=(w,h,d,c,x,y,z,e)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M(c,e));m.position.set(x,y,z);return m;};
f.add(bx(.45,.75,.25,0x23303a,0,.38,0),bx(.55,.7,.32,0xff7a00,0,1.1,0,0x442000),bx(.57,.08,.34,0xffffff,0,1.1,0,0x888888),bx(.12,.55,.12,0xff7a00,-.36,1.1,0),bx(.12,.55,.12,0xff7a00,.36,1.1,0),bx(.4,.12,.4,0xffd21a,0,1.88,0,0x554400));
const hd=new THREE.Mesh(new THREE.SphereGeometry(.17,10,8),M(0xe0b090));hd.position.y=1.65;f.add(hd);
const sg=new THREE.Mesh(new THREE.BoxGeometry(.8,.8,.06),M(0xffc400,0x886000));sg.rotation.z=Math.PI/4;sg.position.y=2.8;
const ex=bx(.1,.42,.08,0x111111,0,0,.05);ex.rotation.z=-Math.PI/4;sg.add(ex);
g.add(f,sg);g.userData.fig=f;g.userData.sign=sg;g.userData.own=1;return g;}
function mk(type,l){const x=LX[l],z=-175;if(onT>0&&l===0)return 0;
 if(type==='puddle'||type==='pit'||type==='ice'){const hd=type==='ice'?7:1.6;if(!laneOK(l,0,hd,0))return 0;add(type,x,z,{l,hw:type==='ice'?2:type==='puddle'?1.5:1,hd,s:0,s0:0,g:mkZ(type==='puddle'?0:type==='pit'?1:2)});return 1;}
 if(type==='worker'){if(l!==0&&l!==3)return 0;if(!laneOK(l,0,.7,0))return 0;const sd=l?1:-1;add('worker',sd*7.6,z,{l,hw:.45,hd:.45,s:0,s0:0,ph:0,tx:sd*5.2,g:mkWorker()});return 1;}
 if((type==='truck'||type==='block'||type==='ramp')&&E.filter(q=>!q.dead&&(q.k==='truck'||q.k==='block'||q.k==='ramp')&&Math.abs(q.z-z)<30).length>=1)return 0;
 if(type==='car'){const s=LS[l];if(!laneOK(l,s,2.16,0))return 0;add('car',x,z,{l,hw:1,hd:2.16,s,s0:s,g:mkHero(mkPlate(),carOpts())});return 1;}
 if(type==='truck'){const s=LS[l]*.8;if(!laneOK(l,s,4.6,-.375))return 0;add('truck',x,z,{l,hw:1.35,hd:4.6,oz:-.375,s,s0:s,g:mkCar(pick([210,40,0]),mkPlate(),1)});return 1;}
 if(type==='ramp'){const s=LS[l]*.6;if(!laneOK(l,s,4.6,-.375))return 0;add('ramp',x,z,{l,hw:1.35,hd:4.6,oz:-.375,s,s0:s,g:mkRamp()});return 1;}
 if(type==='cone'){if(!laneOK(l,0,.6,0))return 0;add('cone',x-.8,z,{l,hw:.35,hd:.35,s:0,s0:0,g:mkCone()});add('cone',x+.8,z-1,{l,hw:.35,hd:.35,s:0,s0:0,g:mkCone()});return 1;}
 if(type==='block'){if(!laneOK(l,0,.5,0))return 0;add('block',x,z,{l,hw:1.8,hd:.5,s:0,s0:0,g:mkBlock()});return 1;}
 if(!laneOK(l,0,1,0))return 0;add('token',x,z,{l,hw:1,hd:1,s:0,s0:0,g:mkToken()});return 1;}
function row(){const ease=cl(t/70,0,1),ls=[0,1,2,3].sort(()=>Math.random()-.5),
 p2=t>12?Math.min(.5,.1+(t-12)/150):0,p3=t>40?Math.min(.28,(t-40)/300):0,n=Math.min(2,1+(Math.random()<p2?1:0)+(Math.random()<p3?1:0));
 if(t>25&&rampCD<=0&&Math.random()<.3&&!E.some(e=>e.k==='ramp')){for(const l of ls)if(mk('ramp',l)){rampCD=rnd(55,80);rowT=rnd(60,80);return;}}
 if(t>(CHASE?5:18)&&copCD<=0&&Math.random()<(CHASE?.7:.4)&&E.filter(e=>e.k==='cop'&&!e.dead).length<(CHASE?Math.min(3,1+(stars()>>1)):1)){const l=ri(4);add('cop',LX[l],48,{l,hw:1,hd:2.16,s:v+16,m:0,n:0,tm:0,sd:1,g:mkCop()});copCD=rnd(45,65)/(CHASE?1+stars()*.45:1);sfx('radio');say('🚨 Сзади ДПС! Погоня!','#7fb2ff');}
 if(t>45&&onCD<=0&&onT<=0&&Math.random()<.25){onT=11;onCD=rnd(60,90);sfx('horn');say('⚠️ ВСТРЕЧКА! Левая полоса!','#ff5a4a');}
 if(onT>0&&!E.some(q=>q.on&&q.z<-150)&&Math.random()<.75){const g2=mkHero(mkPlate(),carOpts());add('car',LX[0],-175,{l:0,on:1,hw:1,hd:2.16,s:-34,s0:-34,g:g2});g2.rotation.y=Math.PI;}
 if(t>10&&zCD<=0&&Math.random()<.35){const ty=pick(t>35?['puddle','pit','ice','worker']:['puddle','pit']);if(mk(ty,ty==='worker'?pick([0,3]):ri(4)))zCD=rnd(14,26);}
 let k=0;
 for(let i=0;i<4&&k<n;i++){const l=ls[i],r=Math.random(),first=r<.4?'car':r<.5?(t>18?'truck':'car'):r<.72?'cone':r<.85?'block':'token';
  for(const ty of[first,...['car','block','cone','token',...(t>18?['truck']:[])].sort(()=>Math.random()-.5)])if(mk(ty,l)){k++;break;}}
 if(PKT.length&&t>=PKT[0]&&!E.some(q=>q.part)){const pl2=ls.find(q=>laneOK(q,0,1,0));if(pl2!==undefined){PKT.shift();add('token',LX[pl2],-175,{l:pl2,hw:1,hd:1,s:0,s0:0,part:1,g:mkCrate()});}}
 if(heartCD<=0&&lives<3&&t>15&&Math.random()<.3&&!E.some(q=>q.heart)){const hl=ls.find(q=>laneOK(q,0,1,0));if(hl!==undefined){add('token',LX[hl],-175,{l:hl,hw:1,hd:1,s:0,s0:0,heart:1,g:mkHeart()});heartCD=rnd(35,55);}}
 if(shCD<=0&&t>30&&Math.random()<.12&&!E.some(q=>q.shield)){const sl=ls.find(q=>laneOK(q,0,1,0)&&!E.some(o=>(o.heart||o.shield)&&o.l===q&&o.z<-165));if(sl!==undefined){add('token',LX[sl],-175,{l:sl,hw:1,hd:1,s:0,s0:0,shield:1,g:mkShield()});shCD=rnd(90,140);}}
 rowT=rnd(24,40)*(.9+v/80)*(1+(1-ease)*.9);}
function follow(dt){
 const V=E.filter(e=>(e.k==='car'||e.k==='truck'||e.k==='ramp')&&!e.on&&!e.dead&&!e.fly).sort((a,b)=>a.z-b.z);
 for(const f of V){const fz=f.z+(f.oz||0);let L=null,ld=1e9;
  for(const o of E){if(o===f||o.l!==f.l||o.fly||o.dead||o.k==='token')continue;const oz=o.z+(o.oz||0);if(oz<fz&&fz-oz<ld){ld=fz-oz;L=o;}}
  const gap=L?ld-f.hd-L.hd:1e9;f.br=!!(L&&gap<18&&f.s>L.s+.3);
  if(L&&gap<18&&f.s>L.s)f.s+=(L.s-f.s)*Math.min(1,dt*3);else if(gap>26)f.s+=(f.s0-f.s)*Math.min(1,dt*.7);
  if(L&&gap<1.2){f.z=L.z+(L.oz||0)+L.hd+1.2+f.hd-(f.oz||0);f.s=Math.min(f.s,L.s);}}}
const MASS={car:1,truck:2.8,cop:1.15};
const DG=new THREE.BoxGeometry(.35,.12,.55),DMT=[0x222226,0xcfcfcf,0xd13a1c].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:.6}));
function debris(x,z,n,sp){if(E.filter(q=>q.k==='deb').length>26)return;for(let i=0;i<n;i++){add('deb',x+rnd(-.8,.8),z+rnd(-1,1),{fly:1,vx:rnd(-sp,sp),vy:rnd(3,sp*.9),hw:.2,hd:.2,s:0,g:new THREE.Mesh(DG,pick(DMT))});E[E.length-1].g.position.y=.5;}}
function impactFX(e,x,z,I){burst(x,.7,z,cl(Math.floor(I*1.2),4,34),cl(I*.5,5,12));shake=Math.max(shake,cl(I*.03,.12,.5));sfx('cone',cl((e.x-P.x)/3,-1,1));if(I>6)debris(x,z,cl(Math.floor(I/4),2,5),cl(I*.6,5,11));}
function dynKick(e,lv,yv,T){e.lvx=(e.lvx||0)+lv;e.yawV=(e.yawV||0)+yv;e.dyn=Math.max(e.dyn||0,T||1.6);e.rlV=(e.rlV||0)+cl(-lv*.12,-1.6,1.6);e.ptV=(e.ptV||0)+rnd(-.7,.7);}
function crashSide(e,sg,ez,J){if((e.cc||0)>0)return;e.cc=.3;const mE=MASS[e.k],dvz=Math.abs(v-e.s),ys=ez<0?-sg:sg;
 dynKick(e,-sg*J/(1+mE)*1.6,ys*(.8+dvz*.05)/mE*rnd(.7,1.2),1.8);
 P.yawV=(P.yawV||0)+ys*(1.2+dvz*.04)*rnd(.8,1.2);P.rlV=(P.rlV||0)+sg*2.2;impactFX(e,(P.x+e.x)/2,ez,J+dvz);}
function crashRear(e,ddx){if((e.cc||0)>0)return;e.cc=.3;const mE=MASS[e.k],dv=Math.max(0,v-e.s),r=1.3,off=cl(ddx/1.4,-1,1);
 v=Math.max(v-(mE/(1+mE))*dv*r,e.s*.85);e.s+=(1/(1+mE))*dv*r;
 dynKick(e,-off*dv*.12/mE,off*dv*.07/mE,1.6);P.ptV=(P.ptV||0)-Math.min(3,dv*.25);P.yawV=(P.yawV||0)-off*.6*Math.min(1,dv/10);
 impactFX(e,(P.x+e.x)/2,e.z,dv*1.2+2);}
function crashBump(e){if((e.cc||0)>0)return;const mE=MASS[e.k],dv=Math.max(0,e.s-v);e.cc=.3;if(dv<=0)return;
 v+=(mE/(1+mE))*dv*1.2;e.s-=(1/(1+mE))*dv*1.2;P.ptV=(P.ptV||0)+Math.min(3,dv*.2);dynKick(e,rnd(-1,1)*dv*.1,rnd(-1,1)*dv*.05,1.2);impactFX(e,P.x,e.z,dv);}
function vvCollide(a,b){const ma=MASS[a.k],mb=MASS[b.k],az=a.z+(a.oz||0),bz=b.z+(b.oz||0),dx=b.x-a.x,dz=bz-az,ox=a.hw+b.hw-Math.abs(dx),oz=a.hd+b.hd-Math.abs(dz);
 if(ox<=0||oz<=0)return;const fresh=!((a.cc||0)>0&&(b.cc||0)>0);
 if(ox<oz){const sg=dx<0?-1:1,tm=ma+mb;a.x-=sg*ox*mb/tm;b.x+=sg*ox*ma/tm;
  if(fresh){const rel=((a.lvx||0)-(b.lvx||0))*sg,j=1.45*Math.max(rel,2.5)/(1/ma+1/mb);dynKick(a,-sg*j/ma*.5,-sg*rnd(.5,1.2)/ma,1.6);dynKick(b,sg*j/mb*.5,sg*rnd(.5,1.2)/mb,1.6);a.cc=b.cc=.3;impactFX(a,(a.x+b.x)/2,(a.z+b.z)/2,Math.abs(rel)+3);}}
 else{const fr=dz<0?b:a,rr=dz<0?a:b,mF=MASS[fr.k],mR=MASS[rr.k],dv=Math.max(0,rr.s-fr.s);
  rr.z=fr.z+(fr.oz||0)+fr.hd+rr.hd-(rr.oz||0);
  if(fresh){if(dv>0){rr.s-=(mF/(mF+mR))*dv*1.3;fr.s+=(mR/(mF+mR))*dv*1.3;}const off=cl((rr.x-fr.x)/1.4,-1,1);dynKick(fr,off*dv*-.08/mF,off*dv*.06/mF,1.6);dynKick(rr,0,-off*dv*.03,1);a.cc=b.cc=.3;if(dv>2)impactFX(fr,fr.x,fr.z,dv);}}}
function dynStep(e,dt){const lvP=e.dyn>0?(e.lvx||0):(e.px==null?0:(e.x-e.px)/dt);e.cc=(e.cc||0)-dt;
 if(e.dyn>0||Math.abs(e.yaw||0)>.01||Math.abs(e.yawV||0)>.05){e.dyn=Math.max(0,(e.dyn||0)-dt);
  const spin=Math.abs(e.yawV||0),g=cl(1-spin/7,.15,1);
  e.yawV=(e.yawV||0)+(-(e.yaw||0)*9*g-(e.yawV||0)*(.7+1.4*g))*dt;e.yaw=(e.yaw||0)+e.yawV*dt;
  if(e.yaw>Math.PI)e.yaw-=6.2832;else if(e.yaw<-Math.PI)e.yaw+=6.2832;
  e.lvx=(e.lvx||0)+((-Math.sin(e.yaw)*Math.max(e.s,6))-(e.lvx||0))*Math.min(1,dt*(1.2+3*g));e.x+=e.lvx*dt;
  if(Math.abs(e.x)>7.6){const sg=e.x>0?1:-1;e.x=sg*7.6;if(Math.abs(e.lvx)>2){burst(e.x+sg*.8,.5,e.z,12,6);e.yawV+=-sg*rnd(.5,1.3);shake=Math.max(shake,.1);}e.lvx*=-.35;}
  e.s-=Math.abs(Math.sin(e.yaw))*e.s*dt*1.3;if(Math.abs(e.lvx)>3&&Math.random()<.6)burst(e.x,.12,e.z,1,3);
  if(e.dyn<=0&&Math.abs(e.yaw)<.04&&Math.abs(e.lvx)<.5){e.yaw=0;e.yawV=0;e.lvx=0;}}
 if(e.k!=='cop'){e.l=cl(Math.round((e.x+6)/4),0,3);if(!(e.dyn>0))e.x+=(LX[e.l]-e.x)*Math.min(1,dt*2.5);}
 const tp=(e.br?-.05:0)+cl((e.s-(e.ps==null?e.s:e.ps))/Math.max(dt,.001)*.0006,-.03,.03),tr=cl(-lvP*.012,-.14,.14);
 e.ptV=(e.ptV||0)+(((tp-(e.pt||0))*70)-(e.ptV||0)*8.5)*dt;e.pt=(e.pt||0)+e.ptV*dt;
 e.rlV=(e.rlV||0)+(((tr-(e.rl||0))*65)-(e.rlV||0)*8)*dt;e.rl=(e.rl||0)+e.rlV*dt;
 e.ps=e.s;e.px=e.x;const g=e.g;g.rotation.x=cl(e.pt,-.5,.5);g.rotation.z=cl(e.rl,-.6,.6);g.rotation.y=(e.yaw||0)+(e.steer||0);}
function copBlk(e,x,la){for(const o of E){if(o===e||o.k==='token'||o.k==='cone'||o.dead||o.fly)continue;const dd=o.z-e.z;if(Math.abs(o.x-x)<o.hw+e.hw+.6&&dd<o.hd+e.hd&&dd>-(la+o.hd+e.hd))return o;}return null;}
function copSpin(e,dir,msg){if(e.m===30)return;e.m=30;e.tm=0;e.hit=1;dynKick(e,dir*rnd(9,13),dir*rnd(8,12),2.4);e.sy=0;bonus+=120;sfx('crash',cl((e.x-P.x)/3,-1,1));say(msg||'ДПС закрутило! +120','#ffd54a');burst(e.x,.5,e.z,26,8);shake=Math.max(shake,.3);}
function copAI(e,dt){
 const hh=cl((t-20)/70,0,1),Lr=(a,c)=>a+(c-a)*hh,px=cl(P.x+P.vx*(.1+.25*hh),-6.8,6.8);
  if(e.m===30){e.tm+=dt;e.s+=((v-20)-e.s)*Math.min(1,dt*2.4);e.br=1;e.g.userData.sir(Math.floor(t*14)%2===0);if(e.tm>2.3){e.m=3;e.tm=0;e.spun=1;}return;}
 if(e.dyn>0){e.s+=((v-8)-e.s)*Math.min(1,dt*1.5);e.br=0;e.g.userData.sir(Math.floor(t*6)%2===0);return;}
 e.l=cl(Math.round((e.x+6)/4),0,3);e.tm+=dt;e.cd=(e.cd||0)-dt;const dz=e.z,sd=e.sd;let tx=e.x,ts=v,lat=6,br=0;
 if(e.hit&&(e.m===1||e.m===2||e.m===21)){e.m=3;e.tm=0;}
 if(e.m===0){ts=v+(dz>16?Lr(10,16):Lr(4,8));tx=cl(px+sd*4,-6.5,6.5);
  if(dz<8&&e.tm>Lr(3.2,1.3)&&e.cd<=0){const wall=Math.abs(P.x)>4.2,weav=HB.j>4.5,a=Math.random();e.m=wall?1:weav?(a<.7?2:1):(a<.5?1:2);e.tm=0;e.ft=0;e.wl=0;e.sd=P.x>0?-1:1;sfx(e.m===1?'warn':'whoosh');say(e.m===1?'Прижимает!':'Обгоняет...','#7fb2ff');}}
 else if(e.m===1){const tele=Lr(1.5,.9);
  if(e.tm<tele){ts=v+cl(dz*2.2,-12,12);tx=px+sd*2.9;lat=Lr(6,8);}
  else{if(!e.ft){e.ft=1;if(hh>.3&&Math.abs(P.vx)>3){e.sd=Math.sign(P.vx);say('Читает манёвр!','#ff6b4a');}}
   const off=Lr(2.2,0)*1,k=cl((hh-.25)/.6,0,1),of2=2.2*(1-k);tx=px+e.sd*of2;lat=Lr(6.5,9.5);ts=v+cl(dz*2.2,-8,8);
   if(Math.abs(e.x)>=6.4&&Math.abs(P.x-e.x)>2.2&&!e.wl){e.wl=1;if(Math.random()<.55){copSpin(e,e.x>0?1:-1,'ДПС влетел в отбойник! +120');return;}}}
  if(e.tm>tele+1.7){e.m=3;e.tm=0;e.ft=0;}}
 else if(e.m===2){ts=v+Lr(9,13);tx=px+sd*3.5;lat=8;if(dz<-13){e.m=21;e.tm=0;}}
 else if(e.m===21){tx=px;lat=7;const al=Math.abs(e.x-P.x)<1.3;ts=al?v-Lr(5,11):v+3;br=al;
  if(al&&!e.sy){e.sy=1;sfx('horn');say('Подрезал!','#ff6b4a');if(Math.random()<.22+.18*hh){copSpin(e,e.x>=0?1:-1,'Подрезал и сам закрутился! +120');return;}}
  if(e.tm>3.2){e.m=3;e.tm=0;e.sy=0;}}
 else{ts=v-12;tx=cl(px+sd*4.2,-6.5,6.5);lat=7;
  if(dz>16){if(e.spun){e.dead=1;say('ДПС выбыл из погони','#7fb2ff');copCD=Math.min(copCD,rnd(14,22));return;}
   if(++e.n>=2+(hh>.6?1:0)){bonus+=300;sfx('coin');say('Оторвался от ДПС! +300','#7fb2ff');e.dead=1;return;}
   e.m=0;e.tm=0;e.hit=0;e.nm=0;e.ft=0;e.wl=0;e.cd=Lr(2.5,.6);e.sd=P.x>0?-1:1;}}
 {const la=8+cl(e.s*.3,0,16),bo=copBlk(e,tx,la);
  if(bo){let bx=null,bd=1e9;for(const lx of LX){if(!(e.z>-2&&Math.abs(lx-P.x)<2.9)&&!copBlk(e,lx,la)){const d2=Math.abs(lx-tx);if(d2<bd){bd=d2;bx=lx;}}}
   if(bx!==null&&Math.abs(bx-e.x)<9)tx=bx;else ts=Math.min(ts,Math.max(bo.s-2,0)+Math.max(0,e.z-bo.z-bo.hd-e.hd)*.5);}
  const ob=copBlk(e,e.x,la*.7);if(ob&&ob.s<e.s&&e.z>ob.z)ts=Math.min(ts,ob.s+Math.max(0,e.z-ob.z-ob.hd-e.hd)*.6);}
 {const gap=e.z-(e.hd+PHD);if(gap>-.5&&gap<16&&Math.abs(e.x-P.x)<e.hw+PHW+1){ts=Math.min(ts,v+cl((gap-6)*1.3,-16,6));if(gap<10)tx=cl(P.x+(e.x>=P.x?1:-1)*3.3,-6.5,6.5);}}
 e.x=cl(e.x+cl((tx-e.x)*5,-lat,lat)*dt,-6.5,6.5);e.s+=(ts-e.s)*Math.min(1,dt*3);e.br=br||ts<e.s-3;
 e.steer=cl((e.x-tx)*.05,-.25,.25);e.g.userData.sir(Math.floor(t*(e.m===1&&e.tm<1?14:6))%2===0);}
let AC=null,MG=null,CP=null,RV=null,NB=null,EO,EB,ES,EF,EG,LO,TO,TG,WF,WG,RR,SK,SF,S1,S2,SB,SG2,SP,GR=-1,thP=false,IG,IF,PV=0,PT=0,DV=0,SH=0,RPM=900;
const mkPan=()=>AC.createStereoPanner?AC.createStereoPanner():AC.createGain();
function sirenInit(){try{AC=AC||new(window.AudioContext||window.webkitAudioContext)();
 if(!MG){CP=AC.createDynamicsCompressor();MG=AC.createGain();MG.gain.value=.9;MG.connect(CP);CP.connect(AC.destination);
  const L=AC.sampleRate*1.4|0,ir=AC.createBuffer(2,L,AC.sampleRate);for(let c=0;c<2;c++){const d=ir.getChannelData(c);for(let i=0;i<L;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/L,3);}
  RV=AC.createConvolver();RV.buffer=ir;const rg=AC.createGain();rg.gain.value=.7;RV.connect(rg);rg.connect(MG);
  NB=AC.createBuffer(1,AC.sampleRate*2,AC.sampleRate);{const d=NB.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
  const nl=()=>{const s=AC.createBufferSource();s.buffer=NB;s.loop=true;s.start();return s;},osc=(ty,c)=>{const o=AC.createOscillator();o.type=ty;o.start();return o;},gn=(v,to)=>{const g=AC.createGain();g.gain.value=v;g.connect(to||MG);return g;},bq=(ty,f,q,to)=>{const b=AC.createBiquadFilter();b.type=ty;b.frequency.value=f;b.Q.value=q;if(to)b.connect(to);return b;};
  /* двигатель: зацикленный буфер полного цикла 4-цилиндрового (4 вспышки), высота = обороты */
  const mkEng=bright=>{const sr=AC.sampleRate,N=Math.round(sr*.04),b=AC.createBuffer(1,N,sr),d=b.getChannelData(0),A=[1,.8,.95,.7],
    R=bright?[[210,1,520],[470,.8,640],[980,.7,800],[1900,.5,1100],[3300,.3,1500]]:[[150,1,380],[330,.7,480],[650,.35,600]];
   for(let c=0;c<4;c++){const t0=c*N/4;for(let i=0;i<N;i++){const dt=((i-t0+N)%N)/sr;let y=0;for(const[f,a,dc]of R)y+=a*Math.exp(-dc*dt)*Math.sin(6.2832*f*dt+c);
    y+=(bright?.5:.25)*Math.exp(-90*dt)*Math.sin(6.2832*62*dt);y+=(Math.random()*2-1)*Math.exp(-700*dt)*(bright?.9:.3);d[i]+=y*A[c]*(1-Math.exp(-dt*5000));}}
   let m=0;for(let i=0;i<N;i++)m=Math.max(m,Math.abs(d[i]));for(let i=0;i<N;i++)d[i]/=m;return b;},
   mkSrc=b=>{const q=AC.createBufferSource();q.buffer=b;q.loop=true;q.start();return q;};
  const ws=AC.createWaveShaper(),cv=new Float32Array(256);for(let i=0;i<256;i++)cv[i]=Math.tanh((i/128-1)*1.8);ws.curve=cv;
  EG=gn(0);EF=bq('lowpass',1500,.8,EG);ws.connect(EF);
  EO=mkSrc(mkEng(0));EB=mkSrc(mkEng(1));ES=gn(1,ws);LO=gn(0,ws);EO.connect(ES);EB.connect(LO);
  IF=bq('bandpass',1200,1.1);IG=gn(0);IF.connect(IG);nl().connect(IF);
  TO=osc('sine');TG=gn(0);TO.connect(TG);
  WF=bq('bandpass',500,.7);WG=gn(0);WF.connect(WG);nl().connect(WF);
  const rf=bq('lowpass',220,.7);RR=gn(0);rf.connect(RR);nl().connect(rf);
  SF=bq('bandpass',2400,9);SK=gn(0);SF.connect(SK);nl().connect(SF);
  /* сирена */
  S1=osc('sawtooth');S2=osc('square');SB=bq('bandpass',1500,.7);SG2=gn(0);SB.connect(SG2);S1.connect(SB);const s2g=gn(.5,SB);S2.connect(s2g);
  SP=mkPan();SG2.disconnect();SG2.connect(SP);SP.connect(MG);const sr=gn(.3,RV);SP.connect(sr);}
 AC.onstatechange=()=>{if(AC&&AC.state!=='running')audioWake();};
 audioWake();}catch(e){}}
/* Звук пропадал и возвращался сам: AudioContext уходит в suspended/interrupted (звонок, уведомление, сворачивание, чужой звук на телефоне), а resume() звали один раз при старте.
   sfx() при этом молча выходит, двигатель и сирена тоже молчат. Теперь будим контекст при смене состояния, при касании, при возврате на вкладку и раз в секунду в цикле. */
function audioWake(){if(!AC||AC.state==='running'||AC.state==='closed')return;try{const r=AC.resume();r&&r.catch&&r.catch(()=>{});}catch(e){}}
function engTick(on){if(!EG)return;const T=AC.currentTime,dt=cl(T-PT,.005,.05);PT=T;const thr=!!(keys.ArrowUp||keys.w)&&on,brk=!!(keys.ArrowDown||keys.s)&&on;
 if(!on){for(const g of[EG,WG,RR,SK,TG,IG])g.gain.setTargetAtTime(0,T,.08);thP=false;RPM=900;GR=-1;PV=v;DV=0;return;}
 const g=v<31?0:v<40?1:v<49?2:v<58?3:4;
 if(g!==GR){if(GR>=0){if(g>GR){SH=.14;sfx('pop');}else RPM+=1200;}GR=g;}
 SH=Math.max(0,SH-dt);DV+=((v-PV)/dt-DV)*Math.min(1,dt*6);PV=v;
 const lo=[12,31,40,49,58][g],hi=[31,40,49,58,76][g],fr=cl((v-lo)/(hi-lo),0,1),acc=thr||DV>2;
 const tg=2000+fr*4300+(thr?500:0)+cl(DV,0,14)*45-(SH>0?1400:0)-(!acc?300:0);
 RPM+=(tg-RPM)*Math.min(1,dt*(SH>0?9:acc?4:2.2));
 const ld=cl((thr?.7:.15)+cl(DV,0,12)/12*.7,0,1),rt=RPM/3000*(1+.004*Math.sin(T*37));
 EO.playbackRate.setTargetAtTime(rt,T,.03);EB.playbackRate.setTargetAtTime(rt,T,.03);
 LO.gain.setTargetAtTime(ld,T,.06);ES.gain.setTargetAtTime(1-ld*.7,T,.06);
 EF.frequency.setTargetAtTime(900+RPM*.35+ld*1500,T,.05);EG.gain.setTargetAtTime(SH>0?.04:.2+ld*.1,T,.04);
 IF.frequency.setTargetAtTime(700+RPM*.25,T,.08);IG.gain.setTargetAtTime(acc?.02+cl((RPM-2000)/4300,0,1)*.03:.004,T,.1);
 TO.frequency.setTargetAtTime(1200+fr*1400,T,.1);TG.gain.setTargetAtTime(thr?.003+fr*.003:0,T,.12);
 if(thP&&!thr&&RPM>4200){sfx('bov');for(let i=0;i<3;i++)setTimeout(()=>sfx('pop'),90+Math.random()*260);}thP=thr;
 WF.frequency.setTargetAtTime(250+v*20,T,.1);WG.gain.setTargetAtTime(cl(v/70,0,1)*.045+(P.y>0?.05:0),T,.1);
 RR.gain.setTargetAtTime(.03+v*.001,T,.1);
 SK.gain.setTargetAtTime(cl(Math.abs(P.vx)-7,0,7)/7*.05+(brk&&v>35?.02:0)+(st==='intro'?.045*cl(Math.abs(P.vx)/4,0,1):0),T,.04);SF.frequency.setTargetAtTime(2200+Math.abs(P.vx)*70,T,.05);}
function sirenTick(c){if(!S1)return;const T=AC.currentTime;if(!c){SG2.gain.setTargetAtTime(0,T,.1);return;}
 const d=Math.abs(c.z),a=Math.pow(cl(1-d/90,0,1),1.5),yelp=c.m===21||(c.m===1&&c.tm<1.6),per=yelp?.34:3.4,sw=.5-.5*Math.cos((t%per)/per*6.2832),dd=(v-c.s)*Math.sign(c.z||1),dop=cl(1-dd*.006,.88,1.12),f=(yelp?820+620*sw:650+800*sw)*dop;
 S1.frequency.setTargetAtTime(f,T,.03);S2.frequency.setTargetAtTime(f*.5,T,.03);SB.frequency.setTargetAtTime(1100+a*1200,T,.1);SG2.gain.setTargetAtTime(a*.07,T,.1);if(SP.pan)SP.pan.setTargetAtTime(cl((c.x-P.x)/8,-1,1),T,.05);}
function sfx(k,pan,vol){if(!AC||AC.state!=='running'||!MG)return;const T=AC.currentTime,V=vol||1,
 O=rv=>{const p=mkPan();if(p.pan)p.pan.value=pan||0;p.connect(MG);if(rv){const g=AC.createGain();g.gain.value=rv;p.connect(g);g.connect(RV);}return p;},
 tn=(f0,f1,d,ty,vl,dl,o)=>{dl=dl||0;const q=AC.createOscillator(),g=AC.createGain();q.type=ty;q.frequency.setValueAtTime(f0,T+dl);q.frequency.exponentialRampToValueAtTime(f1,T+dl+d);g.gain.setValueAtTime(vl*V,T+dl);g.gain.exponentialRampToValueAtTime(.0001,T+dl+d);q.connect(g);g.connect(o);q.start(T+dl);q.stop(T+dl+d+.05);},
 ns=(d,vl,f0,f1,o,dl,ty)=>{dl=dl||0;const b=AC.createBufferSource(),g=AC.createGain(),f=AC.createBiquadFilter();b.buffer=NB;f.type=ty||'lowpass';f.Q.value=ty==='bandpass'?1.5:.7;f.frequency.setValueAtTime(f0,T+dl);f.frequency.exponentialRampToValueAtTime(f1,T+dl+d);g.gain.setValueAtTime(vl*V,T+dl);g.gain.exponentialRampToValueAtTime(.0001,T+dl+d);b.connect(f);f.connect(g);g.connect(o);b.start(T+dl,Math.random());b.stop(T+dl+d);},
 bell=(f,vl,d,dl,o)=>{for(const[m,a,dd]of[[1,1,1],[2.76,.5,.5],[5.4,.25,.25]])tn(f*m,f*m*.998,d*dd,'sine',vl*a,dl,o);},
 clang=(f,vl,d,dl,o)=>{dl=dl||0;const c=AC.createOscillator(),m=AC.createOscillator(),mg=AC.createGain(),g=AC.createGain();c.frequency.value=f;m.frequency.value=f*1.47;mg.gain.setValueAtTime(f*2.5,T+dl);mg.gain.exponentialRampToValueAtTime(1,T+dl+d);g.gain.setValueAtTime(vl*V,T+dl);g.gain.exponentialRampToValueAtTime(.0001,T+dl+d);m.connect(mg);mg.connect(c.frequency);c.connect(g);g.connect(o);c.start(T+dl);m.start(T+dl);c.stop(T+dl+d+.05);m.stop(T+dl+d+.05);},
 o=O(k==='crash'||k==='land'||k==='over'||k==='radio'||k==='horn'?.5:.12);
 if(k==='coin'){bell(1318,.07,.4,0,o);bell(1760,.07,.55,.07,o);ns(.15,.03,9000,9000,o,.05,'highpass');}
 else if(k==='cone'){ns(.1,.3,2500,300,o);tn(240+Math.random()*40,90,.14,'triangle',.18,0,o);for(const d of[.06,.11,.17])ns(.03,.12,4000,2000,o,d);}
 else if(k==='crash'){ns(.9,.8,3500,80,o);tn(95,28,.6,'sine',.5,0,o);tn(140,45,.35,'sawtooth',.2,0,o);clang(310,.1,.9,0,o);clang(520,.07,.7,.03,o);clang(790,.05,.6,.06,o);ns(.5,.1,6000,9000,o,.02,'highpass');for(const d of[.15,.26,.4])ns(.04,.12,3000,1500,o,d);}
 else if(k==='ramp'){tn(120,420,.5,'sawtooth',.06,0,o);ns(.6,.15,800,7000,o);tn(180,90,.2,'triangle',.12,0,o);}
 else if(k==='land'){ns(.35,.5,1500,90,o);tn(80,35,.3,'sine',.5,0,o);clang(180,.06,.5,0,o);tn(900,600,.08,'square',.02,.02,o);}
 else if(k==='whoosh'){ns(.45,.14,2500,400,o,0,'bandpass');}
 else if(k==='pop'){ns(.05,.12,2200,600,o);tn(140,70,.06,'square',.03,0,o);}
 else if(k==='bov'){ns(.35,.1,4500,1500,o,0,'bandpass');}
 else if(k==='warn'){tn(1000,1000,.1,'square',.05,0,o);tn(1000,1000,.1,'square',.05,.14,o);}
 else if(k==='horn'){tn(440,440,.5,'sawtooth',.05,0,o);tn(554,554,.5,'sawtooth',.05,0,o);}
 else if(k==='radio'){ns(.18,.12,3500,3500,o,0,'bandpass');tn(1400,1400,.07,'square',.05,.2,o);tn(1900,1900,.09,'square',.05,.3,o);ns(.12,.1,3500,3500,o,.45,'bandpass');}
 else if(k==='start'){tn(55,160,.7,'sawtooth',.08,.1,o);ns(.5,.06,400,200,o);}
 else if(k==='over'){tn(180,35,1.3,'sawtooth',.15,0,o);ns(1,.2,1000,60,o);tn(392,392,.25,'triangle',.08,.5,o);tn(330,330,.25,'triangle',.08,.75,o);tn(262,262,.5,'triangle',.08,1,o);}}
function whEnd(){if(P.wd>1){const b=Math.round(P.wd*P.wd*30);bonus+=b;say('ДЫБЫ '+P.wd.toFixed(1)+'с! +'+b,'#ffd54a');sfx('coin');if(P.wd>2.2)rad('wend',1);}P.wh=0;P.wd=0;P.wk=1;P.wc=2.5;if(st==='play')box0.classList.remove('nitro');}
function reset(){drag0=null;tx=null;for(const e of E)kill(e);for(const s of SC)scene.remove(s.g);E=[];SC=[];t=0;v=26;dist=0;bonus=0;ST={cd:0,clean:0,near:0,ramps:0,pk:0};lastStars=0;for(const k in FX)FX[k]=0;PKT=[];hStar.textContent='';for(const m of TRS)m.visible=false;if(FG){scene.remove(FG);FG=null;}FC=null;for(const m of ext)scene.remove(m);ext=[];box0.classList.remove('intro','cops','nitro');lives=3;HB.x=0;HB.j=0;copWarn=0;inv=0;shake=0;rowT=70;rampCD=50;zCD=14;onT=0;onCD=40;copCD=CHASE?8:28;gT=300;sT=160;P.x=0;P.vx=0;P.y=0;P.vy=0;P.jr=0;P.pt=0;P.ptV=0;P.rl=0;P.rlV=0;P.yaw=0;P.yawV=0;P.pv=null;P.ice=0;P.slip=0;P.wh=0;P.wd=0;P.wk=1;P.sk=0;rdClr();P.hu=0;P.hn=0;P.wc=0;heartCD=20;shT=0;shCD=60;LS=[0,1,2,3].map(()=>rnd(10,18));buildPlayer();hearts();}
function over(){drag0=null;tx=null;st='over';endT=0;sfx('over');const s=score();if(s>best){best=s;try{localStorage.setItem('rw_best',String(best))}catch(e){}}
 showMenu('over');opts.onGameOver&&opts.onGameOver({score:s,distance:Math.round(dist),best,plate:P.plate,stats:runStats(),mode:CHASE?'chase':'road'});}
const es=k=>k*k*(3-2*k),TT=8.2;
function introCam(sx,sy){const T=ci;let px,py,pz,lx,ly,lz,rz=0;fx=0;
 if(T<3.6){const k=es(T/3.6),th=2.9-1.6*k,r=4.6+2.4*k;px=P.x+Math.sin(th)*r;py=.55+1.05*k;pz=Math.cos(th)*r;lx=P.x;ly=.65+.2*k;lz=0;}
 else if(T<5.8){const a=(T-3.6)/2.2,cz=IC?IC.z:20,cx=IC?IC.x:-2.6;px=cx*.6+Math.sin(T*1.1)*.25;py=2+.25*Math.sin(T*.9);pz=cz+7.5;lx=P.x*.7;ly=1;lz=-12;fx=12*a;rz=Math.sin(T*1.3)*.035;}
 else if(T<6.7){const k=(T-5.8)/.9;px=P.x+6.4-1.4*k;py=.75;pz=2.2;lx=P.x-1.3;ly=.9;lz=1.2-.4*k;}
 else{const b=es(cl((T-6.7)/1.5,0,1)),Ax=P.x+5,Ay=.75,Az=2,Bx=P.x*.7,By=4.1,Bz=9.2;
  px=Ax+(Bx-Ax)*b;py=Ay+(By-Ay)*b;pz=Az+(Bz-Az)*b;lx=(P.x-1.3)+(P.x*.4-(P.x-1.3))*b;ly=.9+.4*b;lz=.8+(-20-.8)*b;fx=10*Math.sin(b*Math.PI);}
 cam.position.set(px+sx,py+sy,pz);cam.lookAt(lx,ly,lz);if(rz)cam.rotateZ(rz);}
function beginIntro(){st='intro';ci=0;IS=0;DY=0;DZ=0;DX=0;fx=0;menu.style.display='none';hud.style.opacity=0;box0.classList.add('intro');
 add('cop',-2.6,70,{l:0,hw:1,hd:2.16,s:v+16,m:0,n:0,tm:0,sd:1,g:mkCop()});IC=E[E.length-1];copCD=60;
 for(const m of ext)scene.remove(m);ext=[];
 {const g0=barr[0].geometry,zb=20+(((barr[0].position.z-20)%4)+4)%4;for(let i=0;i<25;i++){const m=new THREE.Mesh(g0,barr[i%2].material);m.position.set(8.9,0,zb+4*i);scene.add(m);ext.push(m);}
  const c0=cones[0],zc=20+(((c0.position.z-20)%10)+10)%10;for(let i=0;i<10;i++){const c=c0.clone();c.position.set(-8.7,0,zc+10*i);scene.add(c);ext.push(c);}}
 if(!MOBILE){cpl=new THREE.PointLight(0xff2020,0,38);scene.add(cpl);}}
function introUpdate(dt){ci+=dt;const T=ci,d=cl(1-(T-2.9)/1,0,1),ph=T*1.7,nb=T>=6.7?es(cl((T-6.7)/1.5,0,1)):0;shake=Math.max(0,shake-dt);
 P.x=3.4*Math.sin(ph)*d;P.vx=3.4*1.7*Math.cos(ph)*d;DY=Math.cos(ph)*.95*d;DZ=Math.sin(ph)*.09*d;
 DX=T>=6.7?.09*Math.sin(Math.PI*cl((T-6.7)/1,0,1)):0;
 v=T<6.7?20+10*es(cl(T/5,0,1)):30+28*nb;
 if(d>.25){burst(P.x-.8,.25,1.6,2,3.5);burst(P.x+.8,.25,1.6,2,3.5);}
 if(T>=6.7){burst(P.x-.4,.5,2.3,3,4);burst(P.x+.4,.5,2.3,3,4);}
 for(const m of ext){m.position.z+=v*dt;if(m.position.z>=120)m.position.z-=100;}
 if(IC){let z,x=-2.6;
  if(T<3)z=70;else if(T<5.8)z=70-62*es(cl((T-3)/2.8,0,1));
  else if(T<6.7){const k=es(cl((T-5.8)/.9,0,1));z=8-6.5*k;x=-2.6+.25*Math.sin(k*Math.PI);}
  else z=1.5+40*nb;
  IC.x=x;IC.z=z;IC.s=v+16;IC.m=0;IC.tm=0;IC.g.position.set(x,0,z);IC.g.rotation.y=0;IC.g.userData.sir(Math.floor(T*6)%2===0);IC.g.userData.spin&&IC.g.userData.spin(dt,IC.s);sirenTick(T>2.6?IC:null);
  if(cpl){cpl.color.setHex(Math.floor(T*8)%2===0?0xff2020:0x2a5cff);cpl.intensity=cl((T-2.8)/.8,0,1)*(T<6.7?9:5);cpl.position.set(x,2.6,z+1);}}
 engTick(1);
 if(T>=.3&&IS<1){IS=1;ovT.innerHTML='<b>ДОРОЖНЫЕ РАБОТЫ</b><i>ПОГОНЯ</i>';ovT.classList.remove('on');void ovT.offsetWidth;ovT.classList.add('on');}
 if(T>=2&&IS<2){IS=2;say('ДРИФТ! 😎','#ffd54a');}
 if(T>=3&&IS<3){IS=3;box0.classList.add('cops');say('...сзади сирена','#7fb2ff');sfx('radio');shake=.2;}
 if(T>=4.4&&IS<4){IS=4;say('🚨 ДПС ЗА СПИНОЙ!','#ff6b4a');sfx('warn');shake=.3;}
 if(T>=5.8&&IS<5){IS=5;say('«Водитель, прижмитесь к обочине!»','#7fb2ff');sfx('horn');shake=.35;}
 if(T>=6.7&&IS<6){IS=6;box0.classList.add('nitro');say('🔥 НИТРО! УХОДИМ!','#ffd54a');shake=.6;sfx('bov');sfx('whoosh');for(const q of[80,220,400])setTimeout(()=>sfx('pop'),q);}
 if(T>=TT)endIntro();}
function endIntro(){if(st==='finish'){winEnd();return;}if(st!=='intro')return;st='play';t=0;P.x=0;P.vx=0;DY=0;DZ=0;DX=0;fx=0;hud.style.opacity=1;box0.classList.remove('intro','cops','nitro');ovT.classList.remove('on');
 for(const m of ext)scene.remove(m);ext=[];if(cpl){scene.remove(cpl);cpl=null;}
 if(IC){IC.z=cl(IC.z,40,60);IC.x=-2.6;IC.m=0;IC.tm=0;IC.hit=0;IC.s=v+8;IC.g.position.set(IC.x,0,IC.z);IC=null;}inv=2.5;
 say('🚨 ДПС! Уходим!','#ff6b4a');opts.onStart&&opts.onStart();}
function mkFinish(){const g=new THREE.Group();
 const bt0=cvs(1024,256,(c,w,h)=>{c.fillStyle='#17110e';c.fillRect(0,0,w,h);for(let i=0;i<32;i++)for(let j=0;j<2;j++){c.fillStyle=(i+j)%2?'#fff':'#111';c.fillRect(i*32,j*32,32,32);c.fillRect(i*32,h-64+j*32,32,32);}c.fillStyle='#ffd54a';c.font='900 110px system-ui,Arial,sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('ФИНИШ',w/2,h/2+4);});
 const ck=cvs(256,64,(c,w,h)=>{for(let i=0;i<16;i++)for(let j=0;j<4;j++){c.fillStyle=(i+j)%2?'#f4f4ee':'#15151a';c.fillRect(i*16,j*16,16,16);}});
 const bn=new THREE.Mesh(new THREE.PlaneGeometry(19,4.75),new THREE.MeshBasicMaterial({map:bt0,toneMapped:false,side:THREE.DoubleSide}));bn.position.y=7.4;g.add(bn);
 const pm=new THREE.MeshStandardMaterial({color:0xe8e2d6,roughness:.6,metalness:.2});
 for(const q of[-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(.6,9.6,.6),pm);p.position.set(q*9.6,4.8,0);g.add(p);}
 const st0=new THREE.Mesh(new THREE.PlaneGeometry(16,4),new THREE.MeshBasicMaterial({map:ck,toneMapped:false}));st0.rotation.x=-Math.PI/2;st0.position.set(0,.04,0);g.add(st0);
 return g;}
function mkExt(){for(const m of ext)scene.remove(m);ext=[];
 const g0=barr[0].geometry,zb=20+(((barr[0].position.z-20)%4)+4)%4;for(let i=0;i<25;i++){const m=new THREE.Mesh(g0,barr[i%2].material);m.position.set(8.9,0,zb+4*i);scene.add(m);ext.push(m);}
 const c0=cones[0],zc=20+(((c0.position.z-20)%10)+10)%10;for(let i=0;i<10;i++){const c=c0.clone();c.position.set(-8.7,0,zc+10*i);scene.add(c);ext.push(c);}}
function beginFinish(){st='finish';FT=0;FS=0;inv=0;tx=null;drag0=null;box0.classList.add('intro','cops');
 FC=null;const keep=[];for(const e of E){if(e.k==='cop'&&!e.dead&&!FC){FC=e;keep.push(e);}else kill(e);}E=keep;
 if(!FC){add('cop',LX[1],36,{l:1,hw:1,hd:2.16,s:v+4,m:0,n:0,tm:0,sd:1,g:mkCop()});FC=E[E.length-1];}
 FC.m=0;FC.tm=0;FC.hit=0;FC.z=cl(FC.z,20,46);FC.s=v+4;
 mkExt();FG=mkFinish();FG.position.z=-230;scene.add(FG);copCD=9999;
 sfx('warn');say('🏁 5000 ОЧКОВ! ФИНИШ БЛИЗКО!','#ffd54a');shake=.3;}
function finishUpdate(dt){FT+=dt;const T=FT;shake=Math.max(0,shake-dt);
 v+=(62-v)*Math.min(1,dt*1.1);dist+=v*dt;
 if(P.y>0||P.vy>0){P.y+=P.vy*dt;P.vy-=26*dt;if(P.y<=0){P.y=0;P.vy=0;}}
 if(T<3.6){let ax=0;if(keys.ArrowLeft||keys.a)ax--;if(keys.ArrowRight||keys.d)ax++;P.vx+=(ax*11-P.vx)*Math.min(1,dt*9);}
 else P.vx+=(cl(-P.x*2.5,-8,8)-P.vx)*Math.min(1,dt*4);
 P.x=cl(P.x+P.vx*dt,-7,7);
 for(const m of ext){m.position.z+=v*dt;if(m.position.z>=120)m.position.z-=100;}
 if(FG){FG.position.z+=v*dt;if(FS<2&&FG.position.z>-1){FS=2;sfx('coin');say('🏁 ФИНИШ!','#ffd54a');shake=.45;for(let i=0;i<7;i++)burst(rnd(-7,7),rnd(1.5,6),-3,12,9);}
  if(FG.position.z>45){scene.remove(FG);FG=null;}}
 if(FC){FC.s+=((T<1.6?v+4:v-14)-FC.s)*Math.min(1,dt*(T<1.6?2:1.5));FC.z+=(v-FC.s)*dt;FC.x+=(cl(P.x-2.6,-6.5,6.5)-FC.x)*Math.min(1,dt*2.5);FC.br=T>1.6;
  FC.g.position.set(FC.x,0,FC.z);FC.g.rotation.y=0;FC.g.userData.sir(Math.floor(T*6)%2===0);FC.g.userData.spin&&FC.g.userData.spin(dt,FC.s);FC.g.userData.brk&&FC.g.userData.brk(!!FC.br);sirenTick(FC);}
 engTick(1);hS.textContent=score();
 if(T>=.4&&FS<1){FS=1;box0.classList.add('nitro');}
 if(T>=1.6&&!FC.said){FC.said=1;say('Отрываемся от ДПС!','#7fb2ff');}
 if(T>=3.8&&box0.classList.contains('nitro'))box0.classList.remove('nitro');
 if(T>=5.4&&box0.classList.contains('cops'))box0.classList.remove('cops');
 if(T>=6.4&&FS<3){FS=3;say('ДПС остался позади...','#7fb2ff');}
 if(T>=8&&FS<4){FS=4;say('🏁 ВЫ СВОБОДНЫ!','#ffd54a');}
 if(T>=9.4)winEnd();}
function finishCam(sx,sy){const T=FT;let px,py,pz,lx,ly,lz;fx=0;
 if(T<3.8){px=P.x*.7;py=4.1;pz=9.2;lx=P.x*.4;ly=1.3;lz=-20;fx=6*cl(T/1.5,0,1);}
 else if(T<5.6){const k=(T-3.8)/1.8;px=P.x*.7;py=1+.8*k;pz=6+1.5*k;lx=P.x*.4;ly=1+.5*k;lz=-35;fx=8;}
 else if(T<7.6){const k=(T-5.6)/2;px=P.x*.5+Math.sin(k*1.5)*1.2;py=1.1+.5*k;pz=-8-2*k;lx=P.x;ly=1+.4*k;lz=25;}
 else{const k=es(cl((T-7.6)/1.8,0,1));px=P.x*.5+Math.sin(1.5)*1.2*(1-k)+7*k;py=1.6+2.6*k;pz=-10+4*k;lx=P.x;ly=1;lz=-2*k;}
 cam.position.set(px+sx,py+sy,pz);cam.lookAt(lx,ly,lz);}
function winEnd(){if(st!=='finish')return;st='over';endT=0;box0.classList.remove('intro','cops','nitro');ovT.classList.remove('on');
 for(const m of ext)scene.remove(m);ext=[];if(FG){scene.remove(FG);FG=null;}
 const s=score();if(s>best){best=s;try{localStorage.setItem('rw_best',String(best))}catch(e){}}
 sfx('start');showMenu('win');opts.onGameOver&&opts.onGameOver({score:s,distance:Math.round(dist),best,plate:P.plate,win:true,stats:runStats(),mode:'road'});}
function start(){sirenInit();setTimeout(()=>sfx('start'),150);reset();if(!opts.noIntro){beginIntro();return;}st='play';menu.style.display='none';opts.onStart&&opts.onStart();}
function showMenu(k){sirenTick(null);engTick(0);menu.style.display='flex';const[m,r]=P.plate.split(' ');const pl=`<div class=rw-plate${FRAME_C?` style="border-color:${FRAME_C}"`:''}>${m}<i>${r}</i></div>`;
 menu.innerHTML=k==='menu'?`<h1>${CHASE?'УЙТИ ОТ ПОЛИЦИИ':'ДОРОЖНЫЕ РАБОТЫ'}</h1>${pl}<p>${CHASE?'Погоня без финиша: чем дольше едете, тем больше звёзд розыска и жетонов за дистанцию. ':''}Асфальт свежий, разметка ещё сохнет.<br>Объезжайте технику, не сбивайте ограждения и ловите номера «777». А грузовик-трамплин — шанс взлететь над пробкой! Берегитесь ДПС: догонит, прижмёт и подрежет.</p><p style="opacity:.55">← → руль · ↑ ↓ газ/тормоз · P пауза · M звук<br>на телефоне: ведите пальцем по экрану</p><div class=rw-stat><span>РЕКОРД</span>${best}</div><button class=rw-btn>ПОЕХАЛИ</button>`
 :k==='pause'?`<h1>ПАУЗА</h1><p>Дорога подождёт</p><button class=rw-btn>ДАЛЬШЕ</button>`
 :k==='win'?`<h1>🏁 ФИНИШ!</h1>${pl}<p>5000 очков — вы оторвались от ДПС!<br>Трасса закончилась, впереди только свобода.</p><div class=rw-row><div class=rw-stat><span>ОЧКИ</span>${score()}</div><div class=rw-stat><span>РЕКОРД</span>${best}</div></div><button class=rw-btn>ЕЩЁ РАЗ</button>`
 :`<h1>ЗАЕЗД ОКОНЧЕН</h1>${pl}<div class=rw-row><div class=rw-stat><span>ОЧКИ</span>${score()}</div><div class=rw-stat><span>РЕКОРД</span>${best}</div></div><button class=rw-btn>ЕЩЁ РАЗ</button>`;
 menu.querySelector('button').onclick=()=>{if(st==='pause'){st='play';menu.style.display='none';}else if(st!=='over'||endT>.5)start();};}

function update(dt){
 t+=dt;rampCD-=dt;zCD-=dt;onT-=dt;onCD-=dt;copCD-=dt;heartCD-=dt;shCD-=dt;const base=Math.min(26+t*.35,62);let m=1;if(keys.ArrowUp||keys.w)m=1.2;if(keys.ArrowDown||keys.s)m=.75;if(P.wh>0)m*=1.06;
 v+=(base*m-v)*Math.min(1,dt*2.2*(base*m<v?1+fxv('brk')*2:1+fxv('acc')*2.5));
 let ax=0;if(keys.ArrowLeft||keys.a)ax--;if(keys.ArrowRight||keys.d)ax++;
 const gk=1+fxv('grip')*2.5,hk=1+fxv('hand')*2,ctl=(P.ice>0?.1*gk:P.slip>0?.35*gk:1)*(P.wh>0||P.sk>0?.6:1);P.ice=Math.max(0,(P.ice||0)-dt*gk);P.slip=Math.max(0,(P.slip||0)-dt*gk);
 if(tx!=null)P.vx+=(cl((tx-P.x)*9,-18,18)-P.vx)*Math.min(1,dt*16*ctl*hk);else P.vx+=(ax*11-P.vx)*Math.min(1,dt*9*ctl*hk);
 P.x=cl(P.x+P.vx*dt,-7,7);dist+=v*dt;if(st==='play'){ST.cd+=v*dt;if(ST.cd>ST.clean)ST.clean=ST.cd;}if(CHASE){const n=stars();if(n!==lastStars){lastStars=n;hStar.textContent='★'.repeat(n)+'☆'.repeat(5-n)+' РОЗЫСК';if(n>1)say('★ Розыск: '+n,'#ffd54a');}}
 if(st==='play'){const up=!!(keys.ArrowUp||keys.w),dn=!!(keys.ArrowDown||keys.s),can=false;P.wc=Math.max(0,(P.wc||0)-dt);
  if(!(P.wh>0)&&!(P.sk>0)){P.hu=up&&!dn&&can&&P.wc<=0?(P.hu||0)+dt:0;P.hn=dn&&!up&&can&&P.wc<=0?(P.hn||0)+dt:0;
   if(P.hu>.5){P.wh=4.5;P.wd=0;P.wk=1;P.hu=0;shake=Math.max(shake,.4);burst(P.x,.2,PHD,28,8);sfx('bov');sfx('ramp');say('НА ЗАДНИЕ! 🤘','#ffd54a');}
   if(P.hn>.5){P.sk=3;P.hn=0;sfx('whoosh');say('СТОППИ! 😎','#8fe3ff');}}
  if(P.wh>0){P.wh-=dt;P.wd+=dt;const wk=Math.min(6,1+Math.floor(P.wd/1.1));shake=Math.max(shake,.05+.02*wk);if(wk>P.wk){P.wk=wk;shake=Math.max(shake,.3);sfx('coin');say('ДЫБЫ x'+wk+' 🔥','#ffd54a');if(wk===3||wk===5)rad('wc',1);if(wk>=3)box0.classList.add('nitro');}bonus+=40*wk*dt;if(Math.random()<.8)burst(P.x,.1,PHD,1+wk,3+wk);if(!up||P.y>.1||P.wh<=0)whEnd();}
  if(P.sk>0){P.sk-=dt;bonus+=30*dt;if(Math.random()<.6)burst(P.x,.1,-PHD,2,3);if(!dn||P.y>.1||P.sk<=0){P.sk=0;P.wc=3;}}}
 HB.x+=(P.x-HB.x)*Math.min(1,dt*.4);HB.j+=(Math.abs(P.vx)-HB.j)*Math.min(1,dt*.8);
 if(P.y>0||P.vy>0){P.y+=P.vy*dt;P.vy-=26*dt;if(P.y<=0){P.y=0;if(P.vy<-6){shake=Math.max(shake,.3);burst(P.x,.2,0,22,7);P.ptV=(P.ptV||0)-Math.min(4,-P.vy*.22);P.rlV=(P.rlV||0)+rnd(-1.2,1.2);sfx('land');say('Приземлился!','#8fe3ff');}P.vy=0;if(P.jr){P.jr=0;inv=2.5;say('Приземлился! 🛡 неуязвимость 2.5с','#8fe3ff');}}}inv=Math.max(0,inv-dt);shT=Math.max(0,shT-dt);shake=Math.max(0,shake-dt);
 rowT-=v*dt;if(rowT<=0)row();
 const snapZ=o=>{const ph=((lamps[0].position.z%30)+30)%30;return ph+o+30*Math.round((-175-ph-o)/30);},scFree=(z,d)=>SC.every(q=>Math.abs(q.g.position.z-z)>d);
 gT-=v*dt;if(gT<=0){const z=snapZ(15);if(scFree(z,12)){const g=mkGantry();if(MOBILE)mergeStatic(g);g.position.z=z;scene.add(g);SC.push({g});gT=rnd(380,600);}else gT=20;}
 sT-=v*dt;if(sT<=0){const z=snapZ(pick([7.5,22.5]));if(scFree(z,10)){const g=mkSign(ri(2)?1:-1);if(MOBILE)mergeStatic(g);g.position.z=z;scene.add(g);SC.push({g});sT=rnd(220,340);}else sT=15;}
 for(const s of SC){s.g.position.z+=v*dt;if(s.g.userData.lamp)s.g.userData.lamp.visible=Math.floor(t*2.5)%2===0;}
 SC=SC.filter(s=>s.g.position.z<30||(scene.remove(s.g),s.g.traverse(o=>{o.geometry&&o.geometry.userData.mg&&o.geometry.dispose();}),false));
 for(const e of E){if(e.fly){e.x+=e.vx*dt;e.z+=v*.7*dt;e.g.rotation.z+=dt*9;e.g.position.y+=e.vy*dt;e.vy-=18*dt;}else e.z+=(v-e.s)*dt;}
 follow(dt);for(const e of E)if(e.g.userData.spin)e.g.userData.spin(dt,e.fly?0:e.s);for(const e of E)if(e.g.userData.brk)e.g.userData.brk(!!e.br);
 for(const e of E){
  if(e.k==='cop'&&!e.dead)copAI(e,dt);
  if(MASS[e.k]&&!e.on&&!e.dead&&!e.fly)dynStep(e,dt);
  if(e.k==='worker'&&!e.fly){const u=e.g.userData,d=e.tx-e.x;if(e.ph===0&&e.z>-v*1.9){e.ph=1;e.wt=1.1;sfx('horn');say('⚠️ РАБОЧИЕ НА ДОРОГЕ!','#ffb02e');}else if(e.ph===1){e.wt-=dt;if(e.wt<=0)e.ph=2;}else if(e.ph===2)e.x+=Math.sign(d)*Math.min(Math.abs(d),4*dt);u.sign.visible=e.ph===1?Math.floor(t*8)%2===0:true;u.fig.position.y=e.ph===2&&Math.abs(d)>.01?Math.abs(Math.sin(t*12))*.08:0;u.fig.rotation.y=e.ph===2&&Math.abs(d)>.01?(d>0?1.57:-1.57):0;}
  e.g.position.x=e.x;e.g.position.z=e.z;
  if(e.k==='token'){e.g.userData.p.rotation.y=t*3;e.g.userData.p.position.y=1.2+Math.sin(t*4)*.15;}
  if(e.k==='block'||e.k==='ramp'){const on=Math.floor(t*3)%2===0;e.g.userData.lamp.visible=on;if(e.g.userData.lamp2)e.g.userData.lamp2.visible=!on;}
  if(e.k==='truck'&&e.g.userData.arrow){const ar=e.g.userData.arrow;ar.visible=Math.floor(t*2.5)%2===0;e.at=(e.at||0)-dt;if(e.at<=0){e.at=.25;const cur=e.ad;e.ad=cur&&laneClear(e,e.l+cur)>0?cur:arrowDir(e);ar.material=e.ad<0?arrowM:e.ad>0?arrowMR:arrowMX;}}
  if(e.fly&&e.g.position.y<0){e.g.position.y=0;e.vy=0;}
  if(e.dead||e.fly||st!=='play')continue;
  if(e.on&&!e.hit&&P.y<=.4&&Math.abs(P.x-e.x)<e.hw+PHW&&Math.abs(e.z)<e.hd+PHD){e.hit=1;e.fly=1;e.vx=rnd(-9,9);e.vy=rnd(6,10);sfx('crash',0);burst(e.x,.8,e.z,26,8);shake=Math.max(shake,.5);if(shT>0)say('Щит! Лобовое отбито','#4aa8ff');else if(inv<=0){if(!soak())lives--;inv=invT();hearts();say('Лобовое! 💥','#ff6b4a');if(lives<=0){over();break;}}continue;}
  if(e.k==='worker'){if(P.y>.4)continue;if(!e.hit&&Math.abs(P.x-e.x)<e.hw+PHW&&Math.abs(e.z)<e.hd+PHD){e.hit=1;e.fly=1;e.vx=(e.x<P.x?-1:1)*rnd(5,9);e.vy=rnd(7,11);sfx('crash',0);burst(e.x,.8,e.z,20,7);shake=Math.max(shake,.4);if(shT>0)say('Щит! Рабочий цел','#4aa8ff');else if(inv<=0){if(!soak())lives--;inv=invT();hearts();if(!E.some(q=>q.k==='cop')){const cl2=ri(4);add('cop',LX[cl2],48,{l:cl2,hw:1,hd:2.16,s:v+16,m:0,n:0,tm:0,sd:1,g:mkCop()});copCD=rnd(30,45);sfx('radio');}say('Сбил рабочего! 🚨','#ff6b4a');if(lives<=0){over();break;}}}continue;}
  if(e.k==='puddle'||e.k==='pit'||e.k==='ice'){if(P.y>.3)continue;if(Math.abs(P.x-e.x)<e.hw+.5&&Math.abs(e.z)<e.hd+1){
   if(e.k==='ice'){P.ice=.35;if(!e.nm){e.nm=1;say('ГОЛОЛЁД! ❄️','#9fe3ff');}}
   else if(!e.hit){e.hit=1;
    if(e.k==='puddle'){const sg=P.x<e.x-.2?-1:P.x>e.x+.2?1:(Math.random()<.5?-1:1),f=cl(v/40,.6,1.6);P.vx+=sg*rnd(5,8)*f;P.yawV=(P.yawV||0)+sg*rnd(6,10)*f;P.rlV=(P.rlV||0)+sg*rnd(1,2);P.slip=1.6;v*=.97;burst(P.x,.3,0,16,6);sfx('whoosh');say('ЛУЖА! 💦','#8fe3ff');}
    else{P.y=.02;P.vy=cl(6+v*.12,8,13);P.ptV=(P.ptV||0)+2.5;shake=Math.max(shake,.2);burst(P.x,.2,0,14,6);sfx('land');say('ЯМА! 🕳','#c9a46a');}}}
   continue;}
  if((P.y>.4||(e.k==='ramp'&&e.used))&&e.k!=='token')continue;
  const ez=e.z+(e.oz||0),ddx=P.x-e.x,ox=e.hw+PHW-Math.abs(ddx),oz=e.hd+PHD-Math.abs(ez);
  if(ox>0&&oz>0){
   if(e.k==='token'){e.dead=1;if(e.heart){if(lives<3){lives++;hearts();say('❤️ +1 жизнь!','#ff5a7a');}else{bonus+=150;say('❤️ +150','#ff5a7a');}sfx('coin');burst(e.x,1.2,e.z,30,7);}else if(e.part){ST.pk++;sfx('coin');burst(e.x,1.2,e.z,26,7);say('🔧 Ящик с деталью!','#ffb02e');}else if(e.shield){shT=4;sfx('ramp');burst(e.x,1.2,e.z,30,7);say('🛡 ЩИТ 4с!','#4aa8ff');}else{bonus+=100;sfx('coin');burst(e.x,1.2,e.z,18,6);say('+100');}}
   else if(e.k==='cone'){sfx('cone');rad('cone');e.fly=1;e.vx=(e.x<P.x?-1:1)*rnd(4,9);e.vy=rnd(5,9);v*=.93;burst(e.x,.4,e.z,8,5);}
   else if(e.k==='ramp'&&!e.used&&ez<2&&Math.abs(ddx)<e.hw+PHW-.15&&P.y<.45){e.used=1;e.nm=1;P.y=.02;P.vy=15;P.jr=1;P.ptV=(P.ptV||0)+3;v=Math.min(v+10*(1+fxv('tb')*4),75);bonus+=150;ST.ramps++;shake=Math.max(shake,.25);burst(P.x,.3,-PHD,24,8);sfx('ramp');say('ТРАМПЛИН! +150','#ffd54a');}
   else{
    if(!e.hit){e.hit=1;if(shT>0){sfx('cone');shake=Math.max(shake,.2);burst((P.x+e.x)/2,.9,0,14,6);}else if(inv<=0){sfx('crash',cl((e.x-P.x)/3,-1,1));if(e.k==='cop'&&ez>0&&ox>=oz){inv=.8;shake=.25;burst(P.x,.6,PHD,12,6);say('ДПС въехал в зад — без урона','#7fb2ff');}else if(e.k==='cop'&&!copWarn&&t<75){copWarn=1;ST.cd=0;inv=1.2;shake=.3;burst((P.x+e.x)/2,.9,0,16,7);say('ДПС задел — это предупреждение!','#7fb2ff');}else{if(!soak())lives--;ST.cd=0;inv=invT();shake=.45;burst((P.x+e.x)/2,.9,ez<0?-PHD:0,30,9);hearts();say(lives>0?(e.k==='cop'?'ДПС вас задел!':'Удар!'):'Авария!','#ff6b4a');if(lives<=0){over();break;}}}}
    if(ox<oz){const sg=ddx<0?-1:1;P.x+=sg*ox;const JJ=cl(6+Math.abs(v-e.s)*.15,6,13);P.vx=sg*(MASS[e.k]?JJ*(MASS[e.k]/(1+MASS[e.k]))*(e.k==='cop'?.7+.3*cl((t-20)/70,0,1):1):Math.abs(P.vx)*.4+1.5);if(MASS[e.k])crashSide(e,sg,ez,JJ);shake=Math.max(shake,.15);if(e.k==='cop'&&(e.m===1||e.m===2||e.m===21)&&Math.random()<.2+.2*cl((t-20)/70,0,1))copSpin(e,-sg,'ДПС закрутило от удара! +120');}
    else if(ez<0){e.z=-(e.hd+PHD)-(e.oz||0);if(MASS[e.k])crashRear(e,ddx);else v=Math.min(v,e.s);}
    else{e.z=(e.hd+PHD)-(e.oz||0);if(MASS[e.k])crashBump(e);}
    e.g.position.z=e.z;
   }
  }else if(!e.nm&&!e.hit&&e.z>1.5&&e.k!=='token'&&e.k!=='cone'&&Math.abs(ddx)<e.hw+PHW+1.1&&Math.abs(ddx)>e.hw+PHW+.1){e.nm=1;sfx('whoosh',cl((e.x-P.x)/5,-1,1));if(e.k==='cop'){bonus+=40;ST.near++;say('ушёл от ДПС +40','#7fb2ff');}else{bonus+=15;ST.near++;say('впритирку +15','#8fe3ff');}}
 }
 {const V2=E.filter(q=>MASS[q.k]&&!q.dead&&!q.fly);for(let i=0;i<V2.length;i++)for(let j=i+1;j<V2.length;j++){const a=V2[i],c=V2[j];if(a.dyn>0||c.dyn>0||a.k==='cop'||c.k==='cop')vvCollide(a,c);}}
 engTick(1);sirenTick(E.find(e=>e.k==='cop'));
 E=E.filter(e=>{if(e.dead||e.z>(e.k==='cop'?70:25)||e.z<-230||e.x<-30||e.x>30){kill(e);return false;}return true;});
 hS.textContent=score();if(st==='play')rdTick(dt);
 if(st==='play'&&!CHASE&&score()>=5000)beginFinish();
}
function render(dt){trailTick(dt);rdVis();
 const mv=st==='play'||st==='intro'||st==='finish'?v:12;
 rt.offset.y+=mv*dt/16;onP.visible=onT>0&&st==='play';wrap(barr,mv*dt,300);wrap(cones,mv*dt,300);wrap(pines,mv*dt,320);
 if(car){car.position.x=P.x;car.position.y=P.y+(P.y<.15?1.5*Math.max(0,Math.abs(Math.sin(P.pt||0))-.06):0);{const pa=(mv-(P.pv==null?mv:P.pv))/Math.max(dt,.001);P.pv=mv;
 const tp=cl(P.vy*.022,-.4,.4)+cl(pa*.0018,-.07,.05)+(st==='play'&&(keys.ArrowDown||keys.s)?-.02:0)+(P.wh>0?.46+Math.min(.16,P.wd*.07)+Math.sin(P.wd*7)*.025:0)-(P.sk>0?.34:0),tr=-P.vx*.012,ty=-P.vx*.02;
 P.ptV=(P.ptV||0)+((tp-(P.pt||0))*70-(P.ptV||0)*8.5)*dt;P.pt=(P.pt||0)+P.ptV*dt;
 P.rlV=(P.rlV||0)+((tr-(P.rl||0))*65-(P.rlV||0)*8)*dt;P.rl=(P.rl||0)+P.rlV*dt;
 P.yawV=(P.yawV||0)+((ty-(P.yaw||0))*55-(P.yawV||0)*7)*dt;P.yaw=(P.yaw||0)+P.yawV*dt;
 car.rotation.x=cl(P.pt,-.5,P.wh>0?.75:.5);car.rotation.z=cl(P.rl,-.5,.5);car.rotation.y=cl(P.yaw,-.8,.8);}const br=car.userData.anim(dt,{v:mv,vx:P.vx,thr:st==='play'&&!!(keys.ArrowUp||keys.w),brk:st==='play'&&!!(keys.ArrowDown||keys.s)});if(st==='intro'){car.rotation.y=DY;car.rotation.z=DZ;car.rotation.x=DX;}tl.intensity=br?5.5:2.2;car.visible=!(inv>0&&Math.floor(t*14)%2);tl.position.set(P.x,.9,3.2);hl.position.set(P.x,1,-1);hl.target.position.set(P.x,0,-30);}
 shB.visible=shT>0&&(shT>1.2||Math.floor(shT*10)%2===0);shB.position.set(P.x,P.y+.95,0);shB.material.opacity=.2+.1*Math.sin(performance.now()/90);
 const sx=shake>0?rnd(-1,1)*shake*.7:0,sy=shake>0?rnd(-1,1)*shake*.5:0;
 if(st==='intro')introCam(sx,sy);else if(st==='finish')finishCam(sx,sy);else{cam.position.set(P.x*.7+sx+(st==='play'?0:Math.sin(performance.now()/2500)*1.2),4.1+sy+P.y*.4,9.2);cam.lookAt(P.x*.4,1.3,-20);}bd.position.x=P.x*.8;
 cam.fov=cam.userData.b+(mv-26)*.22+(st==='intro'||st==='finish'?fx:0)+(P.wh>0?Math.min(6,P.wd*3):0);cam.updateProjectionMatrix();hK.textContent=Math.round(mv*3.6);
 const a=rg.attributes.position.array;for(let i=0;i<RN;i++){a[i*6+1]-=38*dt;a[i*6+4]-=38*dt;if(a[i*6+1]<0){a[i*6+1]+=14;a[i*6+4]+=14;}}rg.attributes.position.needsUpdate=true;
 for(let k=0;k<SN;k++){if(sl[k]>0){sl[k]-=dt;sv[k*3+1]-=20*dt;sp[k*3]+=sv[k*3]*dt;sp[k*3+1]=Math.max(.05,sp[k*3+1]+sv[k*3+1]*dt);sp[k*3+2]+=(sv[k*3+2]+(st==='play'||st==='intro'||st==='finish'?v:0))*dt;if(sl[k]<=0)sp[k*3+1]=-999;}}sg.attributes.position.needsUpdate=true;
 R.render(scene,cam);}
function loop(ts){if(!alive)return;raf=requestAnimationFrame(loop);let raw=(ts-last)/1000||0;if(half&&raw<.028)return;const dt=Math.min(half?.05:.033,raw);last=ts;frames++;if(!(frames&63))audioWake();
if(MOBILE&&raw<.25&&st==='play'){fAcc+=raw;if(++fN>=24){const a=fAcc/fN;fAcc=0;fN=0;
 if(!half){
  if(a>.0195){if(PR>PRfloor+.01){if(frames-upAt<900)PRceil=Math.max(PRfloor,PR-.15);PR=Math.max(PRfloor,PR-.15);fit();}else if(a>.026){half=true;}}
  else if(a<.0175&&PR<PRceil&&frames-upAt>240){PR=Math.min(PRceil,PR+.1);upAt=frames;fit();}
 }else if(a>.04&&PR>PRhard+.01){PR=Math.max(PRhard,PR-.1);fit();}
}}
endT+=dt;if(st==='play')update(dt);else{t+=dt;if(st==='intro')introUpdate(dt);else if(st==='finish')finishUpdate(dt);}render(dt);}

/* input */
const kd=e=>{const k=e.key.length===1?e.key.toLowerCase():e.key;if(k.startsWith('Arrow')||k===' ')e.preventDefault();keys[k]=1;if(k==='m'&&MG)MG.gain.value=MG.gain.value?0:1;if(k==='r'&&st==='play')rdTog();
 if(k==='p'||k==='Escape'){if(st==='play'){drag0=null;tx=null;st='pause';showMenu('pause');}else if(st==='pause'){st='play';menu.style.display='none';}}
 else if((k==='Enter'||k===' ')&&(st==='menu'||(st==='over'&&endT>.5)))start();else if((st==='intro'||st==='finish')&&(k==='Enter'||k===' '))endIntro();};
const ku=e=>{keys[e.key.length===1?e.key.toLowerCase():e.key]=0;};
const pd=e=>{if(st==='play'&&(!drag0||e.isPrimary!==false)){drag0={x:e.clientX,px:P.x,id:e.pointerId};tx=P.x;try{box0.setPointerCapture(e.pointerId)}catch(_){}}};
/* точка отсчёта «переезжает» вместе с пальцем, когда цель упёрлась в край дороги — иначе после заезда за обочину палец надо долго возвращать, и машина «прилипает» и поворачивает с задержкой */
const pm=e=>{if(!drag0||st!=='play'||e.pointerId!==drag0.id)return;const k=20/box0.clientWidth,raw=drag0.px+(e.clientX-drag0.x)*k,c=cl(raw,-7,7);if(c!==raw){drag0.x=e.clientX;drag0.px=c;}tx=c;};
const pu=e=>{if(drag0&&e&&e.pointerId!==drag0.id)return;drag0=null;tx=null;};
const vis=()=>{if(document.hidden&&st==='play'){drag0=null;tx=null;st='pause';showMenu('pause');}else if(!document.hidden)audioWake();};
/* Шоурум (магазин ивента): та же сцена и та же машина, но без меню, дороги-игры и трафика.
   opts.showroom:true → mount возвращает {setSkin,setTrail,setFrame,destroy}; машину можно вращать пальцем/мышью, без касания она медленно крутится сама. */
if(opts.showroom){
 for(const c of Array.from(box0.children))if(c!==R.domElement)c.style.display='none';
 box0.style.touchAction='pan-y';box0.style.cursor='grab';scene.fog.density=.004;
 const key=new THREE.DirectionalLight(0xfff1e0,.8);scene.add(key);
 let yaw=.62,yv=0,idle=2,drag=null,lt=0,trT=0;
 buildPlayer();car.position.set(0,0,0);
 const sd=e=>{drag={x:e.clientX,y:yaw};yv=0;idle=0;box0.style.cursor='grabbing';try{box0.setPointerCapture(e.pointerId)}catch(_){}};
 const sm2=e=>{if(!drag)return;const ny=drag.y-(e.clientX-drag.x)*.012;yv=(ny-yaw)*20;yaw=ny;idle=0;};
 const su=()=>{drag=null;box0.style.cursor='grab';};
 box0.addEventListener('pointerdown',sd);box0.addEventListener('pointermove',sm2);box0.addEventListener('pointerup',su);box0.addEventListener('pointercancel',su);
 const trTick=dt=>{
  if(TRD){trT-=dt;while(trT<=0){trT+=.05;const m=TRS[tri++%TRN];m.material.color.set(Array.isArray(TRD.c)?TRD.c[tri&1]:TRD.c);m.position.set(rnd(-.3,.3),TRD.y*.7,PHD+.2);m.userData={l:TRD.l,m:TRD.l};m.scale.set(TRD.s*.5,TRD.s*.5,1);m.visible=true;}}
  for(const m of TRS){if(!m.visible)continue;const u=m.userData;u.l-=dt;if(u.l<=0){m.visible=false;continue;}m.position.z+=3.2*dt;const k=1-u.l/u.m;m.scale.setScalar((TRD?TRD.s*.5:.5)*(1+(TRD?TRD.g*.6:.6)*k));m.material.opacity=(TRD?TRD.a:.5)*(1-k);if(TRD&&TRD.y>.2)m.position.y+=dt*.6;}};
 const frame=ts=>{if(!alive)return;raf=requestAnimationFrame(frame);const dt=Math.min(.05,(ts-lt)/1000||0);lt=ts;
  if(!drag){idle+=dt;if(idle>1.2)yv+=(.35-yv)*Math.min(1,dt*2);else yv*=1-Math.min(1,dt*3);yaw+=yv*dt;}
  const r=cam.aspect<1.25?11:8.6;cam.position.set(Math.sin(yaw)*r,2.4,Math.cos(yaw)*r);cam.lookAt(0,.8,0);cam.fov=36;cam.updateProjectionMatrix();
  key.position.set(cam.position.x+4,7,cam.position.z+2);
  car.userData.anim(dt,{v:0,vx:0,thr:false,brk:false});trTick(dt);R.render(scene,cam);};
 raf=requestAnimationFrame(frame);
 return{
  setSkin(id){opts.skin=id||'';scene.remove(car);try{car.userData.tex.dispose()}catch(e){}car=null;buildPlayer();car.position.set(0,0,0);},
  setTrail(id){TRD=TRAIL[id]||null;for(const m of TRS)m.visible=false;},
  setFrame(id){FRAME_C=FRAME[id]||null;car.userData.setPlate(P.plate);},
  destroy(){alive=false;cancelAnimationFrame(raf);ro.disconnect();try{R.dispose();R.forceContextLoss&&R.forceContextLoss()}catch(e){}box0.remove();sty.remove();}};
}
addEventListener('keydown',kd);addEventListener('keyup',ku);document.addEventListener('visibilitychange',vis);
box0.addEventListener('pointerdown',pd);box0.addEventListener('pointerdown',audioWake,{passive:true});box0.addEventListener('pointermove',pm);box0.addEventListener('pointerup',pu);box0.addEventListener('pointercancel',pu);box0.addEventListener('lostpointercapture',pu);
buildPlayer();hearts();
/* прогрев: компилируем шейдеры и заливаем текстуры в видеопамять заранее, чтобы не было подвисаний при первом появлении объектов */
try{const tmp=[];try{if(typeof mkGantry==='function'){const g=mkGantry();g.position.set(0,0,-60);scene.add(g);tmp.push(g);}if(typeof mkSign==='function'){const g=mkSign(1);g.position.set(0,0,-70);scene.add(g);tmp.push(g);}}catch(_){}
const seen=new Set();scene.traverse(o=>{const ms=o.material?(Array.isArray(o.material)?o.material:[o.material]):[];for(const m of ms)for(const k in m){const t=m[k];if(t&&t.isTexture&&!seen.has(t)){seen.add(t);try{R.initTexture&&R.initTexture(t);}catch(_){}}}});
R.compile(scene,cam);for(const g of tmp)scene.remove(g);}catch(_){}
showMenu('menu');raf=requestAnimationFrame(loop);if(opts.autostart)start();
return{start,setRun(r){r=r||{};const f=r.fx||{};for(const k in FX)FX[k]=Math.min(200,Math.max(0,+f[k]||0));PKT=[];let tt=t+rnd(12,20);for(let i=0;i<Math.min(3,r.pk|0);i++){PKT.push(tt);tt+=rnd(18,32);}},pause(){if(st==='play'){drag0=null;tx=null;st='pause';showMenu('pause');}},destroy(){alive=false;try{AC&&AC.close()}catch(e){}cancelAnimationFrame(raf);ro.disconnect();removeEventListener('keydown',kd);removeEventListener('keyup',ku);document.removeEventListener('visibilitychange',vis);R.dispose();box0.remove();sty.remove();}};
}
window.RoadWorks={mount};
})();
