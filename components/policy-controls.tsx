'use client';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import { operationExceptions,policyKey,annualCreditReview,POLICY_SOURCE } from '@/lib/academic-policy';
import { isMarked } from '@/lib/official-offerings';
import type { Plan,Result } from '@/lib/model';

export default function PolicyControls({plan,rows,onChange}:{plan:Plan,rows:Result[],onChange:(p:Plan)=>void}){
 const key=policyKey(plan),input=plan.policyInputs?.[key]??{},annual=annualCreditReview(plan,rows);
 function setInput(part:Partial<typeof input>){onChange({...plan,policyInputs:{...plan.policyInputs,[key]:{...input,...part}}});}
 function override(id:string,part:Plan['overrides'][string]){onChange({...plan,overrides:{...plan.overrides,[id]:{...plan.overrides[id],...part}}});}
 return <details className="quiet-details policy-controls"><summary>개설 기준·예외 설정</summary> <div className="policy-input-grid"><label>연간 학점 기준 과정<NativeSelect value={annual.program} onChange={e=>setInput({program:e.target.value as 'general'|'deep'})}><option value="general">일반과정</option><option value="deep">심화과정</option></NativeSelect></label><label>직전 학년도 전공 평균 수강인원<Input aria-label="직전 학년도 전공 평균 수강인원" type="number" min={0} max={100000} step="any" value={input.previousAverage??''} placeholder="미입력" onChange={e=>{const n=Number(e.target.value);if(e.target.value==='')setInput({previousAverage:undefined});else if(n>=0&&n<=100000)setInput({previousAverage:n});}}/></label><label>같은 해 다른 학기 개설 학점<Input aria-label="같은 해 다른 학기 개설 학점" type="number" min={0} max={1000} step="any" value={input.otherSemesterCredits??''} placeholder="예외 승인 학점 제외 후 입력" onChange={e=>{const n=Number(e.target.value);if(e.target.value==='')setInput({otherSemesterCredits:undefined});else if(n>=0&&n<=1000)setInput({otherSemesterCredits:n});}}/></label></div>
 <p className="note">연간 한도는 일반 90·심화 100학점, 직전 학년도 평균 30명 이하 72학점·45명 이상 120학점입니다. 분반은 중복 집계하지 않으며, 같은 과목의 양 학기 개설은 각각 집계합니다. 다른 학기 미개설은 0으로 입력하세요.</p>
 {rows.map(r=>{const o=plan.overrides[r.key]??{},c=o.official?.course,creditEligible=!!c?.sections.every(s=>isMarked(s.exception)&&s.exceptionReason.trim());return <details className="policy-course-detail" key={r.key}><summary>{r.course.name}{c?' · 제출 내용·예외':' · 예외 설정'}</summary>
 <label>합반·폐강 예외<NativeSelect aria-label={`${r.course.name} 합반·폐강 예외`} value={o.operationException??''} onChange={e=>override(r.key,{operationException:e.target.value||undefined,operationExceptionNote:undefined})}><option value="">해당 없음</option>{Object.entries(operationExceptions).map(([k,v])=><option key={k} value={k}>{v}</option>)}</NativeSelect></label>
 {o.operationException&&<label>확인 근거<Input aria-label={`${r.course.name} 예외 확인 근거`} value={o.operationExceptionNote??''} maxLength={500} placeholder="해당 사실 또는 승인 문서" onChange={e=>override(r.key,{operationExceptionNote:e.target.value})}/></label>}
 {r.course.category==='전필'&&o.sections===1&&<p className="note">1개 강좌만 개설하는 전공필수는 제7조 제2항의 폐강 예외 대상입니다.</p>}
 {c&&<><p className="note">{o.official?.filename} · {o.official?.sheet} · {c.credits}학점 · {c.category}</p><div className="official-table-scroll"><Table><TableHeader><TableRow><TableHead>분반</TableHead><TableHead>담당교원</TableHead><TableHead>학점 제한 예외 사유</TableHead><TableHead>비고</TableHead></TableRow></TableHeader><TableBody>{c.sections.map(s=><TableRow key={s.section}><TableCell>{s.section}</TableCell><TableCell>{s.instructor||'미정'}<small className="course-subtitle">{s.instructorType}</small></TableCell><TableCell>{isMarked(s.exception)?s.exceptionReason||'사유 미입력':'—'}</TableCell><TableCell>{[isMarked(s.teamTeaching)?'윤강':'',isMarked(s.remote)?'원격수업':'',s.note].filter(Boolean).join(' · ')||'—'}</TableCell></TableRow>)}</TableBody></Table></div>
 {creditEligible&&<label className="policy-checkbox"><input type="checkbox" checked={o.creditExceptionConfirmed===true} onChange={e=>override(r.key,{creditExceptionConfirmed:e.target.checked})}/><span>교무팀 확인을 거쳐 이 과목을 연간 학점 제한에서 제외합니다.</span></label>}
 {c.sections.some(s=>isMarked(s.exception))&&<p className="note">양식의 예외 표시는 연간 개설 학점에 관한 항목입니다. 합반·폐강 예외로 자동 적용하지 않습니다.</p>}</>}
 </details>;})}<p className="note">적용 문서: {POLICY_SOURCE}</p></details>;
}
export function AnnualPolicyResult({plan,rows}:{plan:Plan,rows:Result[]}){
 const a=annualCreditReview(plan,rows);
 return <details className="quiet-details annual-policy"><summary>연간 개설 학점 검토 · {a.exceeded?'기준 초과':a.complete?'입력 범위 내 확인':'부분 집계'}</summary>
 <p>이번 학기 전공 {a.raw}학점 − 확인된 예외 {a.exceptionCredits}학점 = {a.current}학점{a.other!==undefined?` / 다른 학기 ${a.other}학점 / 연간 ${a.total}학점`:''}</p><p>적용 한도 {a.limit}학점 ({a.program==='deep'?'심화':'일반'}과정{a.average!==undefined?`, 직전 학년도 평균 ${a.average}명`:', 직전 학년도 평균 미입력 · 기본 한도 적용'})</p>
 {a.exceeded&&<p className="import-warning">개설 학점이 한도를 초과합니다. 과목 조정 또는 제5조의 예외 적용을 확인해주세요.</p>}
 {a.other===undefined&&<p>다른 학기 개설 학점이 없어 연간 한도 준수 여부를 확정할 수 없습니다.</p>}
 {a.omitted.length>0&&<p className="import-warning">정원 산출에서 제외한 {a.omitted.length}개 과목 ({a.omitted.map(c=>c.name).join(', ')})의 학점이 누락되어 연간 검토가 미완료입니다.</p>}
 {a.unknown>0&&<p>{a.unknown}개 과목의 전공·교양 구분을 이수구분으로 확인해야 학점 집계가 완료됩니다.</p>}
 <p className="note">현재 선택한 과목 기준입니다. 산출에서 제외한 개설 과목이 있다면 별도로 합산해야 합니다. 양 학기에 개설하는 동일 과목은 학기별로 한 번씩 계산합니다.</p>
 <p className="note">적용 문서: {POLICY_SOURCE}. 2026-2학기 공문을 반영했으며 이후 학기의 변경 기준은 새 공문 확인이 필요합니다.</p>
 <p className="note">반편성 운영 기준·시간표·강의실·P/F 성적 유형, 1학년 Co-BSM 시간 중복, 외국인 한국어 시간 블록, 수업계획서·CQI 입력 및 연속 미개설·폐강 제한은 이 양식만으로 확인할 수 없어 별도 검토합니다 (제3·8·9조 및 공문).</p></details>;
}
