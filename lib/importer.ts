import { courseSchema, historySchema, planSchema, type Plan } from './model';
export type ImportKind='cohorts'|'curriculum'|'history';
export type Field={key:string,label:string,aliases:string[],optional?:boolean};
export const fields:Record<ImportKind,Field[]>={
 cohorts:[{key:'grade',label:'학년',aliases:['학년','대상학년']},{key:'count',label:'재학생 수',aliases:['재학생수','재학인원','재학','현재재학','인원'],optional:true},{key:'status',label:'학적 상태',aliases:['학적상태','학적변동','학적','상태'],optional:true}],
 curriculum:[{key:'code',label:'과목코드',aliases:['과목코드','학수번호','연결키']},{key:'name',label:'과목명',aliases:['과목명','교과목명']},{key:'grade',label:'권장학년',aliases:['권장학년','학년','대상학년']},{key:'semester',label:'권장학기',aliases:['권장학기','학기']},{key:'category',label:'이수구분',aliases:['이수구분','교육과정구분','학수구분','구분']},{key:'credits',label:'학점',aliases:['학점']},{key:'share',label:'학기별 이수비중',aliases:['이수비중','학기별이수비중'],optional:true}],
 history:[{key:'year',label:'개설연도',aliases:['개설연도','학년도','년도','연도']},{key:'semester',label:'학기',aliases:['학기']},{key:'code',label:'과목코드',aliases:['과목코드','학수번호','연결키','원과목코드']},{key:'name',label:'과목명',aliases:['과목명','교과목명','원과목명']},{key:'section',label:'분반',aliases:['분반']},{key:'capacity',label:'설정정원',aliases:['설정정원','수강정원','정원','제한인원']},{key:'enrolled',label:'수강인원',aliases:['수강인원','신청인원']},{key:'pre',label:'예비수강인원',aliases:['예비수강인원','예비인원','예비수강신청인원'],optional:true}]
};
const normalized=(v:unknown)=>String(v??'').replace(/[\s·()]/g,'');
export function suggestMap(headers:unknown[],kind:ImportKind){return Object.fromEntries(fields[kind].map(f=>[f.key,headers.findIndex(h=>f.aliases.includes(normalized(h)))]));}
export function suggestHeader(rows:unknown[][],kind:ImportKind){let best=0,score=0;rows.slice(0,30).forEach((r,i)=>{const n=Object.values(suggestMap(r,kind)).filter(x=>x>=0).length;if(n>score){score=n;best=i;}});return best;}
const number=(v:unknown)=>{const str=String(v??'').trim().replaceAll(',','').replace(/학년|학기/g,'');return str===''?NaN:Number(str);};
export function importRows(plan:Plan,kind:ImportKind,rows:unknown[][],mapping:Record<string,number>,importYear:number,cohortMode:'aggregate'|'individual'){
 const required=fields[kind].filter(f=>!f.optional);for(const f of required)if((mapping[f.key]??-1)<0)throw new Error(f.label+' 열을 연결해주세요.');
 if(kind==='cohorts'&&cohortMode==='aggregate'&&(mapping.count??-1)<0)throw new Error('재학생 수 열을 연결해주세요.');
 if(kind==='cohorts'&&cohortMode==='individual'&&(mapping.status??-1)<0)throw new Error('개인별 명단에서는 재학 상태 열을 연결해주세요.');
 const assigned=Object.values(mapping).filter(n=>n>=0);if(new Set(assigned).size!==assigned.length)throw new Error('같은 열을 여러 항목에 연결할 수 없습니다.');
 const p=structuredClone(plan),errors:string[]=[],courses:Plan['curriculum']=[],history:Plan['history']=[],counts=new Array(plan.cohorts.length).fill(0);let used=0,skipped=0;
 rows.forEach((row,i)=>{
  if(!row.some(x=>x!==null&&x!==undefined&&String(x).trim()!==''))return;
  const get=(k:string)=>row[mapping[k]??-1];
  try{
   if(kind==='cohorts'){
    const status=String(get('status')??'').trim();if((mapping.status??-1)>=0&&!['재학','재학생'].includes(status)){skipped++;return;}
    const grade=number(get('grade')),n=cohortMode==='individual'?1:number(get('count'));
    if(!Number.isInteger(grade)||grade<1||grade>plan.cohorts.length||!Number.isInteger(n)||n<0)throw new Error('학년 또는 재학생 수를 확인해주세요.');
    counts[grade-1]+=n;used++;
   }else if(kind==='curriculum'){
    const cat=normalized(get('category'));const category=({'전공필수':'전필','전공선택':'전선','기초':'전공기초','교필':'교양필수'} as Record<string,string>)[cat]??cat;
    const shareRaw=get('share'),share=(mapping.share??-1)<0||shareRaw===undefined||shareRaw===null||shareRaw===''?1:typeof shareRaw==='string'&&shareRaw.includes('%')?number(shareRaw.replace('%',''))/100:number(shareRaw);
    courses.push(courseSchema.parse({code:String(get('code')??'').trim(),name:String(get('name')??'').trim(),year:importYear,grade:number(get('grade')),semester:number(get('semester')),category,credits:number(get('credits')),share,note:''}));used++;
   }else{
    history.push(historySchema.parse({code:String(get('code')??'').trim(),name:String(get('name')??'').trim(),year:number(get('year')),semester:number(get('semester')),section:String(get('section')??'').trim(),capacity:number(get('capacity')),enrolled:number(get('enrolled')),...((mapping.pre??-1)>=0?{pre:number(get('pre'))}:{})}));used++;
   }
  }catch{errors.push(`${i+1}번째 데이터 행: 필수값·숫자·학년·이수구분을 확인해주세요.`);}
 });
 if(errors.length)throw new Error(errors.slice(0,3).join('\n')+(errors.length>3?` 외 ${errors.length-3}개 오류`:''));
 if(!used)throw new Error('적용할 데이터가 없습니다. 제목 행과 열 연결을 확인해주세요.');
 if(kind==='cohorts'){p.cohorts=counts;p.leaveCounts=undefined;}
 if(kind==='curriculum'){if(p.curriculumSources?.[importYear])p.curriculumSources[importYear].locallyEdited=true;p.curriculum=[...p.curriculum.filter(c=>c.year!==importYear),...courses];p.curriculumYear=importYear;for(const key of Object.keys(p.overrides))if(key.startsWith(importYear+':'))delete p.overrides[key];}
 if(kind==='history'){const periods=new Set(history.map(h=>h.year+':'+h.semester));p.history=[...p.history.filter(h=>!periods.has(h.year+':'+h.semester)),...history];}
 const valid=planSchema.safeParse(p);if(!valid.success)throw new Error(valid.error.issues[0].message);
 return {plan:valid.data,used,skipped};
}
export const templates:Record<ImportKind,unknown[][]>={cohorts:[['학년','재학생수'],[1,60],[2,58],[3,61],[4,59]],curriculum:[['과목코드','과목명','권장학년','권장학기','이수구분','학점','이수비중'],['EX101','예시 전공기초',1,1,'전공기초',3,1],['EX201','예시 선택과목',2,2,'전선',3,1]],history:[['개설연도','학기','과목코드','과목명','분반','설정정원','수강인원','예비인원'],[2026,1,'EX101','예시 전공기초',1,60,62,65],[2026,2,'EX201','예시 선택과목',1,40,35,36]]};
