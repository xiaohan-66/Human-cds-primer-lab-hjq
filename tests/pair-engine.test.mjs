import assert from 'node:assert/strict';
import fs from 'node:fs';
import {normalizeHit,pairSites,evaluateReport,productRisk} from '../lib/blast/pair-engine.ts';
import {classify} from '../lib/blast/classification.ts';
import {compareVerification} from '../lib/blast/ranking.ts';
const f='ACGTCAGTACGATCGTAGCA',r='TGCACTAGCATGACGTACGA';
const p={itemId:'a',rank:1,input:'TEST',accession:'NM_001.1',forward:f,reverse:r,productLength:759};
function site(type,start,strand,accession=p.accession,mutation=[]){const seq=type==='F'?f:r;let subject=[...seq];for(const i of mutation)subject[i]=subject[i]==='A'?'C':'A';return normalizeHit(seq,type,{query_from:1,query_to:20,qseq:seq,hseq:subject.join(''),hit_from:strand==='+'?start:start+19,hit_to:strand==='+'?start+19:start},{accession,title:'RNA',taxid:9606},100000);}
const target=[site('F',1,'+'),site('R',740,'-')];let pairs=pairSites(target,p,20000);assert.equal(pairs.products.length,1);assert.equal(pairs.products[0].expected,true);assert.equal(pairs.products[0].length,759);
assert.equal(pairSites([site('F',1,'-'),site('R',740,'+')],p,20000).products.length,0);
assert.equal(pairSites([site('F',1,'+'),site('R',740,'+')],p,20000).products.length,0);
assert.equal(pairSites([site('F',1,'+','NM_A'),site('R',740,'-','NM_B')],p,20000).products.length,0);
assert.equal(pairSites([site('F',1,'+'),site('R',30000,'-')],p,20000).products.length,0);
assert.equal(pairSites([site('F',1,'+'),site('R',10,'-')],p,20000).products.length,0);
for(const type of ['F','R']){const v=pairSites([site(type,1,'+'),site(type,681,'-'),site(type,1,'+')],p,20000);assert.equal(v.products.length,1);assert.equal(v.products[0].pair.pairType,type+'-'+type);assert.equal(v.products[0].expected,false);}
const high=productRisk(site('F',1,'+','NM_OTHER'),site('R',681,'-','NM_OTHER'),700);assert.equal(high.risk,'high');
const low=productRisk(site('F',1,'+','NM_OTHER',[18,19]),site('R',681,'-','NM_OTHER',[18,19]),700);assert.ok(low.score<high.score);assert.equal(low.left.last5,2);assert.equal(low.right.last8,2);assert.equal(low.right.terminal,true);
const partial=normalizeHit(f,'F',{query_from:1,query_to:15,qseq:f.slice(0,15),hseq:f.slice(0,15),hit_from:100,hit_to:114},{accession:'NM_PART'},1000);assert.equal(partial.coverage,.75);assert.equal(partial.last5,5);assert.equal(partial.terminalUnknown,true);assert.equal(partial.end,119);
const rc=s=>[...s].reverse().map(x=>({A:'T',T:'A',G:'C',C:'G'})[x]).join('');const rev=normalizeHit(f,'F',{query_from:20,query_to:1,qseq:rc(f),hseq:rc(f),hit_from:100,hit_to:119},{accession:'NM_REV'},1000);assert.equal(rev.strand,'-');assert.equal(rev.total,0);
function report(suffix,seq,hits){return {report:{program:'blastn',search_target:{db:'refseq_rna'},params:{entrez_query:'txid9606[ORGN]'},results:{search:{query_title:'p0_'+suffix,query_len:20,hits}}}};}
const rawHit=(seq,start,strand,accession=p.accession)=>({description:[{accession,taxid:9606}],len:10000,hsps:[{query_from:1,query_to:20,qseq:seq,hseq:seq,hit_from:strand==='+'?start:start+19,hit_to:strand==='+'?start+19:start}]});
const raw={BlastOutput2:[report('F',f,[rawHit(f,1,'+')]),report('R',r,[rawHit(r,740,'-')])]};const chunk={pairs:[p],engineVersion:'2.0',database:'refseq_rna',hitLimit:500};
let res=classify(evaluateReport(raw,chunk,20000)[0],{});assert.equal(res.evaluation.grade,'A');
const capped=structuredClone(raw);capped.BlastOutput2[0].report.results.search.hits=Array.from({length:500},()=>raw.BlastOutput2[0].report.results.search.hits[0]);const limited=classify(evaluateReport(capped,chunk,20000)[0],{});assert.equal(limited.evaluation.coverage,'limited');assert.equal(limited.evaluation.grade,'A');assert.equal(compareVerification(res,limited),0);
const missing=structuredClone(raw);missing.BlastOutput2[0].report.results.search.hits=[];assert.equal(classify(evaluateReport(missing,chunk,20000)[0],{}).evaluation.grade,null);assert.throws(()=>evaluateReport({BlastOutput2:[]},chunk,20000));
raw.BlastOutput2[0].report.results.search.hits.push(rawHit(f,10,'+','NM_ALT.1'));raw.BlastOutput2[1].report.results.search.hits.push(rawHit(r,690,'-','NM_ALT.1'));
const annotations={'NM_001.1':{geneId:'1',gene:'GENE'},'NM_ALT.1':{geneId:'1',gene:'GENE'}};res=classify(evaluateReport(raw,chunk,20000)[0],annotations);assert.equal(res.evaluation.grade,'B');assert.equal(res.products[1].classification,'same_gene_isoform');annotations['NM_ALT.1'].geneId='2';res=classify(evaluateReport(raw,chunk,20000)[0],annotations);assert.equal(res.evaluation.grade,'D');assert.equal(res.products[1].classification,'other_gene');assert.equal(res.evaluation.high,1);
assert.deepEqual(classify(res,annotations).products.map(p=>p.pair.score),res.products.map(p=>p.pair.score));
const graw=structuredClone(raw);for(const x of graw.BlastOutput2)x.report.search_target.db='refseq_genomic';const genomic=classify(evaluateReport(graw,{...chunk,database:'refseq_genomic',pairs:[{...p,target:{status:'matched'}}]},20000)[0],{});assert.equal(genomic.evaluation.database,'refseq_genomic');assert.ok(genomic.products.some(p=>p.classification==='genomic'));
console.log('PASS 2.0: orientation/accession/length, F-F/R-R dedup, 3prime penalties and reverse strand, partial coverage, cap independent of A grade, missing target, GeneID B/D grades, genomic mode, idempotent scoring.');
if(fs.existsSync('outputs/live-five-human.json')){const c=JSON.parse(fs.readFileSync('outputs/live-five-cases.json','utf8'));const live=evaluateReport(JSON.parse(fs.readFileSync('outputs/live-five-human.json','utf8')),{...c,engineVersion:'2.0',database:'refseq_rna'},20000);assert.ok(live.every(r=>r.expectedFound));for(const r of live)console.log(r.input,'expected',r.expectedFound,'products',r.productCount,'pairingLimited',r.evaluation.pairingLimited);}
