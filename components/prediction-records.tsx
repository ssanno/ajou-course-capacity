'use client';
import { useRef,useState } from 'react';
import { Archive,Download,ArrowLeft } from 'lucide-react';
import { Button } from './ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription } from './ui/dialog';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from './ui/table';
import { download } from './import-panel';
import { predictionInput,predictionRecordSchema,predictionRecordCsv,type PredictionRecord,type RecordSummary } from '@/lib/prediction-record';
import { savePredictionRecord,listPredictionRecords,getPredictionRecord } from '@/lib/record-storage';
import { isReviewDemo,isBrowserLocal } from '@/lib/site-mode';
import { createRecordId } from '@/lib/record-id';
import type { Plan } from '@/lib/model';

const date=(s:string)=>new Date(s).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
export default function PredictionRecords({plan,disabled=false}:{plan?:Plan,disabled?:boolean}){
  const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[records,setRecords]=useState<RecordSummary[]>([]),[selected,setSelected]=useState<PredictionRecord|null>(null),[error,setError]=useState(''),[fromFile,setFromFile]=useState(false);
  const pending=useRef<{input:string,id:string}|null>(null);
  async function list(){setBusy(true);setError('');try{setRecords(await listPredictionRecords());}catch(e){setError(e instanceof Error?e.message:'기록 목록을 불러오지 못했습니다.');}finally{setBusy(false);}}
  async function launch(){setOpen(true);setError('');setFromFile(false);setSelected(null);
    if(!plan){await list();return;}
    setBusy(true);try{
      const input=JSON.stringify(predictionInput(plan));if(pending.current?.input!==input)pending.current={input,id:createRecordId()};
      const r=await savePredictionRecord(plan,pending.current.id);setSelected(r);pending.current=null;
    }catch(e){setError(e instanceof Error?e.message:'기록을 보관하지 못했습니다.');}finally{setBusy(false);}
  }
  async function select(id:string){setBusy(true);setError('');try{setSelected(await getPredictionRecord(id));setFromFile(false);}catch(e){setError(e instanceof Error?e.message:'기록을 열지 못했습니다.');}finally{setBusy(false);}}
  async function readFile(file:File){setError('');try{if(file.size>6*1024*1024)throw Error('6MB 이내의 예측 기록 JSON 파일을 선택해주세요.');const record=predictionRecordSchema.parse(JSON.parse(await file.text()));setSelected(record);setFromFile(true);}catch{setError('예측 기록 JSON 파일 형식을 확인해주세요. 일반 계획 파일은 상단의 불러오기에서 여세요.');}}
  const filename=selected?`${selected.input.name}_${selected.input.planningYear}-${selected.input.planningSemester}_${selected.id.slice(0,8)}_예측기록`:'';
  return <><Button variant="outline" disabled={disabled||busy} onClick={()=>void launch()}><Archive/>{plan?'예측 기록 보관':'예측 기록'}</Button>
    <Dialog open={open} onOpenChange={v=>{if(!busy)setOpen(v);}}><DialogContent className="prediction-dialog"><DialogHeader><DialogTitle>{selected?'보관한 예측 결과':'예측 기록'}</DialogTitle><DialogDescription>기록 당시의 입력값과 결과를 고정해 보관합니다. 이후 계획이나 모델이 변경되어도 이 결과는 다시 계산하지 않습니다.</DialogDescription></DialogHeader>
      {error&&<p role="alert" className="message error">{error}</p>}
      {busy?<p role="status">처리 중…</p>:selected?<>
        <div className="record-heading"><strong>{selected.input.name} · {selected.input.planningYear}학년도 {selected.input.planningSemester}학기</strong><span>{date(selected.createdAt)} (한국시간)</span></div>
        <p className="input-note">{fromFile?'파일에서 연 기록입니다. 파일의 원본 여부는 별도 확인이 필요합니다.':selected.storage==='demo-session'?'데모 임시 기록입니다. 탭을 닫으면 사라질 수 있으므로 필요한 기록은 다운로드하세요.':selected.storage==='browser-local'?'이 브라우저에 보관한 기록입니다. 별도 보관하려면 파일로 내려받으세요.':'서버에 보관한 기록입니다.'} 증원·추가 분반·대기 결과와의 비교 기준으로 사용할 수 있습니다.</p>
        <div className="record-actions"><Button onClick={()=>download(JSON.stringify(selected,null,2),filename+'.json','application/json;charset=utf-8')}><Download/>전체 기록 JSON</Button><Button variant="outline" onClick={()=>download(predictionRecordCsv(selected),filename+'.csv')}><Download/>결과 엑셀용 CSV</Button></div>
        <Table><TableHeader><TableRow><TableHead>개설 과목</TableHead><TableHead>예상 수강</TableHead><TableHead>기본 확보 권장</TableHead><TableHead>분반별 배분</TableHead><TableHead>수용 가능</TableHead><TableHead>부족 예상</TableHead></TableRow></TableHeader><TableBody>{selected.results.map(r=><TableRow key={r.key}><TableCell>{r.name}<small className="course-subtitle">{r.code}</small></TableCell><TableCell>{r.demand===null?"확인 필요":`${r.demand}명`}</TableCell><TableCell>{r.capacity===null?'확인 필요':`${r.capacity}명`}</TableCell><TableCell>{r.sections.map(s=>`${s.id}분반 ${s.capacity===null?'확인 필요':s.capacity+'명'}`).join(' · ')}</TableCell><TableCell>{r.plannedCapacity===null?'미확인':`${r.plannedCapacity}명`}</TableCell><TableCell>{r.shortage===null?'미확인':`${r.shortage}명`}</TableCell></TableRow>)}</TableBody></Table>
        {!!selected.missingRequired.length&&<div className="capacity-risks"><strong>당시 미개설 필수·기초 {selected.missingRequired.length}과목</strong>{selected.missingRequired.map(r=><p key={r.key}>{r.name} · 이수 대상 {r.required}명</p>)}</div>}
        <details className="quiet-details"><summary>보관한 입력값·모델 정보</summary><p>기록 ID: {selected.id}<br/>모델: {selected.modelVersion}<br/>교육과정: {selected.input.curriculumYear}학년도</p><p>{(selected.input.studentCounts??selected.input.cohorts).map((n,i)=>`${i+1}학년 ${n??'미입력'}명`).join(' · ')}</p><p>학기 이수 상한 {selected.assumptions.semesterCredits}학점 · {selected.assumptions.majorCredits!==undefined?`기본 전공 ${selected.assumptions.majorCredits}학점 · 4학년 2학기 전공 ${selected.assumptions.seniorSecondMajorCredits}학점`:`학년별 선택 상한 ${selected.assumptions.electiveCreditsByGrade.join(' / ')}학점`}</p><p>{selected.registrationProfiles?.length?`적용한 ${selected.input.studentCountBasis==="registrants"?"수강신청자":"재학생"} 기준 전공선택 평균: ${selected.registrationProfiles.map(p=>`${p.grade}학년 ${p.electiveCredits.toFixed(2)}학점 (${p.department??"전 학과"}) (${p.years.join("·")}년 ${p.semester}학기)`).join(" / ")}. 위 기본 전공 가정은 자료가 없을 때만 적용합니다.`:""}</p><p>교육과정 전체·개설 조건·수동 조정값·산출 근거는 전체 기록 JSON에 포함됩니다. 기록 시각은 실제 개설 전 시점임을 자동으로 증명하지 않으므로 운영 일정과 함께 확인해야 합니다.</p></details>
        <Button variant="ghost" onClick={()=>{setSelected(null);void list();}}><ArrowLeft/>기록 목록</Button>
      </>:<><p className="input-note">{isReviewDemo()?'이 탭의 임시 기록입니다. 다른 방문자와 공유되지 않습니다.':isBrowserLocal()?'이 브라우저에 보관한 기록입니다. 다른 기기·브라우저에서는 기록 파일을 열어 확인할 수 있습니다.':'최근 100개 기록을 표시합니다. 원본 기록은 별도로 덮어쓰지 않습니다.'}</p><div className="saved-plans">{records.length?records.map(r=><button key={r.id} onClick={()=>void select(r.id)}><strong>{r.name} · {r.year}-{r.semester}</strong><span>{date(r.createdAt)} · {r.courseCount}과목 · 확인된 부족 {r.shortfallCourses}과목</span></button>):<p>보관한 예측 기록이 없습니다. 필요정원 산출 후 ‘예측 기록 보관’을 누르세요.</p>}</div><div className="record-actions"><Button variant="outline" onClick={()=>void list()}>목록 새로고침</Button><label className="upload-button">기록 파일 열기<input type="file" accept=".json" onChange={e=>{const f=e.target.files?.[0];if(f)void readFile(f);e.target.value='';}}/></label>{plan&&error&&<Button onClick={()=>void launch()}>보관 다시 시도</Button>}</div></>}
    </DialogContent></Dialog></>;
}
