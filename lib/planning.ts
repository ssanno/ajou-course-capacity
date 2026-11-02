import { excluded, rowKey, planSchema, type Plan, type Course, type Result } from './model';

export type OfferingChoice={key:string,name:string,limit?:number,sections?:number};
export const offeringFields=[
 {key:'code',label:'과목코드',aliases:['교과목코드','과목코드','학수번호','연결키','원과목코드']},
 {key:'name',label:'과목명',aliases:['과목명','교과목명','원과목명']},
 {key:'sections',label:'분반 수',aliases:['분반수','개설분반수','예정분반수']},
 {key:'limit',label:'분반당 최대 정원 (선택)',aliases:['분반당최대정원','분반당정원','분반당한도','설정정원','정원','수강정원']},
];
const norm=(v:unknown)=>String(v??'').trim().replace(/[\s·()]/g,'');
export function offeringMap(headers:unknown[]){return Object.fromEntries(offeringFields.map(f=>[f.key,headers.findIndex(h=>f.aliases.includes(norm(h)))]));}
export function offeringHeader(rows:unknown[][]){let index=0,max=0;rows.slice(0,30).forEach((r,i)=>{const m=offeringMap(r),score=(m.code>=0?2:0)+(m.name>=0?2:0)+(m.limit>=0?1:0)+(m.sections>=0?1:0);if(score>max){max=score;index=i;}});return index;}
export function matchOfferings(plan:Plan,semester:number,records:unknown[][],map:Record<string,number>){
 if((map.code??-1)<0&&(map.name??-1)<0)throw Error('과목코드 또는 과목명 열을 연결해주세요.');
 const mapped=Object.values(map).filter(v=>v>=0);if(new Set(mapped).size!==mapped.length)throw Error('같은 열을 여러 항목에 연결할 수 없습니다.');
 const courses=plan.curriculum.filter(c=>c.year===plan.curriculumYear&&c.semester===semester&&!excluded(c.name));
 const choices=new Map<string,OfferingChoice>();let skipped=0,duplicates=0;const errors:string[]=[];
 records.forEach((row,i)=>{
  if(!row.some(v=>String(v??'').trim()))return;
  const code=String(row[map.code]??'').trim(),name=String(row[map.name]??'').trim();
  if(excluded(name)||plan.curriculum.some(c=>c.code===code&&excluded(c.name))){skipped++;return;}
  if(!code&&!name){errors.push(`${i+1}행: 과목코드 또는 과목명이 필요합니다.`);return;}
  const found=courses.filter(c=>code?c.code===code:norm(c.name)===norm(name));
  if(found.length!==1){errors.push(`${i+1}행: ‘${code||name}’을 ${semester}학기 교육과정에서 찾을 수 없습니다. 1단계의 코드·학기를 확인해주세요.`);return;}
  const v=row[map.limit],str=String(v??'').trim(),limit=str===''?undefined:Number(str.replaceAll(',',''));
  if(limit!==undefined&&(!Number.isInteger(limit)||limit<1||limit>1000)){errors.push(`${i+1}행: 분반당 정원은 1~1,000명이어야 합니다.`);return;}
  const sectionText=String(row[map.sections]??'').trim();const sections=sectionText===''?undefined:Number(sectionText.replaceAll(',',''));
  if((plan.workflowVersion===2&&sections===undefined)||(sections!==undefined&&(!Number.isInteger(sections)||sections<1||sections>100))){errors.push(`${i+1}행: 분반 수를 1~100개로 입력해주세요.`);return;}
  const c=found[0],key=rowKey(c),old=choices.get(key);if(old){if(plan.workflowVersion===2){errors.push(`${i+1}행: 같은 과목이 중복되었습니다. 한 과목당 한 행에 전체 분반 수를 입력해주세요.`);return;}duplicates++;}
  choices.set(key,{key,name:c.name,sections,limit:old?.limit===undefined?limit:limit===undefined?old.limit:Math.max(old.limit,limit)});
 });
 if(errors.length)throw Error(errors.slice(0,3).join('\n')+(errors.length>3?`\n외 ${errors.length-3}개 행 확인 필요`:''));
 if(!choices.size)throw Error('적용할 과목이 없습니다. 학기와 입력 자료를 확인해주세요.');
 return {choices:[...choices.values()],skipped,duplicates};
}
export function applyOfferings(plan:Plan,semester:number,choices:OfferingChoice[]):Plan{
 const picked=new Map(choices.map(c=>[c.key,c])),overrides={...plan.overrides};
 for(const c of plan.curriculum.filter(c=>c.year===plan.curriculumYear&&c.semester===semester&&!excluded(c.name))){const k=rowKey(c),v=picked.get(k);overrides[k]={...overrides[k],enabled:!!v,official:undefined,sectionIds:undefined,creditExceptionConfirmed:false,...(v?.sections!==undefined?{sections:v.sections}:{}),...(v?.limit!==undefined?{limit:v.limit}:{})};}
 const offeringImportNotes={...plan.offeringImportNotes};delete offeringImportNotes[`${plan.planningYear}:${semester}`];
 return planSchema.parse({...plan,overrides,offeringImportNotes,planningSemester:semester});
}
export function updateCourse(plan:Plan,course:Course,oldKey?:string):Plan{
 const curriculum=oldKey?plan.curriculum.map(c=>rowKey(c)===oldKey?course:c):[...plan.curriculum,course];
 const overrides={...plan.overrides};if(oldKey&&oldKey!==rowKey(course)){if(overrides[oldKey])overrides[rowKey(course)]=overrides[oldKey];delete overrides[oldKey];}
 const curriculumSources={...plan.curriculumSources};for(const y of [course.year,...(oldKey?[Number(oldKey.split(":")[0])]:[])])if(curriculumSources[y])curriculumSources[y]={...curriculumSources[y],locallyEdited:true};
 return planSchema.parse({...plan,curriculum,overrides,curriculumYear:course.year,curriculumSources});
}
export function sectionDescription(r:Result){if(r.sections===null||r.perSection===null)return '산정 보류';if(!r.sections)return '개설 불필요';return Array.from({length:Math.min(r.sections,8)},(_,i)=>`${i+1}분반 ${r.perSection}명`).join(' · ')+(r.sections>8?` · 나머지 ${r.sections-8}개 분반도 각 ${r.perSection}명`:'');}

export function allocatedSections(plan:Plan,row:Result):number[]|null{
 const n=plan.overrides[row.key]?.sections,total=plan.workflowVersion===2?row.capacity:row.demand;
 if(!n||!row.enabled||total===null)return null;
 const exact=Array.from({length:n},()=>total/n),out=exact.map(Math.floor);
 const order=exact.map((v,i)=>({i,frac:v-out[i]})).sort((a,b)=>b.frac-a.frac||a.i-b.i);
 for(let i=0,left=total-out.reduce((a,b)=>a+b,0);i<left;i++)out[order[i].i]++;
 return out;
}
export function allocationBasis(_plan:Plan,_row:Result){
 return '입력한 분반 수에 균등 배분';
}
export function sectionIds(plan:Plan,key:string):string[]{
 const o=plan.overrides[key],n=o?.sections??0,ids=[...(o?.sectionIds??[])].slice(0,n);let next=1;
 while(ids.length<n){while(ids.includes(String(next)))next++;ids.push(String(next++));}
 return ids;
}
