import { z } from 'zod';
import {LEARNING_RULES,LEARNING_VERSION} from './course-learning';
import { planSchema, forecast, planningRisks, appliedRegistrationProfiles, CURRICULUM_ASSUMPTIONS, csvText, type Plan } from './model';
import { allocatedSections, sectionIds } from './planning';
import { reviewCourse } from './academic-policy';

export const MODEL_VERSION = 'curriculum-v9-curriculum-compatible-history-2026-10-29';
const amount = z.number().int().min(0).max(10000000);
const rowSchema = z.object({
  key:z.string(),code:z.string(),name:z.string(),grade:z.number().int(),category:z.string(),
  demand:amount.nullable(),capacity:amount.nullable(),plannedCapacity:amount.nullable(),shortage:amount.nullable(),additionalSections:amount.nullable(),
  sections:z.array(z.object({id:z.string(),capacity:amount.nullable()})).max(100),reason:z.string(),flags:z.array(z.string()),
  learningEvidence:z.array(z.object({year:z.number(),semester:z.number(),enrolled:z.number(),cohort:z.number(),basis:z.enum(['enrolled','registrants']),source:z.string(),offered:z.boolean().optional(),sourceRow:z.number().optional()})).optional(),
});
export const predictionRecordSchema = z.object({
  format:z.literal('ajou-capacity-prediction'),schemaVersion:z.literal(1),
  id:z.string().uuid(),createdAt:z.string().datetime(),modelVersion:z.string().min(1).max(120),
  storage:z.enum(['server','demo-session','browser-local','local-file']),
  assumptions:z.object({semesterCredits:z.number(),electiveCompletion:z.number(),electiveCreditsByGrade:z.array(z.number()),zeroCreditParticipation:z.number(),majorCredits:z.number().optional(),seniorSecondMajorCredits:z.number().optional(),generalCredits:z.number().optional(),standardLimit:z.number().optional(),extendedLimit:z.number().optional(),extendedShare:z.number().optional()}),
  learningModel:z.object({version:z.string(),season:z.boolean(),preference:z.boolean(),seasonPrior:z.number(),preferencePrior:z.number(),departmentProfile:z.boolean().optional(),requiredExpected:z.boolean().optional(),ownGradeOnly:z.literal(true)}).optional(),
  registrationProfiles:z.array(z.object({version:z.string(),basis:z.enum(['enrolled','registrants']).optional(),scope:z.enum(['department','university']).optional(),department:z.string().optional(),years:z.array(z.number()),semester:z.number(),grade:z.number(),students:z.number(),departmentTerms:z.number(),electiveCredits:z.number(),requiredCredits:z.number(),totalCredits:z.number()})).optional(),
  input:planSchema,results:z.array(rowSchema).min(1).max(3000),
  missingRequired:z.array(z.object({key:z.string(),code:z.string(),name:z.string(),grade:z.number(),required:amount})).max(3000),
});
export type PredictionRecord=z.infer<typeof predictionRecordSchema>;
export type RecordSummary={id:string,createdAt:string,modelVersion:string,name:string,year:number,semester:number,courseCount:number,shortfallCourses:number,missingRequired:number};

// Validation labels and historical outcomes are never part of the forecast input archive.
export function predictionInput(raw:Plan):Plan {
  const p=planSchema.parse(raw);
  return planSchema.parse(JSON.parse(JSON.stringify({...p,history:[],validation:undefined,historySources:undefined,historyCohorts:undefined,headcountSources:undefined,historyStrategy:undefined,forecastMode:'forecast'})));
}
export function createPredictionRecord(raw:Plan,id:string,createdAt:string,storage:PredictionRecord['storage']):PredictionRecord {
  const input=predictionInput(raw),counts=input.studentCounts??input.cohorts;
  if(input.workflowVersion!==2||!input.planningYear||!input.planningSemester||counts.some(n=>n===null))throw Error('교육과정·학년별 인원·대상 학기·개설 과목을 모두 입력한 뒤 기록해주세요.');
  const rows=forecast(input),offered=rows.filter(r=>r.enabled&&r.course.semester===input.planningSemester);
  if(!offered.length||offered.some(r=>!input.overrides[r.key]?.sections))throw Error('개설 과목과 분반 수를 확인한 뒤 기록해주세요.');
  const risks=planningRisks(input,rows);
  return predictionRecordSchema.parse({format:'ajou-capacity-prediction',schemaVersion:1,id,createdAt,modelVersion:MODEL_VERSION,storage,assumptions:CURRICULUM_ASSUMPTIONS,learningModel:{version:LEARNING_VERSION,...LEARNING_RULES,ownGradeOnly:true},registrationProfiles:appliedRegistrationProfiles(input),input,
    results:offered.map(r=>({key:r.key,code:r.course.code,name:r.course.name,grade:r.course.grade,category:r.course.category,demand:r.demand,capacity:r.capacity,plannedCapacity:r.plannedCapacity,shortage:r.plannedCapacity===null||r.demand===null?null:r.unmet,additionalSections:r.additionalSections,
      sections:sectionIds(input,r.key).map((id,i)=>({id,capacity:allocatedSections(input,r)?.[i]??null})),
      reason:`${r.reason} / ${r.capacityReason}`,flags:[...r.flags,...reviewCourse(input,r).issues.map(x=>x.text)],learningEvidence:r.learningEvidence})),
    missingRequired:risks.missingRequired.map(r=>({key:r.key,code:r.course.code,name:r.course.name,grade:r.course.grade,required:r.requiredFloor??0})),
  });
}
export function recordSummary(r:PredictionRecord):RecordSummary {
  return {id:r.id,createdAt:r.createdAt,modelVersion:r.modelVersion,name:r.input.name,year:r.input.planningYear!,semester:r.input.planningSemester!,courseCount:r.results.length,shortfallCourses:r.results.filter(x=>(x.shortage??0)>0).length,missingRequired:r.missingRequired.length};
}
// Export the saved numbers directly. Never call forecast() while viewing or exporting a record.
export function predictionRecordCsv(r:PredictionRecord){
  return csvText([['기록ID','기록시각(UTC)','모델버전','저장구분','학과','학년도','학기','과목코드','과목명','분반','분반 기본 확보 권장정원','과목 전체 예상수요','과목 전체 기본 확보 권장정원','과목 전체 수용가능인원','과목 전체 부족정원','동일한도 기준 추가분반','산출근거','확인사항'],
    ...r.results.flatMap(c=>c.sections.map(s=>[r.id,r.createdAt,r.modelVersion,r.storage,r.input.name,r.input.planningYear,r.input.planningSemester,c.code,c.name,s.id,s.capacity??'확인 필요',c.demand??'확인 필요',c.capacity??'확인 필요',c.plannedCapacity??'미확인',c.shortage??'미확인',c.additionalSections??'미확인',c.reason,c.flags.join(' / ')])),
    ...r.missingRequired.map(c=>[r.id,r.createdAt,r.modelVersion,r.storage,r.input.name,r.input.planningYear,r.input.planningSemester,c.code,c.name,'미개설','',c.required,c.required,'미확인','미확인','미확인','교육과정상 이수 대상이 있는 필수·기초 과목','대체이수·학기 조정 확인 필요']),
  ]);
}
