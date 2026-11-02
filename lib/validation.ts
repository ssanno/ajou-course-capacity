import { planSchema,forecast,excluded,csvText,type Plan,type History,type Result } from './model';
import { allocatedSections,sectionIds } from './planning';
import type { HistoryGroup } from './history-import';

export function applyValidation(plan:Plan,groups:HistoryGroup[],mapping:Record<string,string>,options:{year:number,semester:1|2,filename:string}){
 if(options.year!==plan.planningYear||options.semester!==plan.planningSemester)throw Error('검증자료의 학기가 현재 대상 학기와 같아야 합니다.');
 const actuals:History[]=[],seen=new Set<string>();let omitted=0;
 for(const g of groups){const code=mapping[g.code];if(!code)throw Error(`${g.name}: 과목 연결 또는 제외를 선택해주세요.`);if(code==='skip'){omitted++;continue;}
  if(seen.has(code))throw Error('동일 과목에 여러 실적을 연결할 수 없습니다.');seen.add(code);
  if(!plan.curriculum.some(c=>c.year===plan.curriculumYear&&c.semester===options.semester&&c.code===code&&!excluded(c.name)))throw Error(`${g.name}: 대상 학기 교육과정을 확인해주세요.`);
  actuals.push(...g.rows.map(h=>({...h,code,sourceCode:g.code,year:options.year,semester:options.semester})));
 }
 if(!actuals.length)throw Error('비교할 과목이 없습니다.');
 // Benchmark labels are deliberately outside history. Importing them never changes
 // categories, selected section IDs, cohort counts or the forecasting mode.
 return planSchema.parse({...plan,validation:{...options,actuals,omitted,importedAt:new Date().toISOString()}});
}
export type Comparison={code:string,name:string,section?:string,predicted:number|null,actual:number|null,enrolled:number|null,error:number|null,ape:number|null,basis:string};
export const VALIDATION_TOLERANCE=.20;
export const VALIDATION_UPPER_TOLERANCE=.25;
export function metrics(rows:Comparison[]){
 const usable=rows.filter(r=>r.predicted!==null&&r.actual!==null),positive=usable.filter(r=>r.actual!>0),denom=usable.reduce((s,r)=>s+r.actual!,0);
 const abs=usable.reduce((s,r)=>s+Math.abs(r.predicted!-r.actual!),0);
 return {n:usable.length,total:rows.length,actual:denom,predicted:usable.reduce((s,r)=>s+r.predicted!,0),absoluteError:abs,wape:denom>0?abs/denom:null,mae:usable.length?abs/usable.length:null,mape:positive.length?positive.reduce((s,r)=>s+r.ape!,0)/positive.length:null,within5:usable.filter(r=>r.actual===0?r.predicted===0:r.ape!<=.05+1e-9).length,within10:usable.filter(r=>r.actual===0?r.predicted===0:r.ape!<=.1+1e-9).length,within20:usable.filter(r=>r.actual===0?r.predicted===0:r.ape!<=VALIDATION_TOLERANCE+1e-9).length,within25:usable.filter(r=>r.actual===0?r.predicted===0:r.ape!<=VALIDATION_UPPER_TOLERANCE+1e-9).length};
}
function compare(code:string,name:string,predicted:number|null,actual:number|null,enrolled:number|null,basis:string,section?:string):Comparison{
 return {code,name,predicted,actual,enrolled,basis,section,error:predicted===null||actual===null?null:predicted-actual,ape:predicted===null||actual===null||actual===0?null:Math.abs(predicted-actual)/actual};
}
export function validatePlan(plan:Plan){
 const v=plan.validation;if(!v||v.year!==plan.planningYear||v.semester!==plan.planningSemester)return null;
 const rows=forecast(plan).filter(r=>r.enabled&&r.course.semester===plan.planningSemester),actual=v.actuals.filter(h=>!excluded(h.name)&&h.year===v.year&&h.semester===v.semester);
 const courses:Comparison[]=[],sections:Comparison[]=[],enrollment:Comparison[]=[];
 const codes=new Set([...rows.map(r=>r.course.code),...actual.map(h=>h.code)]);
 for(const code of codes){const row=rows.find(r=>r.course.code===code),hs=actual.filter(h=>h.code===code),name=row?.course.name??hs[0]?.name??code,basis=row?.method??'계획 없음';
  courses.push(compare(code,name,row?.capacity??null,hs.length?hs.reduce((s,h)=>s+h.capacity,0):null,hs.length?hs.reduce((s,h)=>s+h.enrolled,0):null,basis));
  enrollment.push(compare(code,name,row?.demand??null,hs.length?hs.reduce((s,h)=>s+h.enrolled,0):null,hs.length?hs.reduce((s,h)=>s+h.enrolled,0):null,basis));
  const ids=row?sectionIds(plan,row.key):[],allocation=row?allocatedSections(plan,row):null;
  for(const id of new Set([...ids,...hs.map(h=>h.section)])){const h=hs.find(h=>h.section===id),i=ids.indexOf(id);sections.push(compare(code,name,i>=0?allocation?.[i]??null:null,h?.capacity??null,h?.enrolled??null,basis,id));}
 }
 const courseMetrics=metrics(courses),sectionMetrics=metrics(sections),enrollmentMetrics=metrics(enrollment);
 const source=plan.headcountSources?.[`${v.year}:${v.semester}`],sourceMatches=source&&JSON.stringify(source.counts)===JSON.stringify(plan.studentCounts),termStart=`${v.year}-${v.semester===1?'03':'09'}`;
 const timingWarnings:string[]=[];
 if(sourceMatches&&source.asOfMonth>=termStart)timingWarnings.push(`${source.asOfMonth} ${source.population} 인원은 대상 학기 시작 이후 자료입니다. 개설 전 예측 성능으로 인정할 수 없습니다.`);
 const conditional=rows.filter(r=>r.conditional).length;
 if(rows.some(r=>r.conditional&&plan.overrides[r.key].demandInput!.observedOn.slice(0,7)>=termStart))timingWarnings.push('학기 시작 이후 확인한 수요가 포함되어 있습니다. 사전예측과 구분하세요.');
 const leaks=rows.some(r=>r.calibration),complete=courseMetrics.n===courses.length&&sectionMetrics.n===sections.length&&v.omitted===0;
 const within20=complete&&!leaks&&!timingWarnings.length&&courseMetrics.wape!==null&&courseMetrics.wape<=VALIDATION_TOLERANCE+1e-9&&sectionMetrics.wape!==null&&sectionMetrics.wape<=VALIDATION_TOLERANCE+1e-9&&courseMetrics.within20===courseMetrics.n&&sectionMetrics.within20===sectionMetrics.n;
 const within25=complete&&!leaks&&!timingWarnings.length&&courseMetrics.wape!==null&&courseMetrics.wape<=VALIDATION_UPPER_TOLERANCE+1e-9&&sectionMetrics.wape!==null&&sectionMetrics.wape<=VALIDATION_UPPER_TOLERANCE+1e-9&&courseMetrics.within25===courseMetrics.n&&sectionMetrics.within25===sectionMetrics.n;
 const within10=complete&&!leaks&&!timingWarnings.length&&courseMetrics.wape!==null&&courseMetrics.wape<=.1&&sectionMetrics.wape!==null&&sectionMetrics.wape<=.1&&courseMetrics.within10===courseMetrics.n&&sectionMetrics.within10===sectionMetrics.n;
 return {courses,sections,enrollment,enrollmentMetrics,courseMetrics,sectionMetrics,complete,leaks,within10,within20,within25,timingWarnings,conditional,omitted:v.omitted,basic:rows.filter(r=>r.provisional).length,history:rows.filter(r=>r.reference.length).length,predictedSections:rows.reduce((n,r)=>n+(plan.overrides[r.key]?.sections??0),0),actualSections:actual.length,filename:v.filename};
}
export function validationCsv(plan:Plan){const v=validatePlan(plan);if(!v)return '';
 const convert=(r:Comparison,unit:string)=>[unit,r.code,r.name,r.section??'',r.predicted??'',r.actual??'',r.enrolled??'',r.error??'',r.ape===null?'':(100*r.ape).toFixed(2),r.actual===null?'실적 없음':r.predicted===null?'산출 없음':r.actual===0?r.predicted===0?'20% 이내':'기준 0명':r.ape!<=VALIDATION_TOLERANCE+1e-9?'20% 이내':r.ape!<=VALIDATION_UPPER_TOLERANCE+1e-9?'20% 초과·25% 이내':'25% 초과',r.basis,v.leaks?'동일학기 보정·예측검증 불가':v.timingWarnings.length?'학기 시작 후 정보·회고 비교':v.conditional?'사전조사 반영·회고 비교':'회고 비교',v.timingWarnings.join(' / ')];
 return csvText([['비교대상','과목코드','과목명','분반','산출인원','실제인원(비교기준)','실제수강인원','오차(명)','절대오차율(%)','판정','계산방식','검증방식','자료시점 확인'],...v.courses.map(r=>convert(r,'과목정원')),...v.sections.map(r=>convert(r,'분반정원')),...v.enrollment.map(r=>convert(r,'과목수강인원'))]);}
