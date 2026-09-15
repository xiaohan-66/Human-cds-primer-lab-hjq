import {MAX_TARGETS} from './limits';
import {chemistry} from '../quality/thermo';
import {compareQuality,reverseComplement} from '../primer';
import {XMLParser} from 'fast-xml-parser';
import type {DesignOptions,PositionedPair} from '../primer';
export type Transcript={accession:string;title:string;gene:string;protein:string;sequence:string;start:number;end:number;recommendation:string};
export type ItemData={records?:Transcript[];selected?:string;reason?:string;pairs?:PositionedPair[];total?:number;search?:import('./adaptive').SearchTrace;source?:string;fetchedAt?:number;warning?:string;error?:string};
export const defaults:DesignOptions={mode:'flanking',removeStop:false,tmMin:55,tmMax:65,upstream:100,downstream:100};
export function inputs(raw:unknown){if(typeof raw!=='string'||raw.length>10000)throw Error('请输入最多 50 个目标。');const list=[...new Set(raw.split(/[\r\n\t;；]+/).map(s=>s.trim().replace(/\s+/g,' ').toUpperCase()).filter(Boolean))];if(!list.length||list.length>MAX_TARGETS)throw Error('每批需包含 1–50 个不同目标，请将更多目标拆分为下一批。');if(list.some(s=>s.length>120||!/[A-Z0-9]/.test(s)||/[<>\[\]"]/g.test(s)))throw Error('目标名称格式不正确，每个名称最多 120 个字符。');return list;}
export function settings(raw:unknown):DesignOptions{const o=raw as DesignOptions;if(!o||!['exact','flanking'].includes(o.mode)||typeof o.removeStop!=='boolean'||![o.tmMin,o.tmMax].every(Number.isFinite)||o.tmMin<40||o.tmMax>80||o.tmMin>o.tmMax||![o.upstream,o.downstream].every(n=>Number.isInteger(n)&&n>=0&&n<=200))throw Error('参数无效：Tm 为 40–80 °C，两侧范围为 0–200 bp。');if(o.autoExpandRepeats!==undefined&&typeof o.autoExpandRepeats!=='boolean')throw Error('自动扩展设置无效。');return {autoExpandRepeats:o.autoExpandRepeats!==false,mode:o.mode,removeStop:o.mode==='exact'&&o.removeStop,tmMin:o.tmMin,tmMax:o.tmMax,upstream:o.upstream,downstream:o.downstream,thermo:chemistry(o.thermo)};}
export function parseRecords(xml:string):Transcript[]{
 if(/<!ENTITY/i.test(xml))throw Error('序列记录包含不支持的实体。');
 const doc=new XMLParser({ignoreAttributes:false,parseTagValue:false,isArray:name=>['GBSeq','GBFeature','GBQualifier'].includes(name)}).parse(xml);
 return (doc.GBSet?.GBSeq||[]).flatMap((r:any)=>{const f=(r['GBSeq_feature-table']?.GBFeature||[]).find((f:any)=>f.GBFeature_key==='CDS');const loc=f?.GBFeature_location||'';if(!/^\d+\.\.\d+$/.test(loc)||r.GBSeq_organism!=='Homo sapiens'||!/^NM_/.test(r['GBSeq_accession-version']))return [];const [start,end]=loc.split('..').map(Number);const q=(name:string)=>(f.GBFeature_quals?.GBQualifier||[]).find((q:any)=>q.GBQualifier_name===name)?.GBQualifier_value||'';const comment=String(r.GBSeq_comment||'');const recommendation=/MANE Select/i.test(comment)?'NCBI 注释标记 MANE Select':/RefSeq Select/i.test(comment)?'NCBI 注释标记 RefSeq Select':'';return [{accession:r['GBSeq_accession-version'],title:r.GBSeq_definition||'',gene:q('gene'),protein:q('protein_id'),sequence:String(r.GBSeq_sequence||'').toUpperCase(),start,end,recommendation}];});
}
export function choose(records:Transcript[],input:string){if(/^NM_\d+(\.\d+)?$/i.test(input)){const r=records.find(r=>input.includes('.')?r.accession===input:r.accession.split('.')[0]===input);if(!r)throw Error('未找到指定的转录本版本，请核对 accession。');return {selected:r.accession,reason:'按输入的 NM 转录本设计',confirmed:true};}if(records.length===1)return {selected:records[0].accession,reason:'检索返回唯一可用的已知 RefSeq 转录本',confirmed:true};const preferred=records.find(r=>r.recommendation.includes('MANE'))||records.find(r=>r.recommendation);return {selected:preferred?.accession||'',reason:preferred?preferred.recommendation+'；已自动选用，可单独调整亚型':'存在多个转录本，请确认目标基因和亚型',confirmed:Boolean(preferred)};}
export function five(pairs:PositionedPair[]){const ranked=[...pairs].sort(compareQuality);const seen=new Set<string>();const unique=ranked.filter(p=>{const key=p.forward.sequence+'|'+p.reverse.sequence;if(seen.has(key))return false;seen.add(key);return true;});const chosen:PositionedPair[]=[];for(const p of unique){if(chosen.every(q=>Math.abs(p.forward.end-q.forward.end)>=3||Math.abs(p.reverse.start-q.reverse.start)>=3))chosen.push(p);if(chosen.length===5)break;}for(const p of unique){if(chosen.length===5)break;if(!chosen.includes(p))chosen.push(p);}return chosen;}

/** Only the already retrieved same-gene transcripts. This is not a database-wide search. */
export function screenIsoforms(pairs:PositionedPair[],records:Transcript[],selected:Transcript){
 const others=records.filter(r=>r.accession!==selected.accession&&r.gene&&r.gene===selected.gene);
 const cache=new Map<string,number>();
 const position=(record:Transcript,s:string)=>{const key=record.accession+'|'+s;if(!cache.has(key))cache.set(key,record.sequence.indexOf(s));return cache.get(key)!;};
 for(const p of pairs){p.target={...p.target!,accession:selected.accession};p.isoformProducts=[];
  for(const record of others){const f=position(record,p.forward.sequence);if(f<0)continue;const r=record.sequence.indexOf(reverseComplement(p.reverse.sequence),f+p.forward.sequence.length);if(r<0)continue;const length=r+p.reverse.sequence.length-f;if(length<=50000)p.isoformProducts.push({accession:record.accession,length});}
  if(p.quality)p.quality.ranking.unshift('已获取同基因其他转录本全匹配配对 '+p.isoformProducts.length+' 个（局部筛查）');
 }
 return pairs;
}
