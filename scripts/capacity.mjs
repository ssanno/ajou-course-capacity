#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const usage=`수강정원 산출 도구

  node scripts/capacity.mjs validate --input plan.json
  node scripts/capacity.mjs forecast --input plan.json --output results/my-plan

  --input       웹서비스에서 내려받거나 입력 양식에 맞춰 작성한 계획 JSON
  --output      prediction.json과 capacity.csv를 저장할 폴더
  --overwrite   기존 결과 파일을 덮어쓸 때만 명시
  --help        사용법 표시 (설치·설정 변경 없음)

자료가 부족하면 오류 또는 '확인 필요'로 표시합니다. 계산에 AI API를 사용하지 않습니다.
`;

async function main(){
  const args=process.argv.slice(2);
  if(!args.length||args.includes('--help')||args.includes('-h')){console.log(usage);return;}
  const command=args.shift();if(!['validate','forecast'].includes(command))throw Error('validate 또는 forecast 명령을 선택해주세요. --help로 사용법을 확인할 수 있습니다.');
  const options={};
  while(args.length){
    const flag=args.shift();
    if(flag==='--overwrite'){if(options.overwrite)throw Error('중복 옵션: --overwrite');options.overwrite=true;continue;}
    if(!['--input','--output'].includes(flag))throw Error('알 수 없는 옵션: '+flag);
    const key=flag.slice(2),value=args.shift();if(!value||value.startsWith('--')||options[key])throw Error('옵션 값을 확인해주세요: '+flag);options[key]=value;
  }
  if(!options.input)throw Error('--input 계획 JSON 파일을 지정해주세요.');
  if(command==='forecast'&&!options.output)throw Error('--output 결과 폴더를 지정해주세요.');
  const inputPath=path.resolve(options.input),inputInfo=await fs.stat(inputPath);
  if(!inputInfo.isFile()||inputInfo.size>6*1024*1024)throw Error('6MB 이내의 계획 JSON 파일을 선택해주세요.');
  let raw;try{raw=JSON.parse(await fs.readFile(inputPath,'utf8'));}catch{throw Error('계획 파일이 올바른 JSON인지 확인해주세요.');}
  if(raw?.format==='ajou-capacity-prediction')throw Error('예측 기록이 아닌 계획 JSON을 입력해주세요. 웹서비스의 불러오기 → 현재 계획 파일 저장을 이용하세요.');
  const {loadEngine}=await import('./runtime.mjs');
  const engine=await loadEngine(),parsed=engine.planSchema.safeParse(raw);
  if(!parsed.success)throw Error(parsed.error.issues.map(i=>`${i.path.join('.')||'입력'}: ${i.message}`).join('\n'));
  const record=engine.createPredictionRecord(parsed.data,randomUUID(),new Date().toISOString(),'local-file');
  if(command==='validate'){console.log(JSON.stringify({valid:true,name:record.input.name,year:record.input.planningYear,semester:record.input.planningSemester,courseCount:record.results.length,modelVersion:record.modelVersion},null,2));return;}
  const directory=path.resolve(options.output),jsonPath=path.join(directory,'prediction.json'),csvPath=path.join(directory,'capacity.csv');
  if([jsonPath,csvPath].includes(inputPath))throw Error('입력 파일과 결과 파일의 경로가 같습니다. 다른 결과 폴더를 선택해주세요.');
  if(!options.overwrite){for(const filename of [jsonPath,csvPath]){try{await fs.access(filename);}catch(e){if(e.code==='ENOENT')continue;throw e;}throw Error('기존 결과가 있습니다. 다른 폴더를 선택하거나 --overwrite를 명시해주세요: '+filename);}}
  const rows=engine.forecast(record.input).filter(r=>r.enabled&&r.course.semester===record.input.planningSemester);
  await fs.mkdir(directory,{recursive:true});
  await fs.writeFile(jsonPath,JSON.stringify(record,null,2)+'\n',{flag:options.overwrite?'w':'wx'});
  await fs.writeFile(csvPath,engine.capacityCsv(record.input,rows),{flag:options.overwrite?'w':'wx'});
  console.log(JSON.stringify({success:true,modelVersion:record.modelVersion,courseCount:record.results.length,files:{prediction:jsonPath,capacity:csvPath}},null,2));
}

main().catch(error=>{console.error(error instanceof Error?error.message:String(error));process.exitCode=1;});
