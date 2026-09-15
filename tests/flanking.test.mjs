import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {designTranscript,design,reverseComplement} from '../lib/primer.ts';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url),'utf8').replace(/^\uFEFF/,''));
const fixtures=read('./ncbi-fixtures.json').filter(f=>f.accession.startsWith('NM_'));
const native=read('./transcript-fixture.json');
const opts={mode:'flanking',removeStop:false,tmMin:55,tmMax:65,upstream:100,downstream:100};
function check(seq,start,end,o){const r=designTranscript(seq,start,end,o);assert.ok(r.total>=r.pairs.length);assert.ok(r.pairs.length<=100);for(const p of r.pairs){assert.ok(p.productStart>=1&&p.productEnd<=seq.length);assert.ok(p.productStart<=start&&p.productEnd>=end);assert.equal(p.productLength,p.productEnd-p.productStart+1);const product=seq.slice(p.productStart-1,p.productEnd);assert.equal(product.slice(start-p.productStart,end-p.productStart+1),seq.slice(start-1,end));assert.ok(product.startsWith(p.forward.sequence));assert.ok(product.endsWith(reverseComplement(p.reverse.sequence)));assert.equal(seq.slice(p.forward.start-1,p.forward.end),p.forward.sequence);assert.equal(reverseComplement(seq.slice(p.reverse.start-1,p.reverse.end)),p.reverse.sequence);assert.equal(p.upstream,start-p.productStart);assert.equal(p.downstream,p.productEnd-end);assert.ok(p.upstream<=o.upstream&&p.downstream<=o.downstream);for(const x of [p.forward,p.reverse]){assert.ok(x.sequence.length>=18&&x.sequence.length<=25);assert.ok(x.tm>=o.tmMin&&x.tm<=o.tmMax);}assert.ok(Math.abs(p.forward.tm-p.reverse.tm)<=3);assert.equal(p.removeStop,false);}return r;}
const real=check(native.sequence,native.start,native.end,opts);assert.ok(real.pairs.some(p=>p.upstream>0||p.downstream>0));
const before='ACGTGCTACGATCGTAGCTAGCTACGATCGTACGCTAGCT'.repeat(3),after='GCTAGCGTACGATCGCTAGCTACGTAGCTAGCATCGTACG'.repeat(3);
for(const f of fixtures){const seq=before+f.cds+after;check(seq,before.length+1,before.length+f.cds.length,opts);}
const minimal=fixtures.find(f=>f.gene==='ASPSCR1').cds;
const clipped=check(minimal,1,minimal.length,{...opts,tmMin:40,tmMax:80});assert.equal(clipped.searchedUpstream,0);assert.equal(clipped.searchedDownstream,0);
const zero=check(native.sequence,native.start,native.end,{...opts,tmMin:40,tmMax:80,upstream:0,downstream:0});assert.ok(zero.pairs.every(p=>p.upstream===0&&p.downstream===0));assert.equal(zero.total,design(native.sequence.slice(native.start-1,native.end),false,40,80).length);
const exact=designTranscript(native.sequence,native.start,native.end,{...opts,mode:'exact',removeStop:true,tmMin:40,tmMax:80});for(const p of exact.pairs){assert.equal(p.productStart,native.start);assert.equal(p.productEnd,native.end-3);assert.equal(p.removeStop,true);assert.equal(p.upstream+p.downstream,0);}
const max=check(native.sequence,native.start,native.end,{...opts,tmMin:40,tmMax:80,upstream:200,downstream:200});assert.equal(max.pairs.length,100);assert.ok(max.total>100);
for(const change of [{removeStop:true},{upstream:-1},{downstream:201},{upstream:NaN},{downstream:1.5},{mode:'invalid'}])assert.throws(()=>designTranscript(native.sequence,native.start,native.end,{...opts,...change}));
assert.throws(()=>designTranscript(native.sequence,0,native.end,opts));
console.log({nativeTranscript:native.accession,totalCandidates:real.total,retained:real.pairs.length,syntheticUtrCases:fixtures.length,boundaryAndModeChecks:'passed'});
