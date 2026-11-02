import { csvText,type Plan,type Result } from './model';
import { allocatedSections,sectionIds,allocationBasis } from './planning';
import { reviewCourse } from './academic-policy';
export function capacityCsv(plan:Plan,rows:Result[]){
 return csvText([['학과','학년도','학기','과목코드','과목명','이수구분','분반','분반 기본 확보 권장정원','과목 전체 예상수강인원','모드','산출근거','확인사항','과목 전체 기본 확보 권장정원','입력한 분반당 수용한도','과목 전체 수용가능인원','과목 전체 부족정원','동일한도 기준 추가분반'],...rows.flatMap(r=>{
  const allocations=allocatedSections(plan,r),issues=[...r.flags,...reviewCourse(plan,r).issues.map(x=>x.text)].join(' / ');
  return sectionIds(plan,r.key).map((id,i)=>[plan.name,plan.planningYear,plan.planningSemester,r.course.code,r.course.name,r.course.category,id,allocations?.[i]??'확인 필요',r.demand??'확인 필요',r.method,`${r.reason} / 정원: ${r.capacityReason} / ${allocationBasis(plan,r)}`,issues,r.capacity??'확인 필요',plan.overrides[r.key]?.limit??'',r.plannedCapacity??'',r.plannedCapacity===null||r.demand===null?'미확인':r.unmet,r.additionalSections??'']);
 })]);
}
