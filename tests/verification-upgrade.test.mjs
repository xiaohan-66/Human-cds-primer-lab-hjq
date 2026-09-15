import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseRecords,screenIsoforms,five,settings} from '../lib/batch/core.ts';
import {designTranscript,reverseComplement,compareQuality} from '../lib/primer.ts';
import {checkTarget} from '../lib/blast/target.ts';
import {parseReport,chunks} from '../lib/blast/core.ts';
import {classify} from '../lib/blast/classification.ts';
import {compareVerification} from '../lib/blast/ranking.ts';
const records=parseRecords(fs.readFileSync('tests/five-transcripts.xml','utf8'));
const sequences=[['ATGGAGCGGAAAGTGCTT','GAAAAGGGAAGAGGAAAATGCT',2047],['AGCCATCACTGCCGTTGCC','CACTTGTGCTACGGCTACCAAACA',1576],['GTTTGGTGCGGACCTGGTA','GGTTCCCTTTTCAGTAGACACCT',360],['GCGGGAAAAGTAAAAGATGTC','CTACATTCCCCAGCCAGA',1261],['GCGCCTAAGAGGTCAGACT','TGATTTGGCAATTACCTTCCACTAT',2970]];
const cases=records.map((r,i)=>{const [f,rev,length]=sequences[i],a=r.sequence.indexOf(f)+1,b=r.sequence.indexOf(reverseComplement(rev))+1;const p={forward:{sequence:f,start:a,end:a+f.length-1},reverse:{sequence:rev,start:b,end:b+rev.length-1},productStart:a,productEnd:b+rev.length-1,productLength:length,removeStop:false};const target=checkTarget(r.sequence,r.start,r.end,p,r.accession);assert.equal(target.status,'matched');assert.equal(target.cdsCovered,true);assert.equal(checkTarget(r.sequence,r.start,r.end,{...p,productLength:length+1}).status,'mismatch');assert.equal(checkTarget(r.sequence,r.start,r.end,{...p,reverse:{...p.reverse,sequence:f}}).status,'mismatch');return {itemId:r.gene,input:r.gene,rank:1,accession:r.accession,forward:f,reverse:rev,productLength:length,target};});
for(const r of records){const o=settings({mode:'flanking',removeStop:false,tmMin:55,tmMax:65,upstream:100,downstream:100});const d=designTranscript(r.sequence,r.start,r.end,{...o,diverse:true});const pairs=five(screenIsoforms(d.pairs,records,r));assert.ok(pairs.length>0&&pairs.length<=5);for(const p of pairs){assert.equal(p.target.status,'matched');assert.ok(p.productStart<=r.start&&p.productEnd>=r.end);for(const q of [p.forward,p.reverse])assert.ok(q.sequence.length<=25&&q.tm>=55&&q.tm<=65);}console.log(r.gene,pairs[0].forward.sequence,pairs[0].reverse.sequence,pairs[0].productLength);}
const p=cases[0],c={...chunks([p])[0],scope:'human',hitLimit:500};
const hit=(s,from,to,taxid=9606)=>({description:[{accession:p.accession,taxid}],hsps:[{query_from:1,query_to:s.length,align_len:s.length,identity:s.length,gaps:0,qseq:s,hseq:s,hit_from:from,hit_to:to}]});
const report=(suffix,s,hits)=>({report:{program:'blastn',search_target:{db:'refseq_rna'},params:{entrez_query:'txid9606[ORGN]'},results:{search:{query_title:'p0_'+suffix,query_len:s.length,hits}}}});
const raw={BlastOutput2:[report('F',p.forward,[hit(p.forward,43,60)]),report('R',p.reverse,[hit(p.reverse,2089,2068)])]};
let r=classify(parseReport(raw,c,20000)[0],{});assert.equal(r.expectedFound,true);assert.equal(r.evidence.scope,'human_confirmed');assert.equal(r.summary.incomplete,false);
const legacy=structuredClone(raw);delete legacy.BlastOutput2[0].report.params;legacy.BlastOutput2[0].report.results.search.hits=[];
r=classify(parseReport(legacy,c,20000)[0],{});assert.equal(r.target.status,'matched');assert.equal(r.expectedFound,false);assert.equal(r.summary.incomplete,true);assert.equal(r.evidence.scope,'unconfirmed');assert.ok(r.summary.reasons.some(s=>s.includes('不能据此判定引物失效')));
const foreign=structuredClone(raw);foreign.BlastOutput2[0].report.results.search.hits[0].description[0].taxid=10090;assert.equal(parseReport(foreign,c,20000)[0].evidence.scope,'unconfirmed');
const capped=structuredClone(raw);capped.BlastOutput2[0].report.results.search.hits=Array.from({length:500},()=>raw.BlastOutput2[0].report.results.search.hits[0]);assert.equal(parseReport(capped,c,20000)[0].evidence.truncated,true);
const good=classify(parseReport(raw,c,20000)[0],{}),bad={...good,summary:{...good.summary,otherGene:1}};assert.ok(compareVerification(good,bad)<0);assert.equal(compareVerification(good,{...good,rank:2}),-1);
// Stop removal is deliberate, not a false CDS coverage failure.
const t=records[0],exact=designTranscript(t.sequence,t.start,t.end,{mode:'exact',removeStop:true,tmMin:40,tmMax:80,upstream:0,downstream:0});assert.equal(exact.pairs[0].target.stopRemoved,true);assert.equal(exact.pairs[0].target.status,'matched');
console.log('PASS: five real templates, orientation/length corruption, deliberate stop removal, human scope fail-closed, truncation, remote omission independent of target, ranking.');
