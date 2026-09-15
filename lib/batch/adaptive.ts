import {designTranscript,hasRepeat,type DesignOptions,type PositionedPair} from '../primer';
import {pairQuality,defaultChemistry} from '../quality/thermo';
import {five,screenIsoforms,type Transcript} from './core';
export type SearchTrace={status:'disabled'|'exact'|'not_needed'|'replaced'|'unresolved';initialUp:number;initialDown:number;searchedUp:number;searchedDown:number;rounds:number;message:string;version?:number;triggers?:string[];remaining?:string[]};
export const repeatedPair=(p:PositionedPair)=>hasRepeat(p.forward.sequence)||hasRepeat(p.reverse.sequence);
export function qualityIssues(p:PositionedPair){
 const issues:string[]=[];
 for(const [name,primer] of [['F',p.forward],['R',p.reverse]] as const){if(primer.gc<35||primer.gc>65)issues.push(`${name} GC 偏离 35–65%`);if(hasRepeat(primer.sequence))issues.push(`${name} 连续重复碱基`);}
 const quality=p.quality||pairQuality(p.forward.sequence,p.reverse.sequence,defaultChemistry);
 return [...issues,...quality.reasons];
}
export function adaptiveDesign(selected:Transcript,records:Transcript[],o:DesignOptions){
 let original:PositionedPair[]=[],total=0,initialError='';
 try{const initial=designTranscript(selected.sequence,selected.start,selected.end,{...o,diverse:true});original=five(screenIsoforms(initial.pairs,records,selected));total=initial.total;}
 catch(e){if(!(e instanceof Error)||!e.message.includes('没有合适候选'))throw e;initialError=e.message;}
 const initialUp=o.mode==='exact'?0:Math.min(o.upstream,selected.start-1),initialDown=o.mode==='exact'?0:Math.min(o.downstream,selected.sequence.length-selected.end);
 const triggers=[...new Set(original.flatMap(qualityIssues))];if(initialError)triggers.push('初始范围没有合适候选');
 const trace:SearchTrace={version:2,status:'not_needed',initialUp,initialDown,searchedUp:initialUp,searchedDown:initialDown,rounds:0,triggers,remaining:triggers,message:'当前候选未触发 GC、重复碱基或结构筛查阈值；不代表已完成特异性或实验验证。'};
 if(o.autoExpandRepeats===false){trace.status='disabled';trace.message=initialError||'未启用引物质量自动优化。';}
 else if(o.mode==='exact'){trace.status='exact';trace.message='精确 CDS 模式保持固定边界；如需向外寻找引物，请改用包含 UTR 模式。'+(initialError?' 当前条件下没有合适候选。':'');}
 else if(triggers.length){
  let best=original.filter(p=>qualityIssues(p).length===0);const visited=new Set<string>();
  for(const extra of [0,50,100,200,500]){
   const up=Math.min(500,o.upstream+extra,selected.start-1),down=Math.min(500,o.downstream+extra,selected.sequence.length-selected.end),key=up+':'+down;
   if(visited.has(key))continue;visited.add(key);trace.rounds++;trace.searchedUp=up;trace.searchedDown=down;
   try{
    const result=designTranscript(selected.sequence,selected.start,selected.end,{...o,upstream:up,downstream:down,excludeRepeats:true,cleanQuality:true,diverse:false});
    const clean=five(screenIsoforms(result.pairs.filter(p=>qualityIssues(p).length===0),records,selected));
    if(clean.length){best=five([...best,...clean]);total=result.total;}
    if(best.length===5)break;
   }catch(e){if(!(e instanceof Error)||!e.message.includes('没有合适候选'))throw e;}
  }
  if(best.length){trace.status='replaced';trace.remaining=[];trace.message=`质量自动优化：已搜索上游 ${trace.searchedUp} bp、下游 ${trace.searchedDown} bp，保留 ${best.length} 对 GC 在 35–65%、无连续重复且未触发当前结构筛查阈值的候选。未放宽长度、Tm 或完整 CDS 要求；仍需 BLAST 复核。`;return {pairs:best,total,search:trace};}
  trace.status='unresolved';trace.message=`已搜索上游 ${trace.searchedUp} bp、下游 ${trace.searchedDown} bp（不超过实际 UTR 或每侧 500 bp），未找到同时满足全部质量筛查条件的候选。${original.length?'保留原候选及未解决提示。':'当前无合适引物，请调整条件或目标转录本。'}`;
 }
 return {pairs:original,total,search:trace};
}
