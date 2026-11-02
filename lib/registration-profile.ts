import { registrationAggregates, REGISTRATION_DATA_VERSION } from './registration-data';

// A common university-wide rate, never a department/course fitted coefficient.
// Strict prior-year cutoff also keeps late-reported same-year data out of backtests.
export function registrationProfile(targetYear:number,semester:number,grade:number,basis:'enrolled'|'registrants'='enrolled'){
 const rows=registrationAggregates.filter(r=>r.year<targetYear&&r.semester===semester&&r.grade===grade&&(basis==='registrants'?r.applicants:r.students)>0);
 const students=rows.reduce((n,r)=>n+(basis==='registrants'?r.applicants:r.students),0);
 if(grade>4||!students)return null;
 const sum=(key:'majorRequired'|'majorElective'|'total')=>rows.reduce((n,r)=>n+(basis==='registrants'?r[key==='majorRequired'?'applicantMajorRequired':key==='majorElective'?'applicantMajorElective':'applicantTotal']:r[key]),0);
 return {version:REGISTRATION_DATA_VERSION,years:rows.map(r=>r.year),semester,grade,students,basis,
  departmentTerms:rows.reduce((n,r)=>n+(basis==='registrants'?r.applicantDepartments:r.departments),0),electiveCredits:sum('majorElective')/students,
  requiredCredits:sum('majorRequired')/students,totalCredits:sum('total')/students};
}
export function registrationProfiles(targetYear:number,semester:number,basis:'enrolled'|'registrants'='enrolled'){
 return [1,2,3,4].map(grade=>registrationProfile(targetYear,semester,grade,basis)).filter(p=>p!==null);
}
