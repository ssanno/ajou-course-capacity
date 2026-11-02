import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath,pathToFileURL } from 'node:url';
import ts from 'typescript';

export const projectRoot=fileURLToPath(new URL('../',import.meta.url));
export const engineModules=['course-catalog-data','course-compatibility','university-foundation-data','university-foundation','course-observation-data','course-learning','registration-data','registration-profile','model','planning','academic-policy','official-offerings','school-curriculum','prediction-record','capacity-export'];

// Compile the same TypeScript files used by the web UI, without importing a browser or server runtime.
export async function loadEngine(){
  const sources=await Promise.all(engineModules.map(async name=>({name,source:await fs.readFile(path.join(projectRoot,'lib',name+'.ts'),'utf8')})));
  const fingerprint=createHash('sha256').update(ts.version).update(JSON.stringify(sources)).digest('hex').slice(0,20);
  const directory=path.join(projectRoot,'.capacity-runtime',fingerprint);
  await fs.mkdir(directory,{recursive:true});
  for(const {name,source} of sources){
    const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText
      .replace(/from '(\.\/[^']+)'/g,"from '$1.js'");
    const target=path.join(directory,name+'.js');
    let unchanged=false;try{unchanged=(await fs.readFile(target,'utf8'))===compiled;}catch{}
    if(!unchanged)await fs.writeFile(target,compiled);
  }
  const model=await import(pathToFileURL(path.join(directory,'model.js')));
  const records=await import(pathToFileURL(path.join(directory,'prediction-record.js')));
  const planning=await import(pathToFileURL(path.join(directory,'planning.js')));
  const csv=await import(pathToFileURL(path.join(directory,'capacity-export.js')));
  return {...model,...records,...planning,...csv};
}
