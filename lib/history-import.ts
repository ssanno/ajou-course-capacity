import { excluded,planSchema,rowKey,type Plan,type History,type Course } from './model';

const norm=(v:unknown)=>String(v??'').trim().replace(/\s/g,'');
const aliases:Record<string,string[]>={code:['교과목코드','과목코드','학수번호'],name:['과목명','교과목명'],section:['반','분반','분반번호'],capacity:['정원','수강정원','설정정원'],enrolled:['수강인원','수강신청인원'],vacancy:['여석','잔여석'],pre:['예비수강인원','예비수강신청인원'],category:['학수구분','이수구분'],grade:['수강대상학년','권장학년','학년']};
export const normalizeCategory=(v:unknown):Course['category']|undefined=>({'전필':'전필','전공필수':'전필','전선':'전선','전공선택':'전선','전기':'전공기초','전공기초':'전공기초','교필':'교양필수','교양필수':'교양필수'} as Record<string,Course['category']>)[norm(v)];
export function historyHeader(rows:unknown[][]){return rows.slice(0,40).findIndex(r=>['code','section','capacity','enrolled'].every(k=>r.some(v=>aliases[k].includes(norm(v)))));}
export function historyPeriod(filename:string){const m=filename.match(/(20\d{2})\s*(?:학년도|학년|년)?\s*[-_. ]+\s*(?:제\s*)?([12])\s*학기/);return m?{year:Number(m[1]),semester:Number(m[2]) as 1|2}:undefined;}
export type HistoryGroup={code:string,name:string,category?:Course['category'],rows:Omit<History,'year'|'semester'>[]};
export function readHistoryRows(rows:unknown[][]){
 const header=historyHeader(rows);if(header<0)throw Error('교과목코드·반·정원·수강인원 열을 찾지 못했습니다. AIMS 분반상세정보 파일을 확인해주세요.');
 const map=Object.fromEntries(Object.entries(aliases).map(([k,a])=>[k,rows[header].findIndex(v=>a.includes(norm(v)))]));
 const groups=new Map<string,HistoryGroup>(),seen=new Set<string>(),errors:string[]=[],warnings:string[]=[];let skipped=0;
 for(let i=header+1;i<rows.length;i++){
  const row=rows[i],code=String(row[map.code]??'').trim(),name=String(row[map.name]??'').trim();if(!code&&!name)continue;
  if(excluded(name)){skipped++;continue;}
  if(!code||!name){errors.push(`${i+1}행: 과목코드와 과목명이 필요합니다.`);continue;}
  const rawSection=String(row[map.section]??'').trim(),section=/^\d+$/.test(rawSection)?String(Number(rawSection)):rawSection;
  if(!section){errors.push(`${i+1}행 ${code}: 분반번호가 없습니다.`);continue;}
  const get=(key:string,signed=false)=>{const raw=String(row[map[key]]??'').trim();if(!raw)return undefined;const n=Number(raw.replaceAll(',',''));if(!Number.isInteger(n)||n>(100000)||n<(signed?-100000:0))throw Error(`${i+1}행 ${code}: ${key==='vacancy'?'여석':'인원'} 값을 확인해주세요.`);return n;};
  try{
   const capacity=get('capacity'),enrolled=get('enrolled'),vacancy=get('vacancy',true),pre=get('pre');
   if(capacity===undefined||enrolled===undefined)throw Error(`${i+1}행 ${code}: 정원·수강인원 누락 (0명은 0으로 입력)`);
   const k=code+':'+section;if(seen.has(k))throw Error(`${i+1}행: ${code} ${section}분반 중복`);seen.add(k);
   const gradeText=norm(row[map.grade]),gradeMatch=gradeText.match(/^([1-6])(?:학년)?$/),grade=gradeMatch?Number(gradeMatch[1]):undefined;
   const category=normalizeCategory(row[map.category]),h={code,name,section,capacity,enrolled,vacancy,pre,category,grade};
   if(vacancy!==undefined&&capacity-enrolled!==vacancy)warnings.push(`${code} ${section}분반: 정원−수강인원(${capacity-enrolled})과 여석(${vacancy}) 불일치. 정원·수강인원을 그대로 사용합니다.`);
   const g=groups.get(code);if(g){if(g.name!==name||g.category!==category)throw Error(`${code}: 분반별 과목명 또는 이수구분이 다릅니다.`);g.rows.push(h);}else groups.set(code,{code,name,category,rows:[h]});
  }catch(e){errors.push(e instanceof Error?e.message:'값 확인 필요');}
 }
 if(!groups.size&&!errors.length)errors.push('반영할 수강실적이 없습니다.');
 return {groups:[...groups.values()],skipped,errors,warnings};
}
export function applyHistory(plan:Plan,groups:HistoryGroup[],mapping:Record<string,string>,options:{year:number,semester:1|2,counts:(number|null)[],filename:string,calibration:boolean,categories:boolean,sectionIds:boolean}){
 const {year,semester}=options,target=plan.planningYear??plan.targetYear;
 if(year>target||year===target&&semester>(plan.planningSemester??2))throw Error('대상 학기 이후의 실적은 사용할 수 없습니다.');
 const same=year===target&&semester===plan.planningSemester;
 if(year===target&&!same)throw Error('예측에는 이전 학년도의 실적을 사용합니다.');
 if(same&&!options.calibration)throw Error('대상 학기와 같은 실적입니다. 동일학기 비교·보정을 선택해주세요.');
 const overrides={...plan.overrides},mapped=new Set<string>(),history:History[]=[];
 for(const g of groups){const match=mapping[g.code];if(!match)throw Error(`${g.name}: 과목 연결 또는 제외를 선택해주세요.`);if(match==='skip')continue;
  const c=plan.curriculum.find(c=>c.year===plan.curriculumYear&&(!same||c.semester===semester)&&c.code===match&&!excluded(c.name));if(!c)throw Error(`${g.name}: 연결할 교육과정을 확인해주세요.`);
  if(mapped.has(c.code))throw Error('여러 실적 과목을 하나의 교육과정에 중복 연결할 수 없습니다.');mapped.add(c.code);
  history.push(...g.rows.map(h=>({...h,code:c.code,sourceCode:g.code,year,semester})));
  const k=rowKey(c),o=overrides[k];if(same&&o?.enabled){overrides[k]={...o,...(options.categories&&g.category?{categoryOverride:g.category}:{}),...(options.sectionIds?{sections:g.rows.length,sectionIds:g.rows.map(h=>h.section)}:{})};}
 }
 if(!history.length)throw Error('반영할 과목이 없습니다.');
 const period=`${year}:${semester}`;
 return planSchema.parse({...plan,overrides,forecastMode:same&&options.calibration?'calibration':'forecast',history:[...plan.history.filter(h=>h.year!==year||h.semester!==semester),...history],historyCohorts:{...plan.historyCohorts,[period]:options.counts},historySources:{...plan.historySources,[period]:{filename:options.filename,importedAt:new Date().toISOString()}}});
}
