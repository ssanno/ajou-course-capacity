import {courseCatalogs,COURSE_CATALOG_VERSION} from './course-catalog-data';
import type {Plan,Course} from './model';

export {COURSE_CATALOG_VERSION};
const norm=(s:string)=>s.normalize('NFKC').replace(/[\s·ㆍ.,()\-/]/g,'').toLowerCase();
const category=(s:string)=>s==='전기'?'전공기초':s==='교필'?'교양필수':s;
export function historicalCourseCompatibility(p:Plan,c:Course,year:number,semester=c.semester){
 const metadata=p.curriculumSources?.[p.curriculumYear];
 const catalog=courseCatalogs.find(s=>s.majorCode===metadata?.majorCode&&s.type===metadata?.type&&s.year===year);
 // For other majors retain the declared current-grade assumption; never borrow another major's catalog.
 if(!catalog)return {usable:true,known:false,reason:''};
 const sameCode=catalog.courses.filter(r=>r.code===c.code);
 // A missing legacy code may be linked only through one exact normalized name.
 // If the code exists under another name, do not silently borrow a different code.
 const matches=(sameCode.length?sameCode:catalog.courses).filter(r=>norm(r.name)===norm(c.name));
 if(matches.length!==1)return {usable:false,known:true,reason:'당시 교육과정의 코드·과목명이 유일하게 연결되지 않음'};
 const row=matches[0],periods=row.periods.filter(t=>t.semester===semester);
 const grades=[...new Set((periods.length?periods:row.periods).map(t=>t.grade))];
 if(category(row.category)!==c.category)return {usable:false,known:true,reason:`학수구분 변경 (${row.category} → ${c.category})`};
 if(row.credits!==c.credits)return {usable:false,known:true,reason:`학점 변경 (${row.credits} → ${c.credits})`};
 if(grades.length!==1||grades[0]!==c.grade)return {usable:false,known:true,reason:`권장학년 변경·불명확 (${grades.join('·')||'미지정'} → ${c.grade}학년)`};
 return {usable:true,known:true,reason:''};
}
