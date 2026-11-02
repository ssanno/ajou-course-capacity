'use client';
import { useMemo,useState } from 'react';
import { Upload, ClipboardPaste } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { Table,TableBody,TableCell,TableHead,TableHeader,TableRow } from '@/components/ui/table';
import { Tabs,TabsList,TabsTrigger } from '@/components/ui/tabs';
import { readOfficialRows,expandOfficialMerges,officialMappingConflict,officialHeader,officialGroupKey,matchOfficialCourse,applyOfficialOfferings,offeringCandidates } from '@/lib/official-offerings';
import { rowKey,excluded,type Plan } from '@/lib/model';
import SimpleOfferingImport from './simple-offering-import';

export default function OfferingImport({plan,semester,onApply}:{plan:Plan,semester:1|2,onApply:(p:Plan)=>void}){
 const [mode,setMode]=useState('file'),[paste,setPaste]=useState(''),[sheets,setSheets]=useState<Record<string,unknown[][]>>({}),[sheet,setSheet]=useState(''),[mapping,setMapping]=useState<Record<string,string>>({}),[error,setError]=useState(''),[busy,setBusy]=useState(false),[filename,setFilename]=useState(''),[periodConfirmed,setPeriodConfirmed]=useState(false);
 const parsed=useMemo(()=>{if(!sheets[sheet])return null;try{return {data:readOfficialRows(sheets[sheet]),error:''};}catch(e){return {data:null,error:e instanceof Error?e.message:'양식을 읽지 못했습니다.'};}},[sheets,sheet]);
 const data=parsed?.data,candidates=offeringCandidates(plan,semester);
 const targets=Object.values(mapping).filter(v=>v&&v!=='skip'),unresolved=data?.groups.filter(c=>!mapping[officialGroupKey(c)]).length??0,omitted=data?.groups.filter(c=>mapping[officialGroupKey(c)]==='skip').length??0;
 const mismatch=!!data&&(data.year!==undefined&&data.year!==plan.planningYear||data.semester!==undefined&&data.semester!==semester),mappingError=officialMappingConflict(data?.groups??[],mapping),combined=targets.length-new Set(targets).size;
 function pick(name:string,all=sheets){setPeriodConfirmed(false);setSheet(name);setError('');try{const d=readOfficialRows(all[name]);setMapping(Object.fromEntries(d.groups.map(c=>[officialGroupKey(c),matchOfficialCourse(plan,semester,c).key])));}catch{setMapping({});}}
 async function read(input:File|string){setBusy(true);setError('');setSheets({});setSheet('');try{
  const x=await import('xlsx');let book;
  if(typeof input==='string'){if(!input.trim())throw Error('양식의 제목 행과 분반 목록을 함께 붙여넣어주세요.');if(input.length>1000000)throw Error('한 번에 5,000개 행 이내로 입력해주세요.');book=x.read(input,{type:'string',sheetRows:5050});setFilename('붙여넣은 교무팀 양식');}
  else{if(input.size>5*1024*1024)throw Error('파일은 5MB 이내로 올려주세요.');if(!/\.(xlsx|xls|csv)$/i.test(input.name))throw Error('XLSX, XLS 또는 CSV 파일을 선택해주세요.');book=x.read(await input.arrayBuffer(),{type:'array',sheetRows:5050});setFilename(input.name);}
  const all:Record<string,unknown[][]>={};for(const n of book.SheetNames.slice(0,20))all[n]=expandOfficialMerges(x.utils.sheet_to_json(book.Sheets[n],{header:1,defval:'',raw:true}),book.Sheets[n]['!merges']);
  if(!book.SheetNames.length)throw Error('읽을 수 있는 시트가 없습니다.');if(Object.values(all).some(r=>r.length>=5050))throw Error('한 번에 5,000개 행 이내로 입력해주세요.');
  setSheets(all);pick(Object.keys(all).find(n=>officialHeader(all[n])>=0)??book.SheetNames[0],all);
 }catch(e){setError(e instanceof Error?e.message:'파일을 읽지 못했습니다.');}finally{setBusy(false);}}
 function apply(){if(!data)return;try{onApply(applyOfficialOfferings(plan,semester,data.groups,mapping,{filename,sheet,year:data.year,semester:data.semester,periodConfirmed}));}catch(e){setError(e instanceof Error?e.message:'연결한 과목을 확인해주세요.');}}
 return <div className="offering-import"><p className="input-note">교무팀의 ‘전공별 제출 양식’ 작성본을 그대로 올리세요. 한 행을 한 분반으로 읽습니다.</p>
 <Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="file"><Upload/>파일 업로드</TabsTrigger><TabsTrigger value="paste"><ClipboardPaste/>엑셀 붙여넣기</TabsTrigger></TabsList></Tabs>
 {mode==='file'?<div className="upload-zone" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(!busy&&e.dataTransfer.files[0])void read(e.dataTransfer.files[0]);}}><Upload/><strong>{filename||'전공별 제출 양식을 올려주세요'}</strong><p>XLSX · XLS · CSV · 5MB 이내</p><label className="upload-button">파일 선택<input type="file" accept=".xlsx,.xls,.csv" disabled={busy} onChange={e=>{if(e.target.files?.[0])void read(e.target.files[0]);e.target.value='';}}/></label></div>:<div className="paste-area"><label htmlFor="official-paste">제목 행부터 마지막 분반까지 붙여넣기</label><Textarea id="official-paste" value={paste} onChange={e=>setPaste(e.target.value)} rows={5}/><Button variant="outline" disabled={busy} onClick={()=>void read(paste)}>양식 읽기</Button></div>}
 {busy&&<p role="status">양식을 읽고 있습니다…</p>}{error&&<p role="alert" className="message error">{error}</p>}
 {Object.keys(sheets).length>1&&<label>시트<NativeSelect aria-label="제출 양식 시트" value={sheet} onChange={e=>pick(e.target.value)}>{Object.keys(sheets).map(n=><option key={n}>{n}</option>)}</NativeSelect></label>}
 {parsed?.error&&<p role="alert" className="message error">{parsed.error}</p>}
 {data&&<div className="official-preview"><div className="output-heading"><h2>{data.groups.length}개 과목 · {data.groups.reduce((n,c)=>n+c.sections.length,0)}개 분반</h2><span>{data.year&&data.semester?`${data.year}학년도 ${data.semester}학기`:'제목에 학기 없음 · 선택한 대상 학기 적용'}</span></div>
 {(data.excluded>0||data.examples>0)&&<p className="note">{data.excluded>0?`현장실습·인턴십 ${data.excluded}개 행 제외. `:''}{data.examples>0?`양식에 포함된 예시 ${data.examples}개 행 제외.`:''}</p>}
 {mismatch&&<div className="message error" role="alert"><p>파일 본문: {data.year}학년도 {data.semester}학기 / 선택한 대상: {plan.planningYear}학년도 {semester}학기</p><label><input type="checkbox" checked={periodConfirmed} onChange={e=>setPeriodConfirmed(e.target.checked)}/> 본문 제목이 이전 양식임을 확인했습니다. 선택한 대상 학기로 반영합니다.</label><p>원본 제목의 학기와 확인 여부를 함께 보관합니다.</p></div>}
 {data.warnings.map((w,i)=><p className="import-warning" key={i}>{w}</p>)}
 {data.errors.length>0&&<div className="message error" role="alert">{data.errors.slice(0,8).map(e=><p key={e}>{e}</p>)}{data.errors.length>8&&<p>외 {data.errors.length-8}개 오류</p>}</div>}
 {data.groups.length>0&&<div className="official-table-scroll"><Table><TableHeader><TableRow><TableHead>제출 과목</TableHead><TableHead>분반</TableHead><TableHead>교육과정 연결</TableHead></TableRow></TableHeader><TableBody>{data.groups.map(c=>{const key=officialGroupKey(c),target=mapping[key]??'',matched=candidates.find(x=>rowKey(x)===target),suggestions=matchOfficialCourse(plan,semester,c).suggestions;return <TableRow key={key}><TableCell><strong>{c.name}</strong><small className="course-subtitle">{c.code} · {c.category} · {c.credits}학점</small><small className="course-subtitle">{c.major}</small></TableCell><TableCell>{c.sections.map(s=>s.section).join(', ')}<small className="course-subtitle">{c.sections.length}개 분반</small></TableCell><TableCell><NativeSelect aria-label={`${c.code} 교육과정 연결`} value={target} onChange={e=>setMapping({...mapping,[key]:e.target.value})}><option value="">연결할 과목 선택</option>{candidates.map(x=><option key={rowKey(x)} value={rowKey(x)}>{suggestions.includes(rowKey(x))?'동일 과목명 · ':''}{x.name} ({x.code}){x.semester!==semester?' · 권장학기 외 개설':''}</option>)}<option value="skip">이번 정원 산출에서 제외</option></NativeSelect>{!target&&<small className="course-subtitle import-warning">1단계에서 해당 과목·권장 학기를 확인해주세요.</small>}{matched&&matched.code!==c.code&&<small className="course-subtitle import-warning">코드가 다릅니다. 동일·대체 과목인지 확인하세요.</small>}{matched&&matched.semester!==semester&&<small className="course-subtitle import-warning">권장학기 외 보충 개설로 반영합니다. 학년 전원 수요를 반복 배정하지 않습니다.</small>}{matched&&matched.name!==c.name&&<small className="course-subtitle">교육과정 명칭: {matched.name}</small>}</TableCell></TableRow>;})}</TableBody></Table></div>}
 {mappingError&&<p className="message error" role="alert">{mappingError}</p>}{combined>0&&!mappingError&&<p className="import-warning">직접 연결한 동일 코드의 분반을 합칩니다. 과목명이 다른 원문은 분반 비고에 보관합니다. 연결 내용을 확인해주세요.</p>}
 {!!unresolved&&<p className="note">미연결 {unresolved}개 과목을 확인해주세요. 교육과정에 없는 과목은 임의로 추가하지 않습니다.</p>}
 {omitted>0&&<p className="import-warning">직접 제외한 {omitted}개 과목은 필요정원·개설 학점 집계에서 빠집니다.</p>}
 <p className="note">선택한 학기의 개설 목록을 교체합니다. 분반번호·교원·예외 사유·비고는 함께 보관합니다.</p>
 <Button disabled={busy||!targets.length||!!unresolved||(mismatch&&!periodConfirmed)||!!mappingError||!!data.errors.length} onClick={apply}>{new Set(targets).size}개 과목 적용{omitted?` (${omitted}개 제외)`:''}</Button></div>}
 <details className="quiet-details"><summary>기존 간단 목록으로 입력</summary><SimpleOfferingImport plan={plan} semester={semester} onApply={onApply}/></details></div>;
}
