import { normalizeSchoolRows,schoolQuerySchema,type SchoolMajor,type SchoolType } from '@/lib/school-curriculum';
const ORIGIN='https://mhaksa.ajou.ac.kr:30443';
const cache=new Map<string,{until:number,value:unknown}>();
// Fixed, public read-only actions. The caller cannot supply an upstream URL or arbitrary parameters.
async function schoolRead(action:string,param:Record<string,string>){
 const res=await fetch(ORIGIN+'/nt/cvt.do',{method:'POST',headers:{'Content-Type':'application/json','Referer':ORIGIN+'/public.html'},body:JSON.stringify({url:action,param}),signal:AbortSignal.timeout(18000),redirect:'manual'});
 if(!res.ok)throw Error('학교 학사서비스가 응답하지 않습니다. 잠시 후 다시 조회해주세요.');
 const text=await res.text();if(text.length>4000000)throw Error('학교 응답의 자료 크기가 너무 큽니다.');
 const payload=JSON.parse(text) as {ErrorCode?:string,VariableList?:{ErrorCode?:string},DatasetList?:Record<string,Record<string,unknown>[]>};
 if(payload.ErrorCode||payload.VariableList?.ErrorCode!=='0'||!payload.DatasetList)throw Error('학교 조회 응답을 확인할 수 없습니다. 학교 원문에서 확인해주세요.');
 return payload.DatasetList;
}
async function cached<T>(key:string,fetcher:()=>Promise<T>):Promise<T>{
 const hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.value as T;
 const value=await fetcher();if(cache.size>=32)cache.delete(cache.keys().next().value!);cache.set(key,{value,until:Date.now()+600000});return value;
}
async function majors(year:number,type:SchoolType):Promise<SchoolMajor[]>{return cached(`${year}:${type}:majors`,async()=>{
 const base={strUserNo:'000000000',strDeptUseFg:'C0040002',strMngtYn1:'1',strMngtYn2:'0',strModeFg:'S',strUpDeptCd:'',strUseFg:'1',strCampCd:'S',strUserDeptCd:'0000000000',strFg:'1'};
 let list:Record<string,unknown>[];
 if(type==='general'){const ds=await schoolRead('/com/com/cmmn/code/findDeptList3.action',{...base,strDataSet:'DS_MJ_CD_SH',strYy:String(year),strPosiGrpCd:'31'});list=ds.DS_MJ_CD_SH;if(!Array.isArray(list))throw Error('학교 전공 목록 형식이 변경되었습니다.');return list.map(r=>({code:String(r.deptCd??''),name:String(r.deptKorNm??'')})).filter(r=>r.code&&(r.name.includes('전공')||r.code.startsWith('DS0301501'))&&!r.name.includes('심화')&&!['DS03001024001','DS0300202404'].includes(r.code));}
 const ds=await schoolRead(type==='abeek'?'/uni/uni/cour/curi/findAbeekMjCd.action':'/uni/uni/cour/curi/findDeepMjCd.action',type==='abeek'?{...base,strDataSet:'DS_ABEEK_MJ_CD',strCorsYy:String(year),strPosiGrpCd:'3'}:{strDataSet:'DS_DEEP_MJ_CD',strYy:String(year)});
 list=ds[type==='abeek'?'DS_ABEEK_MJ_CD':'DS_DEEP_MJ_CD'];if(!Array.isArray(list))throw Error('학교 전공 목록 형식이 변경되었습니다.');return list.map(r=>({code:String(r.mjCd??''),name:String(r.mjCdNm??'')})).filter(r=>r.code&&r.name&&(type!=='abeek'||r.name.includes('전공')));
 });}
export async function GET(req:Request){
 const q=schoolQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));if(!q.success)return Response.json({error:'조회 연도·과정·전공을 확인해주세요.'},{status:400});
 const {year,type,major}=q.data;
 if(year>new Date().getFullYear()+5)return Response.json({error:'조회 연도를 확인해주세요.'},{status:400});
 try{
 const choices=await majors(year,type);
 if(!major)return Response.json({majors:choices,year,type},{headers:{'Cache-Control':'private, max-age=60'}});
 const picked=choices.find(m=>m.code===major);if(!picked)return Response.json({error:'선택한 연도·과정의 전공이 아닙니다. 전공을 다시 선택해주세요.'},{status:400});
 const result=await cached(`${year}:${type}:${major}`,async()=>{
 const param:Record<string,string>={strYy:String(year),strMjCd:major};if(type==='abeek')param.strAbeek='1';else param.strFg=major.startsWith('DS0301501')?'':'1';
 const ds=await schoolRead(type==='deep'?'/uni/uni/cour/curi/findCourDeepCurriculumInq.action':'/uni/uni/cour/curi/findCourCurriculumInq.action',param);
 if(!Array.isArray(ds.DS_COUR030)||ds.DS_COUR030.length>3000)throw Error('학교 교육과정 응답 형식을 확인할 수 없습니다.');
 return {year,type,major:picked,sourceUrl:ORIGIN+'/public.html#!/e020404',fetchedAt:new Date().toISOString(),rows:normalizeSchoolRows(ds.DS_COUR030,type)};
 });return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('School curriculum read failed',e instanceof Error?e.message:'unknown');return Response.json({error:e instanceof Error&&e.message.startsWith('학교')?e.message:'학교 학사서비스와 연결하지 못했습니다. 잠시 후 다시 조회하거나 학교 원문에서 확인해주세요.'},{status:502});}
}
