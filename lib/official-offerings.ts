import { excluded, rowKey, planSchema, officialCourseSchema, type Plan, type OfficialCourse } from './model';
import { normalizedName } from './school-curriculum';

const text=(v:unknown)=>String(v??'').trim();
const headerText=(v:unknown)=>text(v).replace(/[\s·ㆍ()]/g,'');
const fields:Record<string,string[]>={major:['전공명','학과명'],code:['교과목코드','과목코드','학수번호'],name:['과목명','교과목명'],section:['분반번호','분반'],instructorType:['담당교원','교원구분'],instructor:['담당교원이름','교원명','담당교수'],category:['구분','이수구분','학수구분'],credits:['학점'],hours:['시간','시수'],process:['일반/심화과정과목'],exception:['예외적용과목'],exceptionReason:['예외적용사유'],teamTeaching:['윤강여부'],remote:['원격수업여부'],note:['비고']};
export function officialMap(row:unknown[]){return Object.fromEntries(Object.entries(fields).map(([key,aliases])=>[key,row.findIndex(v=>aliases.includes(headerText(v)))]));}
export function officialHeader(rows:unknown[][]){return rows.slice(0,40).findIndex(row=>{const m=officialMap(row);return m.code>=0&&m.name>=0&&m.section>=0;});}
// Excel stores a vertically merged value only in its top cell. Expand only
// declared merges in data columns; never guess missing values by filling down.
export function expandOfficialMerges(rows:unknown[][],merges:{s:{r:number,c:number},e:{r:number,c:number}}[]=[]){
 const result=rows.map(r=>[...r]),header=officialHeader(rows);if(header<0)return result;
 const map=officialMap(rows[header]),columns=new Set(Object.entries(map).filter(([key,index])=>key!=='section'&&index>=0).map(([,index])=>index));
 for(const m of merges){if(m.s.r<=header||m.s.c!==m.e.c||!columns.has(m.s.c)||!rows[m.s.r])continue;
  const value=rows[m.s.r][m.s.c];for(let r=m.s.r+1;r<=Math.min(m.e.r,result.length-1);r++)if(result[r][m.s.c]===''||result[r][m.s.c]==null)result[r][m.s.c]=value;
 }
 return result;
}
export const officialGroupKey=(c:Pick<OfficialCourse,'major'|'code'|'name'>)=>`${c.major}:${c.code}:${normalizedName(c.name)}`;
export function combineOfficialGroups(first:OfficialCourse,next:OfficialCourse):OfficialCourse{
 if(first.code!==next.code||first.major!==next.major||first.credits!==next.credits||first.category!==next.category)throw Error('서로 다른 코드·전공·학점·이수구분의 제출 과목은 하나로 합칠 수 없습니다.');
 if(next.sections.some(s=>first.sections.some(p=>p.section===s.section)))throw Error('같은 교육과정에 연결한 분반번호가 중복됩니다.');
 return {...first,sections:[...first.sections,...next.sections].map(s=>({...s,note:[s.note,`제출 원문: ${next.sections.includes(s)?next.name:first.name} (${first.code})`].filter(Boolean).join(' / ')}))};
}
export function officialMappingConflict(groups:OfficialCourse[],mapping:Record<string,string>){
 const selected=new Map<string,OfficialCourse>();try{for(const g of groups){const key=mapping[officialGroupKey(g)];if(!key||key==='skip')continue;const old=selected.get(key);selected.set(key,old?combineOfficialGroups(old,g):g);}return '';}catch(e){return e instanceof Error?e.message:'과목 연결을 확인해주세요.';}
}
export const isMarked=(v:string)=>/^(o|○|◯|ㅇ|y|yes|1|예|해당)$/i.test(v.trim());
export type OfficialRead={groups:OfficialCourse[],header:number,year?:number,semester?:1|2,excluded:number,examples:number,errors:string[],warnings:string[]};
// Exact signatures of the five example rows supplied by Academic Affairs. Never import them as a plan.
const examples=new Set(['CMAT201|공업수학E|1|김아주','MECH212|유체역학|1|이아주','MECH474|캡스톤디자인|1|최아주','MECH474|캡스톤디자인|2|박아주','ART115|음악의 세계|1|한아주']);
export function readOfficialRows(rows:unknown[][]):OfficialRead{
 const header=officialHeader(rows);if(header<0)throw Error('교무팀 양식의 교과목코드·과목명·분반번호 열을 찾지 못했습니다. 제목 행을 포함한 제출 양식을 올려주세요.');
 const map=officialMap(rows[header]);for(const key of ['major','category','credits'])if(map[key]<0)throw Error('전공명·구분·학점 열이 포함된 교무팀 제출 양식을 사용해주세요.');
 const titles=rows.slice(0,header).flat().map(text).join(' '),term=titles.match(/(20\d{2})\s*(?:학년도|년)?\s*[-.]?\s*([12])\s*학기/);
 const groups=new Map<string,OfficialCourse>(),errors:string[]=[],warnings:string[]=[];let omitted=0,samples=0;
 rows.slice(header+1).forEach((row,index)=>{
  const rowNo=header+index+2,get=(k:string)=>text(row[map[k]]),code=get('code'),name=get('name');
  if(!code&&!name)return; // blank, repeated instructional cells, and footer punctuation
  if(headerText(code)==='교과목코드'&&headerText(name)==='과목명')return;
  if(excluded(name)){omitted++;return;}
  if(examples.has([code,name,get('section'),get('instructor')].join('|'))){samples++;return;}
  const prefix=`${rowNo}행 ${name||code}`;
  if(!code||!name){errors.push(`${prefix}: 교과목코드와 과목명을 모두 입력해주세요.`);return;}
  let section=get('section').replace(/^([0-9]+)\s*분반$/,'$1');
  if(/^\d+$/.test(section))section=String(Number(section));
  if(!section||section.length>40||section==='0'){errors.push(`${prefix}: 분반번호를 확인해주세요.`);return;}
  const creditText=get('credits'),credits=Number(creditText),hoursText=get('hours'),hours=hoursText?Number(hoursText):undefined;
  if(creditText===''||!Number.isFinite(credits)||credits<0||credits>30){errors.push(`${prefix}: 학점은 0~30 사이의 숫자여야 합니다.`);return;}
  if(hours!==undefined&&(!Number.isFinite(hours)||hours<0||hours>100)){errors.push(`${prefix}: 수업 시간을 확인해주세요.`);return;}
  const major=get('major'),category=get('category');if(!major||!category){errors.push(`${prefix}: 전공명과 구분을 입력해주세요.`);return;}
  const key=officialGroupKey({major,code,name}),previous=groups.get(key);
  if(previous&&(previous.credits!==credits||previous.category!==category)){errors.push(`${prefix}: 같은 과목의 구분·학점이 서로 다릅니다.`);return;}
  if(previous?.sections.some(s=>s.section===section)){errors.push(`${prefix}: ${section}분반이 중복되었습니다. 윤강 교원은 같은 분반 행의 담당교원 칸에 함께 입력해주세요.`);return;}
  const item={row:rowNo,section,instructorType:get('instructorType'),instructor:get('instructor'),hours,process:get('process'),exception:get('exception'),exceptionReason:get('exceptionReason'),teamTeaching:get('teamTeaching'),remote:get('remote'),note:get('note')};
  const group=previous??{major,code,name,category,credits,sections:[]};group.sections.push(item);groups.set(key,group);
 });
 const valid:OfficialCourse[]=[];for(const c of groups.values()){const result=officialCourseSchema.safeParse(c);if(result.success)valid.push(result.data);else errors.push(`${c.name}: 분반은 최대 100개이며 셀 내용의 길이 제한을 확인해주세요.`);}
 for(const code of new Set(valid.map(g=>g.code))){const own=valid.filter(g=>g.code===code);if(new Set(own.map(g=>normalizedName(g.name))).size>1)warnings.push(`${code}: 서로 다른 과목명(${own.map(g=>g.name).join(', ')})이 기재되어 있습니다. 각각 올바른 교육과정에 연결하세요.`);}
 return {groups:valid,header,year:term?Number(term[1]):undefined,semester:term?Number(term[2]) as 1|2:undefined,excluded:omitted,examples:samples,errors,warnings};
}
export function offeringCandidates(plan:Plan,semester:1|2){const pool=plan.curriculum.filter(c=>c.year===plan.curriculumYear&&!excluded(c.name)),codes=[...new Set(pool.map(c=>c.code))];return codes.map(code=>pool.find(c=>c.code===code&&c.semester===semester)??pool.find(c=>c.code===code)!);}
export function matchOfficialCourse(plan:Plan,semester:1|2,group:OfficialCourse){
 const pool=offeringCandidates(plan,semester);
 const exact=pool.filter(c=>c.code===group.code&&normalizedName(c.name)===normalizedName(group.name)&&c.credits===group.credits);
 const suggested=pool.filter(c=>normalizedName(c.name)===normalizedName(group.name));
 return {key:exact.length===1?rowKey(exact[0]):'',suggestions:suggested.map(rowKey)};
}
export function applyOfficialOfferings(plan:Plan,semester:1|2,groups:OfficialCourse[],mapping:Record<string,string>,source:{filename:string,sheet:string,year?:number,semester?:number,periodConfirmed?:boolean}):Plan{
 if(!plan.planningYear)throw Error('대상 학년도를 먼저 선택해주세요.');
 if(!source.periodConfirmed&&(source.year&&source.year!==plan.planningYear||source.semester&&source.semester!==semester))throw Error('양식 제목의 학년도·학기가 선택한 대상 학기와 다릅니다. 대상 학기 또는 파일을 확인해주세요.');
 const selected=new Map<string,OfficialCourse>(),curriculum=[...plan.curriculum];
 for(const group of groups){const key=mapping[officialGroupKey(group)];if(key==='skip')continue;
  const course=plan.curriculum.find(c=>rowKey(c)===key&&c.year===plan.curriculumYear&&!excluded(c.name));
  if(!course)throw Error(`${group.name}: 연결할 교육과정을 선택하거나 이번 산출에서 제외해주세요.`);
  const targetKey=`${course.year}:${course.code}:${semester}`;
  const previous=selected.get(targetKey);
  if(!curriculum.some(c=>rowKey(c)===targetKey))curriculum.push({...course,semester,share:0,shareMode:'manual',recommendedSemesters:course.recommendedSemesters??[course.semester as 1|2],note:[course.note,'교무팀 제출 양식의 권장학기 외 보충 개설'].filter(Boolean).join(' / ')});
  selected.set(targetKey,previous?combineOfficialGroups(previous,group):group);
 }
 if(!selected.size)throw Error('연결된 과목이 없습니다. 1단계에서 해당 학기의 교육과정을 확인해주세요.');
 const overrides={...plan.overrides};
 for(const c of curriculum.filter(c=>c.year===plan.curriculumYear&&c.semester===semester)){
  const key=rowKey(c),group=selected.get(key);
  overrides[key]={...overrides[key],enabled:!!group,...(group?{sections:group.sections.length,sectionIds:group.sections.map(s=>s.section),creditExceptionConfirmed:false,official:{sourceYear:source.year,sourceSemester:source.semester,periodConfirmed:source.periodConfirmed,year:plan.planningYear,semester,filename:source.filename,sheet:source.sheet,importedAt:new Date().toISOString(),course:group}}:{})};
 }
 return planSchema.parse({...plan,curriculum,overrides,planningSemester:semester,offeringImportNotes:{...plan.offeringImportNotes,[`${plan.planningYear}:${semester}`]:{filename:source.filename,omitted:groups.filter(g=>mapping[officialGroupKey(g)]==='skip').map(g=>({code:g.code,name:g.name,credits:g.credits}))}}});
}
