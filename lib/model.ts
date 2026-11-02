import { z } from 'zod';
import { registrationProfile } from './registration-profile';
import {courseSeason,coursePreference,courseLearningWarnings,LEARNING_RULES,type LearningRules,type CourseEvidence} from './course-learning';
import {foundationProfile} from './university-foundation';

const count = z.number().int().min(0).max(100000);
const year = z.number().int().min(2000).max(2100);
const code = z.string().trim().min(1).max(80);
export const categorySchema=z.enum(['전필','전선','전공기초','교양필수']);
export const courseSchema = z.object({code, name:z.string().trim().min(1).max(160), year, grade:z.number().int().min(1).max(6), semester:z.number().int().min(1).max(2), category:categorySchema, credits:z.number().min(0).max(30), share:z.number().min(0).max(1).default(1), recommendedSemesters:z.array(z.union([z.literal(1),z.literal(2)])).min(1).max(2).optional(),shareMode:z.enum(['manual','history','curriculum']).optional(),note:z.string().max(1000).default('')});
export const historySchema = z.object({code,name:z.string().max(160),year,semester:z.number().int().min(1).max(2),section:z.string().min(1).max(40),capacity:count,enrolled:count,pre:count.optional(),vacancy:z.number().int().min(-100000).max(100000).optional(),category:categorySchema.optional(),sourceCode:z.string().max(80).optional(),grade:z.number().int().min(1).max(6).optional()});
export const officialSectionSchema=z.object({row:z.number().int().min(1),section:z.string().min(1).max(40),instructorType:z.string().max(160),instructor:z.string().max(160),process:z.string().max(160),exception:z.string().max(160),exceptionReason:z.string().max(1000),teamTeaching:z.string().max(160),remote:z.string().max(160),note:z.string().max(1000),hours:z.number().min(0).max(100).optional()});
export const officialCourseSchema=z.object({major:z.string().max(160),code,name:z.string().max(160),category:z.string().max(80),credits:z.number().min(0).max(30),sections:z.array(officialSectionSchema).min(1).max(100)});
export type OfficialCourse=z.infer<typeof officialCourseSchema>;
export const offeringMetaSchema=z.object({sourceYear:year.optional(),sourceSemester:z.number().int().min(1).max(2).optional(),periodConfirmed:z.boolean().optional(),year,semester:z.number().int().min(1).max(2),filename:z.string().max(240),sheet:z.string().max(160),importedAt:z.string().datetime(),course:officialCourseSchema});
export const classTypeSchema=z.enum(['majorTheory','majorLab','majorDesign','majorConversation','generalEnglish','generalWriting','generalComputer','generalComputerTheory','generalBSM','generalTheory','generalLab']);
export const policyInputSchema=z.object({program:z.enum(['general','deep']).optional(),previousAverage:z.number().min(0).max(100000).optional(),otherSemesterCredits:z.number().min(0).max(1000).optional()});
export const demandInputSchema=z.object({year,semester:z.union([z.literal(1),z.literal(2)]),total:count,observedOn:z.string().date(),note:z.string().trim().min(1).max(500)});
export const headcountSourceSchema=z.object({filename:z.string().max(240),asOfMonth:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),population:z.enum(['재학생','재적생']),counts:z.array(count.nullable()).min(2).max(6)});
export const planSchema = z.object({id:z.string().regex(/^[a-zA-Z0-9-]{1,80}$/),name:z.string().trim().min(1).max(80),baseYear:year,targetYear:year,curriculumYear:year,intake:count,cohorts:z.array(count).min(2).max(6),rounding:z.number().int().min(1).max(100),defaultLimit:z.number().int().min(1).max(1000),tolerance:z.number().int().min(0).max(20),curriculum:z.array(courseSchema).max(3000),history:z.array(historySchema).max(15000),overrides:z.record(z.object({adjustment:z.number().int().min(-10000).max(10000).optional(),limit:z.number().int().min(1).max(1000).optional(),sections:z.number().int().min(1).max(100).optional(),participation:z.number().min(0).max(1).optional(),demandInput:demandInputSchema.optional(),finalTermCount:count.optional(),finalTermYear:year.optional(),categoryOverride:categorySchema.optional(),enabled:z.boolean().optional(),sectionIds:z.array(z.string().min(1).max(40)).max(100).optional(),official:offeringMetaSchema.optional(),classType:classTypeSchema.optional(),creditExceptionConfirmed:z.boolean().optional(),operationException:z.string().max(80).optional(),operationExceptionNote:z.string().max(500).optional()})).default({}),historyStrategy:z.enum(['latest','multiYear']).optional(),completionPolicies:z.record(z.object({regularSemester:z.union([z.literal(1),z.literal(2)]),once:z.literal(true)})).optional(),forecastMode:z.enum(['forecast','calibration']).optional(),historyCohorts:z.record(z.array(count.nullable()).min(2).max(6)).optional(),headcountSources:z.record(headcountSourceSchema).optional(),historySources:z.record(z.object({filename:z.string().max(240),importedAt:z.string().datetime()})).optional(),validation:z.object({year,semester:z.union([z.literal(1),z.literal(2)]),filename:z.string().max(240),importedAt:z.string().datetime(),actuals:z.array(historySchema).max(15000),omitted:count.default(0)}).optional(),policyInputs:z.record(policyInputSchema).optional(),offeringImportNotes:z.record(z.object({filename:z.string().max(240),omitted:z.array(z.object({code:z.string().max(80),name:z.string().max(160),credits:z.number().min(0).max(30)})).max(3000)})).optional(),version:count.default(0),workflowVersion:z.literal(2).optional(),studentCountBasis:z.enum(['enrolled','registrants']).optional(),studentCounts:z.array(count.nullable()).min(2).max(6).optional(),planningYear:year.optional(),planningSemester:z.union([z.literal(1),z.literal(2)]).optional(),leaveCounts:z.array(count).min(2).max(6).optional(),curriculumSources:z.record(z.object({url:z.literal("https://mhaksa.ajou.ac.kr:30443/public.html#!/e020404"),year,type:z.enum(["general","abeek","deep"]),majorCode:code,majorName:z.string().max(160),fetchedAt:z.string().datetime(),rawCount:count,importedCount:count,locallyEdited:z.boolean().default(false),pending:z.array(z.object({code:z.string().max(80),name:z.string().max(160),reason:z.string().max(500)})).max(3000).default([])})).optional()}).superRefine((p,ctx)=>{
 if(p.targetYear!==p.baseYear+1)ctx.addIssue({code:'custom',message:'예측연도는 기준연도의 다음 해여야 합니다.'});
 const seen=new Set<string>();
 for(const c of p.curriculum){const k=c.year+':'+c.code+':'+c.semester;if(seen.has(k))ctx.addIssue({code:'custom',message:'교육과정 중복: '+c.name});seen.add(k);if(c.grade>p.cohorts.length)ctx.addIssue({code:'custom',message:'학년 인원이 없는 과목: '+c.name});}
 const hs=new Set<string>();for(const h of p.history){const k=[h.year,h.semester,h.code,h.section].join(':');if(hs.has(k))ctx.addIssue({code:'custom',message:'개설실적 중복: '+h.code});hs.add(k);}
 if(p.validation){const vs=new Set<string>();for(const h of p.validation.actuals){const k=h.code+':'+h.section;if(vs.has(k))ctx.addIssue({code:'custom',message:'검증자료 분반 중복: '+h.code});vs.add(k);if(h.year!==p.validation.year||h.semester!==p.validation.semester)ctx.addIssue({code:'custom',message:'검증자료의 학기가 일치하지 않습니다.'});}}
 const shares=new Map<string,number>();for(const c of p.curriculum){const k=c.year+':'+c.code;shares.set(k,(shares.get(k)||0)+c.share);}for(const [k,n] of shares)if(n>1.00001)ctx.addIssue({code:'custom',message:k+'의 학기별 이수비중 합계가 100%를 넘습니다.'});
});
export type Plan=z.infer<typeof planSchema>;
export type Course=z.infer<typeof courseSchema>;
export type History=z.infer<typeof historySchema>;
export const rowKey=(c:Course)=>`${c.year}:${c.code}:${c.semester}`;
export const excluded=(name:string)=>/현장실습|인턴십|인턴쉽|internship/i.test(name);
export const isRequired=(c:Course)=>c.category!=='전선';
// The curriculum's recommended periods describe the regular cohort. Additional
// offerings do not make the whole cohort repeat a requirement in both semesters.
export const completionPolicy=(p:Plan,c:Course)=>p.completionPolicies?.[`${c.year}:${c.code}`];
export const finalTermCount=(p:Plan,c:Course)=>{const o=p.overrides[rowKey(c)];return o?.finalTermYear===(p.planningYear??p.targetYear)?o.finalTermCount:undefined;};
export function courseShare(p:Plan,c:Course,rules:LearningRules=LEARNING_RULES){
 const graduation=completionPolicy(p,c);if(graduation)return {share:c.semester===graduation.regularSemester?1:0,supplemental:c.semester!==graduation.regularSemester,reason:`졸업 마지막학기 1회 이수 · ${graduation.regularSemester}학기 정규 개설, 다른 학기는 졸업예정자 보충 개설. 고정 학기별 비중을 사용하지 않습니다.`};
 const periods=c.recommendedSemesters??[c.semester];
 if(!periods.includes(c.semester))return {share:0,supplemental:true,reason:'교육과정 권장학기 외 보충 개설: 학년 전원 수용 기준을 반복 적용하지 않습니다.'};
 if(c.shareMode!=='history'&&c.shareMode!=='curriculum')return {share:c.share,supplemental:false,reason:''};
 const observed=rules.season&&periods.length===2?courseSeason(p,c,rules.seasonPrior):null;
 if(observed)return {share:observed.share,supplemental:false,reason:`${observed.years.join('·')}년 같은 과목·권장학년의 수강실적을 당시 학년 인원으로 나누어 학기별 비중을 추정했습니다. 자료가 적을 때는 균등 배분도 함께 참고하며 다른 학년 수요를 가산하지 않습니다.`};
 return {share:1/periods.length,supplemental:false,reason:'교육과정의 권장학기에 균등 배분합니다. 학기 이수비중에는 과거 과목별 수강실적을 사용하지 않으며, 직접 입력한 이수비중이 있으면 우선합니다.'};
}
export type Result={course:Course,key:string,cohort:number,baseCohort:number,demand:number|null,baseDemand:number|null,capacity:number|null,sections:number|null,perSection:number|null,unmet:number,limit:number,plannedCapacity:number|null,additionalSections:number|null,coefficient:number|null,method:string,reason:string,reference:History[],oldCapacity:number|null,oldSections:number|null,delta:number|null,flags:string[],enabled:boolean,requiredFloor?:number,capacityReason?:string,calibration?:boolean,provisional?:boolean,conditional?:boolean,needsDemandConfirmation?:boolean,learningEvidence?:CourseEvidence[]};

// Fallback assumptions. When available, prior-year university registration aggregates
// supply a shared elective budget; target-term validation/history remain isolated.
export const CURRICULUM_ASSUMPTIONS={semesterCredits:19.3,electiveCompletion:1,electiveCreditsByGrade:[6,6,7.5,4.5],zeroCreditParticipation:.5,majorCredits:12,seniorSecondMajorCredits:6,generalCredits:6,standardLimit:19,extendedLimit:22,extendedShare:.1} as const;
export const electiveCreditCeiling=(grade:number)=>CURRICULUM_ASSUMPTIONS.electiveCreditsByGrade[Math.min(3,Math.max(0,grade-1))];
const fmt=(n:number)=>Number(n.toFixed(2)).toString();
const currentEvidence=(p:Plan,c:Course)=>{
 const e=p.overrides[rowKey(c)]?.demandInput;
 return e?.year===(p.planningYear??p.targetYear)&&e.semester===c.semester?e:undefined;
};
const courseFloor=(p:Plan,c:Course,rules:LearningRules=LEARNING_RULES)=>{
 const n=(p.studentCounts??p.cohorts)[c.grade-1]??0;
 if(!isRequired(c))return 0;
 const graduation=completionPolicy(p,c),explicit=finalTermCount(p,c);
 if(graduation&&explicit!==undefined)return explicit;
 const share=courseShare(p,c,rules).share;
 // Allocate the annual rounding remainder to semester two.
 const first=p.curriculum.find(x=>x.year===c.year&&x.code===c.code&&x.semester===1);
 if(c.semester===2&&first&&first.grade===c.grade&&share<1&&Math.abs(courseShare(p,first,rules).share+share-1)<1e-9)return Math.max(0,n-Math.ceil(n*courseShare(p,first,rules).share-1e-9));
 return Math.max(0,Math.ceil(n*share-1e-9));
};
export function planningRegistrationProfile(p:Plan,grade:number,semester:number,rules:LearningRules=LEARNING_RULES){
 const own=rules.departmentProfile?foundationProfile(p,grade,semester):null;
 const hasElectives=p.curriculum.some(c=>c.year===p.curriculumYear&&c.grade===grade&&c.semester===semester&&(p.overrides[rowKey(c)]?.categoryOverride??c.category)==='전선'&&p.overrides[rowKey(c)]?.enabled);
 if(own&&(own.electiveCredits>0||!hasElectives))return {...own,scope:'department' as const};
 const common=registrationProfile(p.planningYear??p.targetYear,semester,grade,p.studentCountBasis);
 return common?({...common,scope:'university'} as NonNullable<typeof common>&{scope:'university',department?:string}):null;
}
export function appliedRegistrationProfiles(p:Plan){return Array.from({length:p.cohorts.length},(_,i)=>planningRegistrationProfile(p,i+1,p.planningSemester??1)).filter(x=>x!==null);}
export function curriculumBudget(p:Plan,courses:Course[],grade:number,semester:number,rules:LearningRules=LEARNING_RULES){
 const pool=courses.filter(c=>c.grade===grade&&c.semester===semester),planned=pool.filter(c=>p.overrides[rowKey(c)]?.enabled===true);
 const major=(c:Course)=>c.category!=='교양필수';
 const load=(c:Course)=>c.credits*courseShare(p,c,rules).share;
 const requiredCurriculum=pool.filter(c=>major(c)&&isRequired(c)).reduce((n,c)=>n+load(c),0);
 const electiveCurriculum=pool.filter(c=>!isRequired(c)).reduce((n,c)=>n+load(c),0);
 const required=planned.filter(c=>major(c)&&isRequired(c)),electives=planned.filter(c=>!isRequired(c));
 const generalCredits=planned.filter(c=>!major(c)).reduce((n,c)=>n+load(c),0);
 const cohort=(p.studentCounts??p.cohorts)[grade-1]??0;
 const requiredCredits=required.reduce((n,c)=>n+(cohort>0?courseFloor(p,c,rules)/cohort*c.credits:load(c)),0);
 const totalCeiling=Math.max(0,CURRICULUM_ASSUMPTIONS.semesterCredits-generalCredits);
 const profile=planningRegistrationProfile(p,grade,semester,rules);
 const electiveCeiling=profile?.electiveCredits??(grade===4&&semester===2?CURRICULUM_ASSUMPTIONS.seniorSecondMajorCredits:CURRICULUM_ASSUMPTIONS.majorCredits);
 // Observed elective credits already exclude compulsory credits. Do not subtract them twice.
 const majorCredits=Math.min(totalCeiling,profile?requiredCredits+electiveCeiling:electiveCeiling);
 const fixed=electives.filter(c=>currentEvidence(p,c)||p.overrides[rowKey(c)]?.participation!==undefined);
 const fixedCredits=fixed.reduce((n,c)=>{
  const e=currentEvidence(p,c),o=p.overrides[rowKey(c)],rate=e?(cohort>0?e.total/cohort:0):(o.participation??0)*courseShare(p,c,rules).share;
  return n+Math.max(0,rate)*c.credits;
 },0);
 const automatic=electives.filter(c=>!fixed.includes(c));
 const offeredElectiveCredits=automatic.reduce((n,c)=>n+load(c),0);
 const remainingCredits=Math.max(0,majorCredits-requiredCredits-fixedCredits);
 const participation=offeredElectiveCredits>0?Math.min(1,remainingCredits/offeredElectiveCredits):CURRICULUM_ASSUMPTIONS.electiveCompletion;
 const preference=new Map<string,{coefficient:number,evidence:CourseEvidence[]}>();
 for(const c of automatic){
  const share=courseShare(p,c,rules).share,prior=share*participation,observed=rules.preference&&c.credits>0?coursePreference(p,c):{rates:[],evidence:[]};
  const value=observed.rates.length?(observed.rates.reduce((s,n)=>s+n,0)+rules.preferencePrior*prior)/(observed.rates.length+rules.preferencePrior):prior;
  preference.set(rowKey(c),{coefficient:Math.min(share,Math.max(0,value)),evidence:observed.evidence});
 }
 const estimatedCredits=automatic.reduce((n,c)=>n+c.credits*(preference.get(rowKey(c))?.coefficient??0),0);
 const factor=estimatedCredits>remainingCredits&&estimatedCredits>0?remainingCredits/estimatedCredits:1;
 for(const v of preference.values())v.coefficient*=factor;
 return {profile,preference,estimatedCredits:estimatedCredits*factor,requiredCount:required.length,electiveCount:electives.length,requiredCurriculum,electiveCurriculum,electiveCeiling,generalCredits,majorCredits,requiredCredits,fixedCredits,remainingCredits,offeredElectiveCredits,participation};
}

export function forecast(p:Plan):Result[]{return forecastWithRules(p,LEARNING_RULES);}
export function forecastWithRules(p:Plan,rules:LearningRules):Result[]{
 const counts=p.studentCounts??p.cohorts;
 const courses=p.curriculum.filter(c=>c.year===p.curriculumYear&&!excluded(c.name)).map(c=>({...c,category:p.overrides[rowKey(c)]?.categoryOverride??c.category}));
 const budgets=new Map<string,ReturnType<typeof curriculumBudget>>();
 for(const c of courses){const k=`${c.grade}:${c.semester}`;if(!budgets.has(k))budgets.set(k,curriculumBudget(p,courses,c.grade,c.semester,rules));}
 return courses.map(c=>{
  const key=rowKey(c),o=p.overrides[key]??{},cohort=counts[c.grade-1]??0,share=courseShare(p,c,rules),required=isRequired(c);
  const budget=budgets.get(`${c.grade}:${c.semester}`)!,evidence=currentEvidence(p,c),graduation=completionPolicy(p,c);
  const flags:string[]=courseLearningWarnings(p,c),requiredFloor=courseFloor(p,c,rules),preference=budget.preference.get(key);
  const rate=c.credits===0?CURRICULUM_ASSUMPTIONS.zeroCreditParticipation:preference&&share.share>0?preference.coefficient/share.share:budget.participation;
  const requiredPreference=required&&rules.requiredExpected?coursePreference(p,c):{rates:[],evidence:[]};
  const requiredCoefficient=requiredPreference.rates.length?Math.min(share.share,(requiredPreference.rates.reduce((s,n)=>s+n,0)+rules.preferencePrior*share.share)/(requiredPreference.rates.length+rules.preferencePrior)):share.share;
  let demand:number|null=required?Math.min(requiredFloor,Math.max(0,Math.ceil(cohort*requiredCoefficient-1e-9))):Math.max(0,Math.ceil(cohort*share.share*rate-1e-9));
  let coefficient:number|null=required?requiredCoefficient:share.share*rate;
  let method=required?'교육과정 필수 수용':budget.profile?'학년·학기 수강학점 추정':'교육과정·개설구성 추정';
  let reason=required?`${c.grade}학년 ${cohort}명 × 과거 수강 비율을 반영한 계수 ${fmt(requiredCoefficient*100)}% → 예상 ${demand}명. 필수 이수 대상 ${requiredFloor}명은 기본 확보 기준으로 유지합니다.`:
   `${c.grade}학년 ${cohort}명 × 학기 이수비중 ${fmt(share.share*100)}% × 선택 배분율 ${fmt(rate*100)}%. ${budget.profile?`${budget.profile.years.join('·')}년 ${c.semester}학기 ${budget.profile.department??'전 학과'} 연결자료의 ${budget.profile.basis==='registrants'?'수강신청자':'재학생'} 1인당 전공선택 ${fmt(budget.profile.electiveCredits)}학점`:`자료 없음: 기본 전공 ${fmt(budget.majorCredits)}학점에서 필수 ${fmt(budget.requiredCredits)}학점 차감`}. 학기 상한·필수 수용 및 직접 반영한 선택 ${fmt(budget.fixedCredits)}학점을 고려한 선택 여력 상한 ${fmt(budget.remainingCredits)}학점, 개설 선택 ${fmt(budget.offeredElectiveCredits)}학점, 배분한 예상 선택학점 ${fmt(budget.estimatedCredits)}학점 (과목별 수강비율 100% 이내)`;
  let provisional=!required;
  if(!required){
   flags.push('수강 상한 19학점 90%·22학점 10% → 평균 상한 19.3학점. 상한을 실제 수강량으로 간주하거나 남은 학점을 전공에 자동 추가하지 않습니다.');
   flags.push(budget.profile?`${budget.profile.department??'전 학과'}의 과거 전공선택 학점 합계 ÷ 같은 학년 ${budget.profile.basis==='registrants'?'수강신청자':'재학생'} 수 (${budget.profile.students}명·학기). 학년 미상·인원 미연결 행은 제외하며 과거 설정 정원에 맞추는 보정은 하지 않습니다. 필수학점을 선택 평균에서 다시 빼지 않습니다.`:'이전 연도 연결자료가 없어 전공 12학점·4학년 2학기 6학점의 잠정 가정을 사용합니다.');
   flags.push('모든 학생이 권장이수순서에 따라 자기 학년 과목만 수강한다고 가정합니다. 타학년·타학과의 추가 수요는 자동 가산하지 않습니다.');
   if(preference?.evidence.length){method='과거 선택비중·학점 범위 추정';reason+=` / ${[...new Set(preference.evidence.map(e=>e.year))].join('·')}년 해당 과목 실제 수강인원 ÷ 당시 같은 학년 인원으로 선택 비중을 추정하고 과거 선택 비중 ${fmt(preference.evidence.length/(preference.evidence.length+rules.preferencePrior)*100)}%와 기본 배분 ${fmt(rules.preferencePrior/(preference.evidence.length+rules.preferencePrior)*100)}%를 함께 반영했습니다. 선택 여력은 상한이며 과거 선택 비중이 낮으면 모두 소진하지 않습니다.`;}
   if(c.grade>4)flags.push('5·6학년은 일반 전공 12학점 기준을 잠정 적용합니다. 이번 7개 학과 검증에는 5·6학년 자료가 없습니다.');
   if(budget.requiredCredits+budget.fixedCredits>budget.majorCredits)flags.push('필수·직접 반영 수요가 가정한 전공 이수량을 넘습니다. 필수 수용 인원을 유지하고 자동 선택 배분 여력은 0으로 계산합니다.');
   if(c.credits===0)flags.push('0학점 선택과목은 학점 배분에서 제외하고 공통 선택 비율을 적용합니다.');
  }
  if(share.reason)flags.push(share.reason);
  if(graduation&&finalTermCount(p,c)!==undefined){demand=finalTermCount(p,c)!;method='졸업학기 대상 인원';reason=`입력한 이번 학기 이수 대상 ${demand}명`;}
  else if(graduation||share.supplemental)flags.push('권장학기 외·졸업학기 개설에는 과거 실적을 대용하지 않습니다. 권장 학기 밖 개설은 대상 인원을 확인해야 산출할 수 있습니다.');
  if(!required&&o.participation!==undefined){coefficient=o.participation*share.share;demand=Math.max(0,Math.ceil(cohort*coefficient-1e-9));provisional=false;method='입력 수강비율';reason=`${c.grade}학년 ${cohort}명 × 입력 비율 ${fmt(o.participation*100)}% × 학기 이수비중 ${fmt(share.share*100)}%`;}
  if(evidence){demand=evidence.total;provisional=false;method='사전조사 수요 반영';reason=`${evidence.observedOn} 확인한 과목 전체 수요 ${evidence.total}명 / ${evidence.note}`;if(requiredFloor>evidence.total)reason+=` / 필수 수용 기준 ${requiredFloor}명 확보`;}
  if(o.adjustment&&!evidence)demand=Math.max(0,demand+o.adjustment);
  const needsDemandConfirmation=share.supplemental&&!evidence&&!(graduation&&finalTermCount(p,c)!==undefined);
  if(needsDemandConfirmation){demand=null;coefficient=null;method='대상 인원 확인 필요';reason='권장 학기 밖 개설은 자동 추정할 수 없습니다. 3단계에서 이번 학기 전체 예상 수강인원·확인일·근거를 입력해주세요. 미확인은 수요 0명이 아닙니다.';provisional=false;}
  let capacity:number|null=demand===null?null:Math.max(requiredFloor,demand);
  const capacityReason=counts[c.grade-1]==null?'학년별 인원 확인 전에는 기본 확보 권장정원 산정을 보류합니다.':needsDemandConfirmation?'대상 인원 확인 전에는 필요정원·부족정원 산정을 보류합니다.':`기본 확보 권장정원은 예상 수강인원 ${demand}명과 필수 이수 대상 ${requiredFloor}명 중 큰 값입니다. 과거 설정 정원·교원 수·인기 변수는 사용하지 않습니다.`;
  if(counts[c.grade-1]==null){demand=null;capacity=null;reason=`2단계에서 ${c.grade}학년 재적생 수를 입력해주세요.`;}
  if(c.note)flags.push(c.note.replace('양학기 이수 인원은 교육과정 권장학기에 균등 배분합니다. 직접 입력한 비중이 있으면 우선합니다.','양학기 자동 배분은 이전 연도 수강 분포를 참고하며, 자료가 없을 때 균등 배분합니다. 직접 입력한 비중이 있으면 우선합니다.'));
  const sections=o.sections??null;
  // Only an explicitly entered operating limit is evidence of available seats.
  // Supply constraints never lower demand or the recommended required capacity.
  const plannedCapacity=sections&&o.limit!==undefined?sections*o.limit:null;
  const unmet=capacity!==null&&plannedCapacity!==null?Math.max(0,capacity-plannedCapacity):0;
  const additionalSections=capacity!==null&&plannedCapacity!==null?Math.max(0,Math.ceil(capacity/o.limit!)-sections!):null;
  const seasonalEvidence=rules.season&&!graduation&&!share.supplemental&&(c.recommendedSemesters?.length===2)&&(c.shareMode==='curriculum'||c.shareMode==='history')?(courseSeason(p,c,rules.seasonPrior)?.evidence??[]):[];
  const learningEvidence=[...new Map([...seasonalEvidence,...(preference?.evidence??[]),...requiredPreference.evidence].map(e=>[`${e.year}:${e.semester}:${e.source}`,e])).values()];
  return {course:c,key,cohort,baseCohort:0,demand,baseDemand:demand,capacity,sections,perSection:capacity!==null&&sections?Math.ceil(capacity/sections):null,unmet,limit:o.limit??p.defaultLimit,plannedCapacity,additionalSections,coefficient,method,reason,reference:[],oldCapacity:null,oldSections:null,delta:null,flags,enabled:o.enabled===true,requiredFloor,capacityReason,calibration:false,provisional,conditional:!!evidence,needsDemandConfirmation,learningEvidence};
 }).sort((a,b)=>a.course.semester-b.course.semester||a.course.grade-b.course.grade);
}

export function planningRisks(p:Plan,rows:Result[]){
 const term=rows.filter(r=>r.course.semester===p.planningSemester);
 return {
  missingRequired:term.filter(r=>!r.enabled&&r.course.category!=='교양필수'&&isRequired(r.course)&&(r.requiredFloor??0)>0&&r.demand!==null),
  shortfalls:term.filter(r=>r.enabled&&r.unmet>0),
  unchecked:term.filter(r=>r.enabled&&(r.plannedCapacity===null||r.demand===null)).length,
  needsDemand:term.filter(r=>r.enabled&&r.needsDemandConfirmation),
 };
}

export function emptyPlan(name:string,id:string):Plan {const current=new Date().getFullYear();return {id,name,baseYear:current,targetYear:current+1,curriculumYear:current,intake:0,cohorts:[0,0,0,0],rounding:1,defaultLimit:40,tolerance:0,curriculum:[],history:[],overrides:{},version:0,workflowVersion:2,studentCounts:[null,null,null,null]};}
export function csvText(rows:unknown[][]){return '\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v??'').replace(/^[=+@\-]/,"'$&").replaceAll('"','""')+'"').join(',')).join('\r\n');}
