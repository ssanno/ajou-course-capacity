import {universityCourses,universityPopulations,UNIVERSITY_FOUNDATION_VERSION} from './university-foundation-data';
import type {Plan,Course} from './model';
import {historicalCourseCompatibility} from './course-compatibility';
const norm=(s:string)=>s.normalize('NFKC').replace(/[\s·ㆍ.,()\-]/g,'').toLowerCase();
const majorNorm=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
const category=(s:string)=>s==='전기'?'전공기초':s==='교필'?'교양필수':s;
export const FOUNDATION_VERSION=UNIVERSITY_FOUNDATION_VERSION;
export function foundationMajor(p:Plan){
 const name=p.curriculumSources?.[p.curriculumYear]?.majorName??p.name;
 const rows=universityCourses.filter(r=>majorNorm(r.major)===majorNorm(name));
 const departments=[...new Set(rows.map(r=>r.department).filter(Boolean))];
 return rows.length&&departments.length===1?{name:rows[0].major,department:departments[0],rows}:null;
}
export function foundationCourse(p:Plan,c:Course){
 const major=foundationMajor(p);if(!major)return null;
 const matches=major.rows.filter(r=>norm(r.name)===norm(c.name));
 if(matches.length!==1||matches[0].ambiguous||category(matches[0].category)!==c.category)return null;
 return {major,course:matches[0]};
}
export function foundationTerm(department:string,year:number,semester:number,grade:number,basis:'enrolled'|'registrants'){
 const t=universityPopulations.find(t=>t.department===department&&t.year===year&&t.semester===semester);
 const n=(basis==='registrants'?t?.applicants:t?.counts)?.[grade-1];
 return t&&n!=null&&n>0?{n,population:t}:null;
}
export function foundationObservations(p:Plan,c:Course){
 const found=foundationCourse(p,c);if(!found)return null;
 const target=p.planningYear??p.targetYear,basis=p.studentCountBasis??'enrolled';
 const observations=[],excluded:{year:number,semester:number,reason:string}[]=[];
 for(let j=0;j<found.course.terms.length;j++){
  const year=2024+Math.floor(j/2),semester=1+j%2;if(year>=target)continue;
  const [sections,enrolled]=found.course.terms[j],compatibility=historicalCourseCompatibility(p,c,year,semester);
  if(!compatibility.usable){if(sections>0)excluded.push({year,semester,reason:compatibility.reason});continue;}
  const t=foundationTerm(found.major.department,year,semester,c.grade,basis);
  if(!t)continue;
  observations.push({year,semester,enrolled,cohort:t.n,basis,source:'과목별 수강인원 현황(2024~2026).xls',sourceRow:found.course.row,offered:sections>0});
 }
 // Returned even when empty: do not replace an explicit non-offering with older data.
 return {major:found.major,observations,excluded};
}
export function foundationProfile(p:Plan,grade:number,semester:number){
 const major=foundationMajor(p);if(!major)return null;
 const target=p.planningYear??p.targetYear,basis=p.studentCountBasis??'enrolled';
 const terms=universityPopulations.filter(t=>t.department===major.department&&t.year<target&&t.semester===semester&&t.credits[grade-1]!==null);
 const selected=terms.map(t=>({t,n:(basis==='registrants'?t.applicants:t.counts)?.[grade-1]??0})).filter(r=>r.n>0);
 const students=selected.reduce((s,r)=>s+r.n,0);if(!students)return null;
 return {version:FOUNDATION_VERSION,years:selected.map(r=>r.t.year),semester,grade,students,basis,departmentTerms:selected.length,department:major.department,
  electiveCredits:selected.reduce((s,r)=>s+r.t.credits[grade-1]!.majorElective,0)/students,
  requiredCredits:selected.reduce((s,r)=>s+r.t.credits[grade-1]!.majorRequired,0)/students,
  totalCredits:selected.reduce((s,r)=>s+r.t.credits[grade-1]!.total,0)/students};
}
