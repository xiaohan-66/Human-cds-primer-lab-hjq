import type {CheckResult} from './core';
import type {GeneAnnotation} from './annotation';
export function classifyPairs(result:CheckResult,annotations:Record<string,GeneAnnotation>):CheckResult{
 const ev=result.evaluation!,target=annotations[result.accession],genomic=ev.database==='refseq_genomic';let sameGene=0,otherGene=0,sameTranscript=0,unknown=0,high=0,medium=0,low=0;
 const products=result.products.map(p=>{const a=annotations[p.accession],predicted=/^X[MR]_/.test(p.accession);let relation:'same_gene'|'other_gene'|'unknown'=target?.geneId&&a?.geneId?(target.geneId===a.geneId?'same_gene':'other_gene'):'unknown';
  let classification:import('./classification').GeneClass=p.expected?'expected':genomic?'genomic':p.accession===result.accession?'same_transcript_other_product':predicted?'predicted':relation==='same_gene'?'same_gene_isoform':relation==='other_gene'?'other_gene':'unknown';
  if(!p.expected){if(classification==='same_transcript_other_product')sameTranscript++;else if(relation==='same_gene')sameGene++;else if(relation==='other_gene')otherGene++;else if(!genomic)unknown++;}
  const pair=p.pair!;const factor=p.expected?0:relation==='same_gene'&&classification!=='same_transcript_other_product'?.55:genomic?.75:relation==='unknown'&&classification!=='same_transcript_other_product'?.7:1;
  // Recompute from alignment evidence, never compound weights when annotation is refreshed.
  const scoreBase=(h:typeof pair.left)=>Math.max(0,100-12*h.total-18*h.last8-25*h.last5-(h.terminal?35:0)-40*(1-h.coverage));
  const lengthFactor=p.length<=2000?1:p.length<=5000?.9:p.length<=10000?.65:.35;
  let score=Math.min(scoreBase(pair.left),scoreBase(pair.right))*lengthFactor*factor;
  const hard=!p.expected&&(relation==='other_gene'||genomic||classification==='same_transcript_other_product')&&p.length<=5000&&[pair.left,pair.right].every(h=>h.coverage===1&&h.gaps===0&&h.last5===0&&h.total<=1);if(hard)score=Math.max(80,score);
  const risk=p.expected?'none':score>=80?'high':score>=60?'medium':score>=35?'low':score>0?'very_low':'none';
  if(!p.expected&&(relation==='other_gene'||genomic||classification==='same_transcript_other_product')){if(risk==='high')high++;else if(risk==='medium')medium++;else low++;}
  const reasons=pair.reasons.filter(s=>!s.includes('按高风险处理')&&!s.startsWith('归属权重'));
  reasons.push(hard?'两侧 3′5 nt 全匹配、总错配均 ≤1，且产物 ≤5 kb，按高风险处理':`归属权重 ${factor}；结合错配与产物长度计算风险，分值 ${Math.round(score*10)/10}`);
  return {...p,classification,predicted,geneRelation:relation,gene:a?.gene,geneId:a?.geneId,annotationSource:a?.source,annotationTime:a?.fetchedAt,pair:{...pair,reasons,score:Math.round(score*10)/10,risk: risk as typeof pair.risk}};
 });
 const targetValid=genomic?result.target?.status==='matched':result.expectedFound&&result.target?.status!=='mismatch';
 const grade:typeof ev.grade=!targetValid||ev.pairingLimited?null:high?'D':medium||low||unknown?'C':sameGene?'B':'A';
 const messages:string[]=[];
 if(!targetValid)messages.push(genomic?'目标 cDNA 模板校验未通过，无法评级。':'目标产物尚未在本次返回记录中形成，暂不评级；请核对搜索与模板，不能推断引物无法扩增。');
 if(unknown)messages.push('部分非目标产物尚无可靠 Gene ID，归入 C 类待复核，不能当作无其他基因命中。');
 if(ev.pairingLimited)messages.push('配对计算或产物保存达到安全上限，分析未完成，暂不评级。');
 const nonTarget=result.productCount-products.filter(p=>p.expected).length;
 messages.push(nonTarget?`已检记录中发现 ${nonTarget} 个非目标潜在 PCR 产物。`:'已检记录中未发现非目标 PCR 产物。');
 if(ev.coverage==='limited')messages.push('候选结合位点搜索或产物展示达到上限，覆盖度有限；该警告不参与特异性评级。');
 if(ev.coverage==='unknown')messages.push('无法核验人源搜索范围；评级仅描述已返回的人源记录。');
 return {...result,products,evaluation:{...ev,grade,validation:!targetValid?'invalid':ev.pairingLimited?'review':'valid',high,medium,low,unassigned:unknown,messages},summary:{expected:result.expectedFound,otherPairs:nonTarget>0,incomplete:ev.coverage!=='complete'||ev.pairingLimited,sameGene,otherGene,sameTranscript,unknown,reasons:messages}};
}
