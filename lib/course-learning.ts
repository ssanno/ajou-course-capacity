import {courseObservations,observationTerms,COURSE_OBSERVATION_VERSION} from './course-observation-data';
import type {Plan,Course} from './model';
import {foundationObservations,FOUNDATION_VERSION} from './university-foundation';
import {historicalCourseCompatibility,COURSE_CATALOG_VERSION} from './course-compatibility';

export const LEARNING_RULES={season:true,preference:true,seasonPrior:1,preferencePrior:1,departmentProfile:true,requiredExpected:true} as const;
export type LearningRules={season:boolean,preference:boolean,seasonPrior:number,preferencePrior:number,departmentProfile?:boolean,requiredExpected?:boolean};
export const LEARNING_VERSION=FOUNDATION_VERSION+'+'+COURSE_OBSERVATION_VERSION+'+'+COURSE_CATALOG_VERSION;
export type CourseEvidence={year:number,semester:number,enrolled:number,cohort:number,basis:'enrolled'|'registrants',source:string,offered?:boolean,sourceRow?:number};
function eligible(p:Plan,c:Course){
 const major=p.curriculumSources?.[p.curriculumYear]?.majorCode,target=p.planningYear??p.targetYear;
 if(!major)return [];
 return courseObservations.filter(o=>o.majorCode===major&&o.code===c.code&&o.year<target&&o.grade===c.grade&&o.category===c.category&&o.credits===c.credits&&historicalCourseCompatibility(p,c,o.year,o.semester).usable);
}
export function courseLearningWarnings(p:Plan,c:Course){
 const excluded=foundationObservations(p,c)?.excluded??[];
 return [...new Set(excluded.map(e=>`${e.year}년 실적 제외: ${e.reason}`))];
}
function term(p:Plan,c:Course,year:number,semester:number){
 const major=p.curriculumSources?.[p.curriculumYear]?.majorCode;
 const t=observationTerms.find(t=>t.majorCode===major&&t.year===year&&t.semester===semester&&t.complete);
 const n=(p.studentCountBasis==='registrants'?t?.applicants:t?.counts)?.[c.grade-1];
 return t&&n!=null&&n>0?{source:t.source,n}:null;
}
export function coursePreference(p:Plan,c:Course){
 const full=foundationObservations(p,c);
 if(full){const evidence=full.observations.filter(o=>o.offered&&o.semester===c.semester);return {evidence,rates:evidence.map(e=>Math.min(1,e.enrolled/e.cohort))};}
 const evidence:CourseEvidence[]=[];
 for(const o of eligible(p,c).filter(o=>o.semester===c.semester)){
  const t=term(p,c,o.year,o.semester);if(!t)continue;
  evidence.push({year:o.year,semester:o.semester,enrolled:o.enrolled,cohort:t.n,basis:p.studentCountBasis??'enrolled',source:o.source});
 }
 // The declared own-grade assumption caps a historical course rate at one.
 return {evidence,rates:evidence.map(e=>Math.min(1,e.enrolled/e.cohort))};
}
export function courseSeason(p:Plan,c:Course,prior:number){
 const full=foundationObservations(p,c);
 if(full){
  const years=[...new Set(full.observations.map(o=>o.year))],sums=[0,0],used:number[]=[],evidence:CourseEvidence[]=[];
  for(const year of years){const terms=[1,2].map(s=>full.observations.find(o=>o.year===year&&o.semester===s));if(terms.some(t=>!t))continue;
   const rates=terms.map(t=>Math.min(1,t!.enrolled/t!.cohort));if(rates[0]+rates[1]===0)continue;
   sums[0]+=rates[0];sums[1]+=rates[1];used.push(year);evidence.push(...terms as CourseEvidence[]);
  }
  return used.length?{share:(sums[c.semester-1]+prior/2)/(sums[0]+sums[1]+prior),years:used,evidence}:null;
 }
 const all=eligible(p,c),years=[...new Set(all.map(o=>o.year))],sums=[0,0],used:number[]=[],evidence:CourseEvidence[]=[];
 for(const year of years){
  const terms=[term(p,c,year,1),term(p,c,year,2)];if(terms.some(t=>!t))continue;
  const own=all.filter(o=>o.year===year),rates=[1,2].map((s,i)=>Math.min(1,(own.find(o=>o.semester===s)?.enrolled??0)/terms[i]!.n));
  if(rates[0]+rates[1]===0)continue;
  used.push(year);for(let i=0;i<2;i++){sums[i]+=rates[i];const o=own.find(o=>o.semester===i+1);evidence.push({year,semester:i+1,enrolled:o?.enrolled??0,cohort:terms[i]!.n,basis:p.studentCountBasis??'enrolled',source:terms[i]!.source});}
 }
 if(!used.length)return null;
 const share=(sums[c.semester-1]+prior/2)/(sums[0]+sums[1]+prior);
 return {share,years:used,evidence};
}
