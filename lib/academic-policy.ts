import { type Plan,type Result,type Course, rowKey } from './model';
import { allocatedSections } from './planning';
import { isMarked } from './official-offerings';

export const POLICY_SOURCE='교육과정 편성 및 수업 운영에 관한 기준 (2025.09.29. 개정), 교무팀-777 (2026.05.18.)';
export const classRules={
 majorTheory:{label:'전공 · 이론',min:40,max:60,splitMin:40,general:false},
 majorLab:{label:'전공 · 실험실습',min:20,max:20,splitMin:15,general:false},
 majorDesign:{label:'전공 · 설계',min:30,max:40,splitMin:25,general:false},
 majorConversation:{label:'전공 · 외국어회화',min:30,max:30,splitMin:25,general:false},
 generalEnglish:{label:'교양 · 영어',min:25,max:30,splitMin:25,general:true},
 generalWriting:{label:'교양 · 글쓰기',min:35,max:35,splitMin:30,general:true},
 generalComputer:{label:'교양 · 컴퓨터',min:40,max:40,splitMin:40,general:true},
 generalComputerTheory:{label:'교양 · 컴퓨터 이론',min:40,max:60,splitMin:40,general:true},
 generalBSM:{label:'교양 · BSM',min:40,max:60,splitMin:40,general:true},
 generalTheory:{label:'교양 · 이론',min:60,max:null,splitMin:50,general:true},
 generalLab:{label:'교양 · 실험실습·실기',min:20,max:30,splitMin:20,general:true},
} as const;
export type ClassType=keyof typeof classRules;
export const operationExceptions={teaching:'교직·군사학',hope:'아주희망',foreign:'외국인 학생만 수강하는 교양',smallBSM:'수용인원 20명 미만 BSM 실험',funded:'국고사업 개설',language:'어학졸업인증제 대체',challenge:'아주도전',medical:'의과대학 임상실습',nursing:'간호대학 임상실습',approved:'교무처장 인정'} as const;
export const policyKey=(p:Plan)=>`${p.planningYear}:${p.planningSemester}`;
export function ruleLabel(type:ClassType){const r=classRules[type];return `${r.min}${r.max===null?'명 이상':r.min===r.max?'명':`~${r.max}명`} · 분반 시 최소 ${r.splitMin}명`;}
export type PolicyIssue={code:string,text:string};
export function reviewCourse(p:Plan,row:Result){
 const o=p.overrides[row.key]??{},allocation=allocatedSections(p,row),issues:PolicyIssue[]=[];
 const add=(code:string,text:string)=>issues.push({code,text});
 const requiredSingle=row.course.category==='전필'&&allocation?.length===1;
 const selectedException=!!o.operationException&&o.operationException in operationExceptions&&!!o.operationExceptionNote?.trim();
 const except=requiredSingle||selectedException;
 // Capacity is a planning decision. Cancellation is assessed on actual enrolment,
 // so only flag a course whose forecast average is below the relevant threshold.
 const cancellation=row.course.category==='교양필수'?20:10;
 if(row.demand!==null&&allocation?.length&&row.demand/allocation.length<cancellation&&!except)add('cancellation',`분반당 평균 예상 수강인원이 ${cancellation}명 미만입니다. 실제 폐강 여부는 수강정정 마지막 날 15시 수강인원으로 판단합니다 (제7조).`);
 if(o.operationException&&!selectedException)add('exceptionReason','합반·폐강 예외의 확인 근거를 입력해주세요.');
 if(o.limit&&allocation?.some(n=>n>o.limit!))add('room',`입력한 분반당 한도 ${o.limit}명을 초과합니다.`);
 const official=o.official?.course;
 if(official){
  if(o.official?.year!==p.planningYear)add('sourceYear',`제출 양식은 ${o.official?.year}학년도 자료입니다. 이번 학기 개설 계획을 확인해주세요.`);
  if(official.code!==row.course.code)add('code',`제출 코드 ${official.code}를 교육과정 코드 ${row.course.code}에 직접 연결했습니다.`);
  if(official.credits!==row.course.credits)add('credits',`제출 ${official.credits}학점 / 교육과정 ${row.course.credits}학점: AIMS 반영을 확인해주세요.`);
  const cats:Record<string,string>={'전필':'전필','전선':'전선','전기':'전공기초','교필':'교양필수'};
  if(cats[official.category]!==row.course.category)add('category',`제출 구분 ${official.category} / 산출 구분 ${row.course.category}: 수요 산출에는 3단계에서 확인한 이수구분을 사용합니다.`);
  if(official.sections.some(s=>isMarked(s.exception)&&!s.exceptionReason))add('creditReason','양식에 예외 적용 O가 있으나 사유가 비어 있습니다.');
  if(official.sections.some(s=>isMarked(s.remote)))add('remote','원격수업 표시: 사전 심의 및 원격수업 운영계획서 제출을 확인해주세요 (제출 양식 주석).');
 }
 const previous=p.history.filter(h=>h.code===row.course.code&&h.year===(p.planningYear??p.targetYear)-1);
 const previousAverage=previous.length?previous.reduce((n,h)=>n+h.enrolled,0)/previous.length:null;
 return {issues,except,exceptionLabel:requiredSingle?'1개 강좌 전공필수 (제7조 제2항 제1호)':selectedException?operationExceptions[o.operationException as keyof typeof operationExceptions]:undefined,previousAverage,referenceCount:previous.length};
}
export function creditScope(p:Plan,c:Course):'major'|'general'|'unknown'{
 const category=p.overrides[rowKey(c)]?.categoryOverride??c.category;
 return ['전필','전선','전공기초'].includes(category)?'major':category==='교양필수'?'general':'unknown';
}

export function annualCreditReview(p:Plan,rows:Result[]){
 const input=p.policyInputs?.[policyKey(p)],source=p.curriculumSources?.[p.curriculumYear];
 const program=input?.program??(source?.type==='deep'?'deep':'general'),average=input?.previousAverage;
 const limit=average!==undefined&&average<=30?72:average!==undefined&&average>=45?120:program==='deep'?100:90;
 let raw=0,exceptionCredits=0,unknown=0;const seen=new Set<string>();
 for(const row of rows){if(!row.enabled||row.course.semester!==p.planningSemester)continue;const scope=creditScope(p,row.course);if(scope==='unknown'){unknown++;continue;}if(scope!=='major')continue;
  const o=p.overrides[row.key],c=o.official?.course,key=c?.code??row.course.code;if(seen.has(key))continue;seen.add(key);
  const credits=c?.credits??row.course.credits;raw+=credits;
  // Credit-limit exceptions are distinct from merge/cancellation exceptions. An O mark alone is not approval.
  if(o.creditExceptionConfirmed&&c?.sections.every(s=>isMarked(s.exception)&&s.exceptionReason.trim()))exceptionCredits+=credits;
 }
 const current=raw-exceptionCredits,other=input?.otherSemesterCredits,total=current+(other??0),omitted=p.offeringImportNotes?.[policyKey(p)]?.omitted??[];
 return {program,average,limit,raw,exceptionCredits,current,other,total,unknown,omitted,complete:other!==undefined&&unknown===0&&omitted.length===0,exceeded:total>limit};
}
