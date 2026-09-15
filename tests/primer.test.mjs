import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {design,reverseComplement} from '../lib/primer.ts';
const fixtures=JSON.parse(readFileSync(new URL('./ncbi-fixtures.json',import.meta.url),'utf8').replace(/^\uFEFF/,'')).filter(x=>x.accession.startsWith('NM_'));
let passed=0,empty=0;
for(const f of fixtures)for(const remove of [false,true])for(const [lo,hi] of [[55,65],[45,75]]){
 const template=remove?f.cds.slice(0,-3):f.cds;
 const expected=[];
 const tm=s=>64.9+41*((s.match(/[GC]/g)||[]).length-16.4)/s.length;
 for(let a=18;a<=25;a++)for(let b=18;b<=25;b++){const x=tm(template.slice(0,a)),y=tm(template.slice(-b));if(x>=lo&&x<=hi&&y>=lo&&y<=hi&&Math.abs(x-y)<=3)expected.push(a+','+b);}
 if(!expected.length){assert.throws(()=>design(f.cds,remove,lo,hi),/没有合适候选/);empty++;continue;}
 const pairs=design(f.cds,remove,lo,hi);
 assert.deepEqual(pairs.map(p=>p.forward.sequence.length+','+p.reverse.sequence.length).sort(),expected.sort());
 for(const p of pairs){assert.ok(f.cds.startsWith(p.forward.sequence));assert.ok(template.endsWith(reverseComplement(p.reverse.sequence)));assert.equal(p.productLength,template.length);for(const primer of [p.forward,p.reverse]){assert.ok(primer.sequence.length<=25);assert.ok(primer.tm>=lo&&primer.tm<=hi);}}
 assert.ok(pairs.every((p,i)=>!i||p.score>=pairs[i-1].score));
 const edge=pairs[0];assert.ok(design(f.cds,remove,Math.min(edge.forward.tm,edge.reverse.tm),Math.max(edge.forward.tm,edge.reverse.tm)).some(p=>p.forward.sequence===edge.forward.sequence&&p.reverse.sequence===edge.reverse.sequence));passed++;
}
for(const [lo,hi] of [[65,55],[NaN,65],[55,Infinity],[39,65],[55,81]])assert.throws(()=>design(fixtures[0].cds,true,lo,hi),/范围/);
assert.throws(()=>design('ATGNNNTAA',true,55,65));
assert.equal(reverseComplement('ATGCCGTA'),'TACGGCAT');
console.log({passed,empty,total:passed+empty});
