'use client';
import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {NativeSelect} from '@/components/ui/native-select';
import {demandInputSchema,type Plan,type Result} from '@/lib/model';

export default function DemandContext({plan,rows,onChange}:{plan:Plan,rows:Result[],onChange:(p:Plan)=>void}){
 const [key,setKey]=useState(''),[total,setTotal]=useState(''),[date,setDate]=useState(''),[note,setNote]=useState(''),[error,setError]=useState('');
 const active=rows.filter(r=>{const x=plan.overrides[r.key]?.demandInput;return x&&x.year===plan.planningYear&&x.semester===plan.planningSemester;});
 function select(k:string){setKey(k);setError('');const v=plan.overrides[k]?.demandInput;if(v&&v.year===plan.planningYear&&v.semester===plan.planningSemester){setTotal(String(v.total));setDate(v.observedOn);setNote(v.note);}else{setTotal('');setDate('');setNote('');}}
 function apply(){if(!rows.some(r=>r.key===key)||total==='')return;const parsed=demandInputSchema.safeParse({year:plan.planningYear,semester:plan.planningSemester,total:Number(total),observedOn:date,note});if(!parsed.success){setError('전체 예상 인원, 확인일과 확인 내용을 입력해주세요.');return;}onChange({...plan,overrides:{...plan.overrides,[key]:{...plan.overrides[key],demandInput:parsed.data,participation:undefined,adjustment:undefined}}});select('');}
 return <details className="quiet-details"><summary>대상 인원 확인·사전조사 반영{rows.some(r=>r.needsDemandConfirmation)?' — 확인 필요 과목 있음':' (선택)'}</summary><p>권장 학기 밖 개설 또는 대체이수·추가 수요를 확인한 경우, 해당 과목의 전체 예상 수강인원을 입력하세요. 기존 실적에 더하지 않습니다. 교수님이 확정한 정원은 성능 검증자료로 사용하세요.</p>
 <div className="demand-context-form"><label>과목<NativeSelect value={key} onChange={e=>select(e.target.value)}><option value="">선택</option>{rows.map(r=><option value={r.key} key={r.key}>{r.course.name}{r.needsDemandConfirmation?' · 대상 인원 확인 필요':''}</option>)}</NativeSelect></label><label>전체 예상 수강인원<Input type="number" min={0} max={100000} value={total} onChange={e=>setTotal(e.target.value)} placeholder="명"/></label><label>조사·확인일<Input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label className="demand-context-note">확인 내용<Input value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="예: 대체이수 포함 학생회 조사, 약 100명"/></label></div>
 {error&&<p role="alert" className="message error">{error}</p>}<Button variant="outline" disabled={!key||total===''} onClick={apply}>조사 수요 반영</Button>
 {active.map(r=>{const e=plan.overrides[r.key].demandInput!;return <div className="demand-context-item" key={r.key}><div><strong>{r.course.name} · {e.total}명</strong><p className="note">{e.observedOn} · {e.note}</p></div><Button variant="ghost" onClick={()=>select(r.key)}>수정</Button><Button variant="ghost" onClick={()=>{onChange({...plan,overrides:{...plan.overrides,[r.key]:{...plan.overrides[r.key],demandInput:undefined}}});if(key===r.key)select('');}}>해제</Button></div>;})}
 </details>;
}
