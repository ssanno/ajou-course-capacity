import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadEngine,projectRoot} from '../scripts/runtime.mjs';

const cli=fileURLToPath(new URL('../scripts/capacity.mjs',import.meta.url));
const example=JSON.parse(await fs.readFile(new URL('../examples/example-plan.json',import.meta.url),'utf8'));
const engine=await loadEngine();
const run=(...args)=>execFileSync(process.execPath,[cli,...args],{cwd:projectRoot,encoding:'utf8'});
const temporary=async t=>{const directory=await fs.mkdtemp(path.join(os.tmpdir(),'capacity-test-'));t.after(()=>fs.rm(directory,{recursive:true,force:true}));return directory;};

test('CLI output preserves compulsory coverage, section totals and exact engine CSV',async t=>{
  const directory=await temporary(t),output=path.join(directory,'result');
  const summary=JSON.parse(run('forecast','--input','examples/example-plan.json','--output',output));
  assert.equal(summary.courseCount,3);
  const record=engine.predictionRecordSchema.parse(JSON.parse(await fs.readFile(summary.files.prediction,'utf8')));
  assert.equal(record.storage,'local-file');
  assert.equal(record.modelVersion,engine.MODEL_VERSION);
  assert.deepEqual(record.results.find(r=>r.code==='EX-R1').sections,[{id:'1',capacity:41},{id:'2',capacity:40}]);
  assert.deepEqual(record.results.find(r=>r.code==='EX-R2').sections,[{id:'1',capacity:27},{id:'2',capacity:27},{id:'3',capacity:27}]);
  const rows=engine.forecast(record.input).filter(r=>r.enabled&&r.course.semester===2);
  for(const row of record.results){if(row.capacity!==null)assert.equal(row.sections.reduce((s,r)=>s+r.capacity,0),row.capacity);}
  assert.equal(await fs.readFile(summary.files.capacity,'utf8'),engine.capacityCsv(record.input,rows));
  assert.equal(record.input.validation,undefined);
  assert.deepEqual(record.input.history,[]);
});

test('validation rejects missing headcounts and duplicate courses before writing results',async t=>{
  const directory=await temporary(t),input=path.join(directory,'invalid.json'),output=path.join(directory,'never-created');
  const plan=structuredClone(example);plan.studentCounts[1]=null;
  await fs.writeFile(input,JSON.stringify(plan));
  let result=spawnSync(process.execPath,[cli,'forecast','--input',input,'--output',output],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/모두 입력/);
  await assert.rejects(fs.access(output));
  plan.studentCounts[1]=81;plan.curriculum.push({...plan.curriculum[0]});
  await fs.writeFile(input,JSON.stringify(plan));
  result=spawnSync(process.execPath,[cli,'validate','--input',input],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/중복/);
});

test('off-term unknown demand is exported as null and confirmation, not false zero',async t=>{
  const directory=await temporary(t),input=path.join(directory,'off-term.json'),output=path.join(directory,'result');
  const plan=structuredClone(example);
  plan.curriculum=[{...plan.curriculum[2],recommendedSemesters:[1],share:0}];
  plan.overrides={[engine.rowKey(plan.curriculum[0])]:{enabled:true,sections:1}};
  await fs.writeFile(input,JSON.stringify(plan));
  run('forecast','--input',input,'--output',output);
  const record=JSON.parse(await fs.readFile(path.join(output,'prediction.json'),'utf8'));
  assert.equal(record.results[0].demand,null);assert.equal(record.results[0].capacity,null);
  assert.equal(record.results[0].sections[0].capacity,null);
  assert.match(await fs.readFile(path.join(output,'capacity.csv'),'utf8'),/확인 필요/);
});

test('existing results are preserved unless overwrite is explicitly requested',async t=>{
  const directory=await temporary(t),output=path.join(directory,'result');
  run('forecast','--input','examples/example-plan.json','--output',output);
  const before=await fs.readFile(path.join(output,'prediction.json'),'utf8');
  const result=spawnSync(process.execPath,[cli,'forecast','--input','examples/example-plan.json','--output',output],{encoding:'utf8'});
  assert.notEqual(result.status,0);assert.match(result.stderr,/기존 결과/);
  assert.equal(await fs.readFile(path.join(output,'prediction.json'),'utf8'),before);
});

test('current-year validation labels do not change forecasts; CSV cells cannot inject formulas',async t=>{
  const plan=structuredClone(example),c=plan.curriculum[0];
  plan.validation={year:2026,semester:2,filename:'synthetic-validation.json',importedAt:'2026-11-02T00:00:00.000Z',actuals:[{code:c.code,name:c.name,year:2026,semester:2,section:'1',capacity:999,enrolled:999}],omitted:0};
  const a=engine.createPredictionRecord(example,'c82081ac-9db3-46cc-a7d3-4b94e3df472a','2026-11-02T00:00:00.000Z','local-file');
  const b=engine.createPredictionRecord(plan,a.id,a.createdAt,'local-file');
  assert.deepEqual(a.results,b.results);
  assert.equal(b.input.validation,undefined);
  assert.equal(engine.csvText([['=2+2']]),'\uFEFF"\'=2+2"');
});

test('public source has no shared-record server endpoints or cloud storage dependency',async()=>{
  for(const name of ['plans','predictions']){
    const source=await fs.readFile(new URL(`../app/api/${name}/route.ts`,import.meta.url),'utf8');
    assert.match(source,/status:403/);assert.doesNotMatch(source,/cloudflare|SELECT|INSERT|UPDATE|env\./);
  }
  assert.equal((await fs.readFile(new URL('../lib/site-mode.ts',import.meta.url),'utf8')).includes("SITE_MODE = 'browser'"),true);
});
