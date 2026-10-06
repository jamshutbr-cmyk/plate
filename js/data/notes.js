// Подпись под выпавшим номером: что за серия (если известно) и чем он необычен.
// Всё считается на клиенте только для показа: цену и редкость по-прежнему определяет сервер.

// Особые серии. Чтобы добавить новую: строка {l: буквы номера, r: [коды регионов] или не указывать для любого региона, t: текст}.
export const SPECIAL=[
 {l:'ССС',r:['77'],t:'Центр спецсвязи, Фельдъегерская служба'},
];

const pl=(n,one,few)=>n+' '+(n==1?one:few);
const rev=x=>[...x].reverse().join('');
const cnt=s=>{const m={};for(const c of s)m[c]=(m[c]||0)+1;return Object.values(m)};

// -> {who: string|null, tags: string[]}
export function plateNotes(p){
  const d=p.main.replace(/\D/g,''),l=p.main.replace(/[\d\s-]/g,''),tags=[];
  const lc=l.length?Math.max(...cnt(l)):0,dc=Math.max(...cnt(d)),pairs=cnt(d).filter(x=>x==2).length;
  if(lc>=2)tags.push(lc+' одинаковые буквы');
  if(dc>=2)tags.push(pairs==2?'2 пары одинаковых цифр':dc+' одинаковые цифры');
  const a=[...d].map(Number);let seq=false;
  for(let i=0;i+2<a.length;i++)if((a[i+1]==a[i]+1&&a[i+2]==a[i+1]+1)||(a[i+1]==a[i]-1&&a[i+2]==a[i+1]-1))seq=true;
  if(seq)tags.push('Три цифры подряд');
  if(d.length>2&&d==rev(d))tags.push('Зеркальные цифры');
  if(l.length>1&&l==rev(l))tags.push('Палиндром букв');
  if(/^[1-9]0+$/.test(d))tags.push('Круглый номер');
  if(p.reg&&p.reg.length>1&&d.includes(p.reg))tags.push('Цифры совпадают с регионом');
  if(['777','888','999','555','007'].includes(d))tags.push('Блатной номер');
  if(/^0+[1-9]$/.test(d))tags.push('Малый номер');
  const s=SPECIAL.find(x=>x.l==l&&(!x.r||x.r.includes(p.reg)));
  return {who:s?s.t:null,tags};
}

export function notesHTML(p){
  const n=plateNotes(p);if(!n.who&&!n.tags.length)return '';
  return `<div class="pn">${n.who?`<b>${n.who}</b>`:''}${n.tags.map(t=>`<span>${t}</span>`).join('')}</div>`;
}
