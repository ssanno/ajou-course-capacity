import { planSchema,type Plan } from './model';
import { createPredictionRecord,predictionInput,predictionRecordSchema,recordSummary,type PredictionRecord,type RecordSummary } from './prediction-record';
import { isReviewDemo,isBrowserLocal } from './site-mode';

const PLAN_KEY='ajou-review-plans-v1',RECORD_KEY='ajou-review-predictions-v1';
const BROWSER_PLAN_KEY='ajou-capacity-plans-v1',BROWSER_RECORD_KEY='ajou-capacity-predictions-v1';
const localMode=()=>isReviewDemo()||isBrowserLocal();
const storage=()=>isBrowserLocal()?localStorage:sessionStorage;
const storageKey=(key:string)=>isBrowserLocal()?(key===PLAN_KEY?BROWSER_PLAN_KEY:BROWSER_RECORD_KEY):key;
function readLocal(key:string):unknown[]{
  try{const raw=storage().getItem(storageKey(key)),value:unknown=raw?JSON.parse(raw):[];if(!Array.isArray(value))throw Error();return value;}
  catch{throw Error('이 브라우저의 저장 자료를 읽지 못했습니다. 브라우저 저장 설정을 확인해주세요. 기존 자료는 덮어쓰지 않습니다.');}
}
function writeLocal(key:string,value:unknown){try{storage().setItem(storageKey(key),JSON.stringify(value));}catch{throw Error('이 브라우저에 저장할 공간이 부족하거나 저장이 차단되었습니다. 파일로 내려받아 보관해주세요.');}}
async function request<T>(path:string,init?:RequestInit):Promise<T>{const r=await fetch(path,{...init,signal:AbortSignal.timeout(20000)});const d=await r.json() as T & {error?:string};if(!r.ok)throw Error(d.error??'요청을 처리하지 못했습니다.');return d;}
export async function listPlans():Promise<Plan[]>{
  if(localMode())return readLocal(PLAN_KEY).map(p=>planSchema.parse(p));
  const d=await request<{plans:unknown[]}>('/api/plans');return d.plans.map((p:unknown)=>planSchema.parse(p)).filter((p:Plan)=>p.id!=='industrial-engineering-demo');
}
export async function savePlan(plan:Plan):Promise<number>{
  if(localMode()){
    const parsed=planSchema.parse(plan),plans=readLocal(PLAN_KEY).map(p=>planSchema.parse(p)),old=plans.find(p=>p.id===parsed.id);
    if(old&&old.version!==parsed.version)throw Error('다른 창에서 저장된 변경이 있습니다. 현재 계획을 파일로 내려받은 뒤 목록을 새로고침해주세요.');
    const next={...parsed,version:parsed.version+1};writeLocal(PLAN_KEY,[next,...plans.filter(p=>p.id!==parsed.id)]);return next.version;
  }
  return (await request<{version:number}>('/api/plans',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(plan)})).version;
}
export async function listPredictionRecords():Promise<RecordSummary[]>{
  if(localMode())return readLocal(RECORD_KEY).map(r=>recordSummary(predictionRecordSchema.parse(r)));
  return (await request<{records:RecordSummary[]}>('/api/predictions')).records;
}
export async function getPredictionRecord(id:string):Promise<PredictionRecord>{
  if(localMode()){const record=readLocal(RECORD_KEY).map(r=>predictionRecordSchema.parse(r)).find(r=>r.id===id);if(!record)throw Error('이 브라우저에서 기록을 찾지 못했습니다.');return record;}
  return predictionRecordSchema.parse((await request<{record:unknown}>(`/api/predictions?id=${encodeURIComponent(id)}`)).record);
}
export async function savePredictionRecord(plan:Plan,id:string):Promise<PredictionRecord>{
  if(localMode()){
    const records=readLocal(RECORD_KEY).map(r=>predictionRecordSchema.parse(r)),old=records.find(r=>r.id===id);
    if(old){if(JSON.stringify(old.input)!==JSON.stringify(predictionInput(plan)))throw Error('다른 입력으로 저장된 기록입니다. 새 기록을 만들어주세요.');return old;}
    const record=createPredictionRecord(plan,id,new Date().toISOString(),isBrowserLocal()?'browser-local':'demo-session');
    if(records.length>=100)throw Error('이 브라우저에는 최대 100개 예측 기록을 보관합니다. 필요한 기록은 파일로 내려받아 보관해주세요.');
    writeLocal(RECORD_KEY,[record,...records]);return record;
  }
  return predictionRecordSchema.parse((await request<{record:unknown}>('/api/predictions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,plan})})).record);
}
export function clearDemoSession(){if(!isReviewDemo())return;sessionStorage.removeItem(PLAN_KEY);sessionStorage.removeItem(RECORD_KEY);}
