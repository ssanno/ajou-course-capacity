'use client';
import {Button} from '@/components/ui/button';
import {Table,TableBody,TableCell,TableHead,TableHeader,TableRow} from '@/components/ui/table';
import {type Plan} from '@/lib/model';
import {validatePlan,validationCsv,type Comparison} from '@/lib/validation';
import {download} from './import-panel';
const pct=(v:number|null)=>v===null?'—':`${(v*100).toFixed(1)}%`;
export default function ValidationPanel({plan,onChange,onUpload}:{plan:Plan,onChange:(p:Plan)=>void,onUpload:()=>void}){
 const v=validatePlan(plan);
 function table(rows:Comparison[],section=false,enrollment=false){return <div className="validation-table"><Table><TableHeader><TableRow><TableHead>과목{section?' · 분반':''}</TableHead><TableHead>산출</TableHead><TableHead>{enrollment?'실제 수강':'실제 정원'}</TableHead><TableHead>오차</TableHead><TableHead>오차율</TableHead></TableRow></TableHeader><TableBody>{rows.map((r,i)=><TableRow key={i}><TableCell>{r.name}{section?` · ${r.section}분반`:''}<small className="course-subtitle">{r.code} · {r.basis}</small></TableCell><TableCell>{r.predicted??'—'}</TableCell><TableCell>{r.actual??'—'}</TableCell><TableCell>{r.error===null?'비교 불가':`${r.error>0?'+':''}${r.error}`}</TableCell><TableCell>{pct(r.ape)}</TableCell></TableRow>)}</TableBody></Table></div>;}
 return <details className="quiet-details validation-panel"><summary>성능 검증{v?` · ${v.leaks?'예측검증 불가':v.timingWarnings.length?'회고 비교':v.within20?'이번 비교 20% 범위':v.within25?'이번 비교 25% 범위':v.complete?'목표 미달':'부분 비교'}`:''}</summary>
 <p>실제 정원 파일을 올리면 현재 산출값과 비교합니다. 비교자료로 예측값을 바꾸지 않습니다.</p><div className="validation-actions"><Button variant="outline" onClick={onUpload}>{v?'검증자료 교체':'실제 정원 파일로 비교'}</Button>{v&&<><Button variant="outline" onClick={()=>download(validationCsv(plan),`${plan.name}_${plan.planningYear}-${plan.planningSemester}_성능검증.csv`)}>비교표 다운로드</Button><Button variant="ghost" onClick={()=>onChange({...plan,validation:undefined})}>검증자료 지우기</Button></>}</div>
 {v&&<><p className="note">{v.filename} · 선택수요 추정 {v.basic}과목 · 검증용 과목별 실적은 산출에 미사용 · 선택 수요에는 이전 연도 학년별 평균 학점·과목 선택 비중 적용</p>
 {v.leaks&&<p className="message error">실제 결과를 계산에 사용한 항목이 있어 예측 성능으로 인정하지 않습니다.</p>}
 {v.timingWarnings.map((w,i)=><p className="import-warning" key={i}>{w}</p>)}{v.conditional>0&&<p className="note">사전조사 수요를 직접 반영한 {v.conditional}과목이 포함됩니다. 교육과정만 사용하는 자동추정 성능과 구분하세요.</p>}<div className="validation-metrics"><div><span>과목 총정원 오차 WAPE</span><strong>{pct(v.courseMetrics.wape)}</strong></div><div><span>과목별 20% 이내</span><strong>{v.courseMetrics.within20} / {v.courseMetrics.n}</strong></div><div><span>분반번호 일치 비교</span><strong>{v.sectionMetrics.n} / {v.predictedSections}</strong></div></div>
 <p className="note">25% 이내: 과목 {v.courseMetrics.within25}/{v.courseMetrics.n}개 · 분반 {v.sectionMetrics.within25}/{v.sectionMetrics.n}개. 전체 평균이 낮아도 개별 과목·분반의 목표 달성을 뜻하지 않습니다.</p><p>과목별 절대오차를 합산해 실제 정원 합계로 나눕니다. 과대·과소 산출을 상쇄하지 않습니다. 과목 평균 절대오차 {v.courseMetrics.mae?.toFixed(1)??'—'}명.</p>
 {!v.complete&&<p className="import-warning">전체 비교가 완료되지 않았습니다. 과목 미연결·분반번호 불일치·직접 제외 {v.omitted}과목을 확인하세요. 일부 항목의 오차만으로 전체 성능을 판단하지 않습니다.</p>}
 {table(v.courses)}<details className="quiet-details"><summary>분반별 비교 · WAPE {pct(v.sectionMetrics.wape)} · 20% 이내 {v.sectionMetrics.within20}/{v.sectionMetrics.n}</summary><p>같은 과목코드·분반번호만 연결합니다. 계획 {v.predictedSections}개, 실제 {v.actualSections}개 분반입니다.</p>{table(v.sections,true)}</details><details className="quiet-details"><summary>수강인원 비교 · WAPE {pct(v.enrollmentMetrics.wape)} · 20% 이내 {v.enrollmentMetrics.within20}/{v.enrollmentMetrics.n}</summary><p>과거 수강 비율로 추정한 예상 수강인원을 실제 수강인원과 비교합니다. 필수 이수 대상을 확보하는 권장정원 오차와는 별도 지표입니다. 실제 수강은 수강제한 영향을 받을 수 있습니다.</p>{table(v.enrollment,false,true)}</details>
 <p className="note">비교 기준: 25% 이내를 목표로 두고 20% 이내도 참고 지표로 함께 표시합니다. 범위 충족 판정은 과목·분반 WAPE와 각 항목 오차가 모두 기준 이내이고 전체 비교가 완료된 경우에만 적용합니다. 0명 정원은 비율을 계산하지 않고 인원 차이를 확인합니다. 실제 정원은 교수님의 운영 결정이며, 개별 허가를 포함한 수강인원과 다릅니다. 필수 수용 기준이 실제 정원보다 크면 임의로 낮추지 않습니다.</p><p className="note">이 화면은 회고 비교입니다. 결과를 보고 수정한 데이터는 독립 검증이 아니며, 다른 학과·새 학기의 자료로 추가 검증해야 합니다.</p></>}
 </details>;
}
