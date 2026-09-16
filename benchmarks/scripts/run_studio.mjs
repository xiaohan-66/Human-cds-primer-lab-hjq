import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import {designTranscript} from '../../lib/primer.ts';
import {settings,defaults,five} from '../../lib/batch/core.ts';
import {adaptiveDesign} from '../../lib/batch/adaptive.ts';
const inputPath=process.env.PRIMER_BENCHMARK_RECORDS || 'benchmarks/data/records.json';
const outputDir=process.env.PRIMER_BENCHMARK_OUT || 'benchmarks/results';
const records=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const onlyExact=process.argv.includes('--exact-only');
const results=[];
for(const record of records){
  for(const mode of (onlyExact?['exact']:['exact','adaptive'])){
    const options=settings({...defaults,mode:mode==='exact'?'exact':'flanking',removeStop:false});
    const start=performance.now();let outcome;
    try {
      const result=mode==='exact'?designTranscript(record.sequence,record.start,record.end,options):adaptiveDesign(record,[record],options);
      const pairs=five(result.pairs);
      outcome={status:pairs.length?'candidates':'no_candidates',pairs,search:result.search||null};
    }catch(error){outcome={status:String(error.message).includes('没有合适候选')?'no_candidates':'error',error:String(error.message),pairs:[]};}
    results.push({gene:record.gene,accession:record.accession,mode,options,elapsed_ms:performance.now()-start,...outcome});
  }
  console.log(record.gene,results.at(-1).status);
}
fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(`${outputDir}/studio.json`,JSON.stringify({node:process.version,generated_at:new Date().toISOString(),results},null,2)+'\n');
