import {checkTarget,type TargetCheck} from './blast/target';
import {nearestNeighborTm,oligoRisk,dimerRisk,pairQuality,type Chemistry,type Quality} from './quality/thermo';
export type Primer={sequence:string;tm:number;gc:number};
export type Pair={forward:Primer;reverse:Primer;productLength:number;score:number;warnings:string[];quality?:Quality};
export function reverseComplement(s:string){return s.split('').reverse().map(c=>({A:'T',T:'A',C:'G',G:'C'}[c]||'N')).join('');}
function describe(s:string,c?:Chemistry):Primer{const gc=(s.match(/[GC]/g)||[]).length;return {sequence:s,gc:100*gc/s.length,tm:c?nearestNeighborTm(s,c):64.9+41*(gc-16.4)/s.length};}
export function design(cds:string,removeStop:boolean,tmMin:number,tmMax:number,thermo?:Chemistry):Pair[]{
 if(!Number.isFinite(tmMin)||!Number.isFinite(tmMax)||tmMin<40||tmMax>80||tmMin>tmMax)throw Error('请设置有效的 Tm 范围：40–80 °C，且下限不得高于上限。');
 if(!/^[ACGT]+$/.test(cds)||cds.length<60||cds.length%3!==0||!cds.startsWith('ATG'))throw Error('CDS 需为至少 60 bp、以 ATG 开始且长度为 3 的倍数的明确 DNA 序列。');
 if(!['TAA','TAG','TGA'].includes(cds.slice(-3)))throw Error('CDS 缺少标准终止密码子，请检查转录本注释。');
 for(let i=3;i<cds.length-3;i+=3)if(['TAA','TAG','TGA'].includes(cds.slice(i,i+3)))throw Error('CDS 含内部终止密码子或特殊翻译注释，本版暂不自动设计。');
 const seq=removeStop?cds.slice(0,-3):cds;const all:Pair[]=[];
 for(let f=18;f<=25;f++)for(let r=18;r<=25;r++){
 const forward=describe(seq.slice(0,f),thermo),reverse=describe(reverseComplement(seq.slice(-r)),thermo);
 if([forward,reverse].some(p=>p.tm<tmMin||p.tm>tmMax)||Math.abs(forward.tm-reverse.tm)>3)continue;
 const warnings:string[]=[];if([forward,reverse].some(p=>p.gc<35||p.gc>65))warnings.push('GC 含量偏离 35–65%，需复核扩增条件');if([forward,reverse].some(p=>/(A{4}|C{4}|G{4}|T{4})/.test(p.sequence)||/(.{2})\1{3,}/.test(p.sequence)))warnings.push('含连续重复碱基，需复核引物性能');all.push({forward,reverse,warnings,productLength:seq.length,score:Math.abs(forward.tm-reverse.tm)});
 }
 all.sort((a,b)=>a.score-b.score);
 if(!all.length)throw Error('固定 CDS 两端在当前条件下没有合适候选。引物长度限制为 18–25 nt，可调整 Tm 范围；不会通过截短 CDS 来凑出引物。');
 return all;
}


export type DesignMode='flanking'|'exact';
export type PositionedPrimer=Primer & {start:number;end:number};
export type PositionedPair=Pair & {forward:PositionedPrimer;reverse:PositionedPrimer;upstream:number;downstream:number;productStart:number;productEnd:number;removeStop:boolean;isoformProducts?:{accession:string;length:number}[];target?:TargetCheck};
export type DesignResult={pairs:PositionedPair[];total:number;mode:DesignMode;searchedUpstream:number;searchedDownstream:number};
export type DesignOptions={mode:DesignMode;removeStop:boolean;tmMin:number;tmMax:number;upstream:number;downstream:number;diverse?:boolean;thermo?:Chemistry;autoExpandRepeats?:boolean;excludeRepeats?:boolean;cleanQuality?:boolean};
export const hasRepeat=(sequence:string)=>/(A{4}|C{4}|G{4}|T{4})/.test(sequence)||/(.{2})\1{3,}/.test(sequence);
function cleanOligo(p:Primer){if(p.gc<35||p.gc>65||hasRepeat(p.sequence))return false;const r=oligoRisk(p.sequence);return r.hairpinStem<4&&r.homodimer.longest<6&&r.homodimer.threePrime<4&&r.endGc<4&&r.endRun<3;}
function primerWarnings(p:Primer){const w:string[]=[];if(p.gc<35||p.gc>65)w.push('GC 含量偏离 35–65%，需复核扩增条件');if(/(A{4}|C{4}|G{4}|T{4})/.test(p.sequence)||/(.{2})\1{3,}/.test(p.sequence))w.push('含连续重复碱基，需复核引物性能');return w;}
export function designTranscript(sequence:string,start:number,end:number,o:DesignOptions):DesignResult{
 if(!Number.isInteger(start)||!Number.isInteger(end)||start<1||end>sequence.length||start>end)throw Error('CDS 坐标无效，无法确定完整扩增范围。');
 if(!['flanking','exact'].includes(o.mode))throw Error('请选择有效的扩增模式。');
 const cds=sequence.slice(start-1,end);
 if(o.mode==='exact'){
 const pairs:PositionedPair[]=design(cds,o.removeStop,o.tmMin,o.tmMax,o.thermo).map(p=>({...p,forward:{...p.forward,start,end:start+p.forward.sequence.length-1},reverse:{...p.reverse,start:end-(o.removeStop?3:0)-p.reverse.sequence.length+1,end:end-(o.removeStop?3:0)},upstream:0,downstream:0,productStart:start,productEnd:end-(o.removeStop?3:0),removeStop:o.removeStop}));
 for(const p of pairs){p.target=checkTarget(sequence,start,end,p);if(p.target.status!=="matched")throw Error(p.target.reasons.join("；"));}
 return {pairs:o.thermo?assessPairs(pairs,o.thermo):pairs,total:pairs.length,mode:o.mode,searchedUpstream:0,searchedDownstream:0};
 }
 if(o.removeStop)throw Error('含 UTR 扩增必须保留天然终止密码子；去除终止密码子请使用精确 CDS 模式。');
 if(!Number.isFinite(o.tmMin)||!Number.isFinite(o.tmMax)||o.tmMin<40||o.tmMax>80||o.tmMin>o.tmMax)throw Error('请设置有效的 Tm 范围：40–80 °C，且下限不得高于上限。');
 if(![o.upstream,o.downstream].every(n=>Number.isInteger(n)&&n>=0&&n<=(o.excludeRepeats?500:200)))throw Error('两侧搜索范围超出允许边界。');
 // Keep CDS validation identical to exact mode; a lack of exact-end candidates is expected.
 try{design(cds,false,o.tmMin,o.tmMax,o.thermo);}catch(e){if(!(e instanceof Error)||!e.message.includes('没有合适候选'))throw e;}
 const up=Math.min(o.upstream,start-1),down=Math.min(o.downstream,sequence.length-end);
 const forwards:(PositionedPrimer & {warnings:string[]})[]=[],reverses:(PositionedPrimer & {warnings:string[]})[]=[];
 for(let offset=0;offset<=up;offset++)for(let len=18;len<=25;len++){
 const pos=start-1-offset,s=sequence.slice(pos,pos+len);
 if(s.length!==len||!/^[ACGT]+$/.test(s)||o.excludeRepeats&&hasRepeat(s))continue;const p=describe(s,o.thermo);
 if(p.tm>=o.tmMin&&p.tm<=o.tmMax&&(!o.cleanQuality||cleanOligo(p)))forwards.push({...p,start:pos+1,end:pos+len,warnings:primerWarnings(p)});
 }
 for(let offset=0;offset<=down;offset++)for(let len=18;len<=25;len++){
 const pos=end+offset,s=sequence.slice(pos-len,pos);
 if(s.length!==len||!/^[ACGT]+$/.test(s)||o.excludeRepeats&&hasRepeat(s))continue;const p=describe(reverseComplement(s),o.thermo);
 if(p.tm>=o.tmMin&&p.tm<=o.tmMax&&(!o.cleanQuality||cleanOligo(p)))reverses.push({...p,start:pos-len+1,end:pos,warnings:primerWarnings(p)});
 }
 let total=0;const best:PositionedPair[]=[];const bins=new Map<string,PositionedPair>();
 const unaryCache=new Map<string,number>();const unary=(s:string)=>{if(!unaryCache.has(s)){const r=oligoRisk(s);unaryCache.set(s,(r.homodimer.threePrime>=4?100:0)+(r.hairpinStem>=4?5:0)+(r.homodimer.longest>=6?5:0)+(r.endGc>=4?2:0)+(r.endRun>=3?2:0));}return unaryCache.get(s)!;};
 const compare=(a:PositionedPair,b:PositionedPair)=>(o.thermo?unary(a.forward.sequence)+unary(a.reverse.sequence)-unary(b.forward.sequence)-unary(b.reverse.sequence):0)||a.warnings.length-b.warnings.length||(o.thermo?Math.floor(a.score)-Math.floor(b.score):a.score-b.score)||(a.upstream+a.downstream)-(b.upstream+b.downstream)||a.productStart-b.productStart||a.forward.sequence.length-b.forward.sequence.length||a.reverse.sequence.length-b.reverse.sequence.length;
 for(const f of forwards)for(const r of reverses){const delta=Math.abs(f.tm-r.tm);if(delta>3)continue;total++;
 const p:PositionedPair={forward:f,reverse:r,productLength:r.end-f.start+1,score:delta,warnings:Array.from(new Set([...f.warnings,...r.warnings])),upstream:start-f.start,downstream:r.end-end,productStart:f.start,productEnd:r.end,removeStop:false};
 if(o.diverse&&!o.cleanQuality){const key=Math.floor(f.end/6)+':'+Math.floor(r.start/6);const previous=bins.get(key);if(!previous||compare(p,previous)<0)bins.set(key,p);}
 if(best.length===100&&compare(p,best[99])>=0)continue;
 if(o.cleanQuality){const hetero=dimerRisk(f.sequence,r.sequence);if(hetero.longest>=6||hetero.threePrime>=4)continue;}
 let lo=0,hi=best.length;while(lo<hi){const mid=(lo+hi)>>>1;if(compare(p,best[mid])<0)hi=mid;else lo=mid+1;}best.splice(lo,0,p);if(best.length>100)best.pop();
 }
 if(!best.length)throw Error('两侧搜索范围内没有合适候选。可调整 Tm 或两侧范围；引物始终为 18–25 nt，并保留完整 CDS。');
 const pool=o.diverse?[...best,...bins.values()]:best;for(const p of pool){p.target=checkTarget(sequence,start,end,p);if(p.target.status!=="matched")throw Error(p.target.reasons.join("；"));}
 return {pairs:o.thermo?assessPairs(pool,o.thermo):pool,total,mode:o.mode,searchedUpstream:up,searchedDownstream:down};
}

export function assessPairs(pairs:PositionedPair[],conditions:Chemistry){const cache=new Map<string,ReturnType<typeof oligoRisk>>();const risk=(s:string)=>{if(!cache.has(s))cache.set(s,oligoRisk(s));return cache.get(s)!;};for(const p of pairs){p.quality=pairQuality(p.forward.sequence,p.reverse.sequence,conditions,risk(p.forward.sequence),risk(p.reverse.sequence));p.quality.ranking=[p.quality.level==='high'?'3′端互补风险较高':p.quality.level==='review'?'存在结构风险提示':'未触发当前互补筛查阈值', '结构提示 '+p.quality.riskCount+' 项，基础提示 '+p.warnings.length+' 项','ΔTm 按 1 °C 档比较，档内优先较短产物；实际 ΔTm '+p.score.toFixed(2)+' °C，额外 UTR '+(p.upstream+p.downstream)+' bp'];}return pairs.sort(compareQuality);}
export function compareQuality(a:PositionedPair,b:PositionedPair){const level=(p:PositionedPair)=>p.quality?.level==='high'?2:p.quality?.level==='review'?1:0;return level(a)-level(b)||(a.isoformProducts?.length||0)-(b.isoformProducts?.length||0)||(a.quality?.riskCount||0)-(b.quality?.riskCount||0)||a.warnings.length-b.warnings.length||(a.quality&&b.quality?Math.floor(a.score)-Math.floor(b.score):a.score-b.score)||(a.upstream+a.downstream)-(b.upstream+b.downstream);}
