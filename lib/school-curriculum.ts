import { z } from 'zod';
import { courseSchema, excluded, planSchema, rowKey, type Course, type Plan } from './model';

export const SCHOOL_URL='https://mhaksa.ajou.ac.kr:30443/public.html#!/e020404';
export const schoolTypes={general:'일반교육과정',abeek:'공학인증교육과정',deep:'심화교육과정'} as const;
export type SchoolType=keyof typeof schoolTypes;
export type SchoolMajor={code:string,name:string};
export type SchoolRow={id:string,code:string,name:string,category:string,credits:number,periods:{grade:number,semester:number}[],choiceGroup:string,change:string};
export type SchoolResult={year:number,type:SchoolType,major:SchoolMajor,fetchedAt:string,sourceUrl:string,rows:SchoolRow[]};
export const schoolQuerySchema=z.object({year:z.coerce.number().int().min(2006).max(2100),type:z.enum(['general','abeek','deep']).default('general'),major:z.string().regex(/^[A-Za-z0-9_-]{1,40}$/).optional()});
const clean=(s:unknown)=>String(s??'').trim();
export const normalizedName=(s:string)=>s.replace(/[\s·ㆍ.,()\-/]/g,'').toLowerCase();
export function normalizeSchoolRows(raw:Record<string,unknown>[],type:SchoolType='general'):SchoolRow[]{
 return raw.map(r=>({id:clean(r.curiNo),code:clean(r.sbjtCd),name:clean(r.sbjtKorNm),category:type==='deep'?clean(r.deepSustLsnFgNm):type==='abeek'?(clean(r.abeekSustLsnFgNm)==='인선'?'전선':clean(r.abeekSustLsnFgNm)==='인필'?(r.abeekSubmattFg==='U0226003'?'전필':'교필'):clean(r.abeekSustLsnFgNm)):clean(r.sustLsnFgNm),credits:Number(r.pnt),choiceGroup:type==='abeek'?clean(r.abeekGrpNm):clean(r.stgNeceGrpNm),change:clean(r.sbjtChgFgNm),periods:Array.from({length:12},(_,i)=>({grade:Math.floor(i/2)+1,semester:i%2+1})).filter(p=>['○','Y','1'].includes(clean(r[`sy${p.grade}${p.semester}shtmRcomYn`])))})).filter(r=>r.code&&r.name);
}
export type SchoolCandidate={row:SchoolRow,courses:Course[],blocked:string[],review:string[],defaultSelected:boolean};
export type SchoolAllocations=Record<string,Record<string,number|undefined>>;
export function schoolCandidates(result:SchoolResult,plan:Plan,includeGeneral:boolean,allocations:SchoolAllocations={}):SchoolCandidate[]{
 const names=new Map<string,Set<string>>();for(const r of result.rows){if(r.change.includes('폐지')||excluded(r.name))continue;const n=normalizedName(r.name);names.set(n,new Set([...(names.get(n)??[]),r.code]));}
 return result.rows.map(row=>{
  const blocked:string[]=[],review:string[]=[];const category=({'전필':'전필','전선':'전선','전기':'전공기초','전공기초':'전공기초','교필':'교양필수','교양필수':'교양필수'} as Record<string,Course['category']>)[row.category];
  if(excluded(row.name))blocked.push('현장실습·인턴십 제외');
  if(row.change.includes('폐지'))blocked.push('폐지 과목 제외');
  if(!category)blocked.push('이수구분 확인 필요');
  if(!Number.isFinite(row.credits)||row.credits<0||row.credits>30)blocked.push('학점 확인 필요');
  if(!row.id)blocked.push('학교 식별값 확인 필요');
  if(!row.periods.length)blocked.push('권장 학년·학기 미지정');
  if(new Set(row.periods.map(p=>p.semester)).size<row.periods.length)blocked.push('같은 학기에 여러 학년이 지정되어 있어 학년별 수요 배분 필요');
  else if(new Set(row.periods.map(p=>p.grade)).size>1)review.push('학기별 권장 학년이 다릅니다. 각 학기의 해당 학년 인원에 이수비중을 적용합니다.');
  const old=plan.curriculum.filter(c=>c.year===plan.curriculumYear&&c.code===row.code);
  const allocationKnown=row.periods.length>1&&old.length===row.periods.length&&row.periods.every(p=>old.some(c=>c.grade===p.grade&&c.semester===p.semester))&&Math.abs(old.reduce((n,c)=>n+c.share,0)-1)<.00001;
  const input=allocations[row.id],shares=row.periods.map(p=>input?.[`${p.grade}:${p.semester}`]);
  const explicit=!!input&&shares.length>0&&shares.every(s=>s!==undefined&&Number.isFinite(s)&&s>=0&&s<=100)&&shares.reduce<number>((n,s)=>n+(s??0),0)>0&&shares.reduce<number>((n,s)=>n+(s??0),0)<=100;
  if(row.choiceGroup&&category!=='전선'&&!explicit)blocked.push(`${row.choiceGroup} 선택이수 배분 필요`);
  if(input&&Object.values(input).some(v=>v!==undefined)&&!explicit)blocked.push('입력한 학기별 이수비중 확인 필요');
  const automatic=row.periods.length>1&&!explicit&&(!allocationKnown||old.some(c=>c.shareMode==='history'||c.shareMode==='curriculum'));
  if(automatic)review.push('양학기 이수 인원은 이전 연도의 동일 과목·권장학년 수강 분포를 참고하고, 자료가 없으면 균등 배분합니다. 직접 입력한 비중이 있으면 우선합니다.');
  if((names.get(normalizedName(row.name))?.size??0)>1)review.push('동일·유사 과목명에 다른 코드가 있습니다. 실제 개설할 코드를 확인해주세요.');
  if(row.change&&!row.change.includes('폐지'))review.push(row.change);
  const courses=blocked.length?[]:row.periods.map(p=>courseSchema.parse({code:row.code,name:row.name,year:result.year,...p,category,credits:row.credits,recommendedSemesters:row.periods.map(x=>x.semester),shareMode:automatic?'curriculum':'manual',share:explicit?input[`${p.grade}:${p.semester}`]!/100:automatic?1/row.periods.length:allocationKnown?old.find(c=>c.semester===p.semester)!.share:1,note:[row.choiceGroup?`선택이수 ${row.choiceGroup}`:'',explicit?'학교 권장 시기별 이수비중 직접 확인':allocationKnown?'기존 계획의 양학기 이수비중 유지':'',...review].filter(Boolean).join(' / ')}));
  return {row,courses,blocked,review,defaultSelected:!blocked.length&&(includeGeneral||category!=='교양필수')&&(names.get(normalizedName(row.name))?.size??0)<=1};
 });
}
export function applySchoolCurriculum(plan:Plan,result:SchoolResult,selectedIds:string[],includeGeneral:boolean,allocations:SchoolAllocations={}):Plan{
 const selected=new Set(selectedIds);const candidates=schoolCandidates(result,plan,includeGeneral,allocations),picked=candidates.filter(c=>selected.has(c.row.id)&&!c.blocked.length);const courses=picked.flatMap(c=>c.courses);
 if(!courses.length)throw Error('불러올 과목을 선택해주세요.');
 const overrides={...plan.overrides};for(const c of courses){const old=plan.curriculum.find(o=>o.year===plan.curriculumYear&&o.code===c.code&&o.semester===c.semester);if(old&&overrides[rowKey(old)]&&!overrides[rowKey(c)])overrides[rowKey(c)]={...overrides[rowKey(old)]};}
 const replaced=new Set(plan.curriculum.filter(c=>c.year===result.year).map(rowKey));for(const key of replaced)if(!courses.some(c=>rowKey(c)===key))delete overrides[key];
 const maxGrade=Math.max(plan.cohorts.length,...courses.map(c=>c.grade));
 const pending=candidates.filter(c=>!selected.has(c.row.id)||c.blocked.length).map(c=>({code:c.row.code,name:c.row.name,reason:c.blocked.join(' · ')||'미선택'}));
 return planSchema.parse({...plan,name:result.major.name,curriculumYear:result.year,studentCounts:plan.studentCounts?Array.from({length:maxGrade},(_,i)=>plan.studentCounts?.[i]??null):undefined,curriculum:[...plan.curriculum.filter(c=>c.year!==result.year),...courses],overrides,cohorts:Array.from({length:maxGrade},(_,i)=>plan.cohorts[i]??0),leaveCounts:plan.leaveCounts?Array.from({length:maxGrade},(_,i)=>plan.leaveCounts?.[i]??0):undefined,curriculumSources:{...plan.curriculumSources,[result.year]:{url:SCHOOL_URL,year:result.year,type:result.type,majorCode:result.major.code,majorName:result.major.name,fetchedAt:result.fetchedAt,rawCount:result.rows.length,importedCount:picked.length,locallyEdited:false,pending}}});
}
