import type {Chunk,CheckResult,Product,Selection} from './core';
export type BindingSite={primerType:'F'|'R';accession:string;title:string;start:number;end:number;strand:'+'|'-';queryStart:number;queryEnd:number;coverage:number;total:number;last5:number;last8:number;terminal:boolean;terminalUnknown:boolean;unknown:number;gaps:number;alignedPrimer:string;alignedSubject:string};
export type PairDetails={pairType:'F-R'|'F-F'|'R-R';left:BindingSite;right:BindingSite;score:number;risk:'high'|'medium'|'low'|'very_low'|'none';reasons:string[];extended:boolean};
export type Evaluation={version:'2.0';database:string;coverage:'complete'|'limited'|'unknown';grade:'A'|'B'|'C'|'D'|null;validation:'valid'|'invalid'|'review';high:number;medium:number;low:number;unassigned:number;commonSubjects:number;subjects:number;orientationPairs:number;lengthPairs:number;pairingLimited:boolean;normalizationRejected:number;minProduct:number;primaryMax:number;maxProduct:number;messages:string[]};
const rc=(s:string)=>[...s].reverse().map(c=>({A:'T',T:'A',G:'C',C:'G','-':'-',N:'N'}[c]||'N')).join('');
export function normalizeHit(primer:string,type:'F'|'R',h:any,d:any,subjectLength?:number):BindingSite|null{
 const qfrom=Number(h.query_from),qto=Number(h.query_to);if(!Number.isInteger(qfrom)||!Number.isInteger(qto)||Math.min(qfrom,qto)<1||Math.max(qfrom,qto)>primer.length)return null;
 let q=String(h.qseq||'').toUpperCase(),s=String(h.hseq||'').toUpperCase();if(q.length!==s.length||!q.length||q.length>100)return null;
 const reversed=qfrom>qto||h.query_strand==='Minus';if(reversed){q=rc(q);s=rc(s);}
 const first=Math.min(qfrom,qto),last=Math.max(qfrom,qto),aligned=Array<string>(primer.length).fill('?'),gapPositions=new Set<number>();let pos=first-1,gaps=0;
 for(let i=0;i<q.length;i++){if(q[i]==='-'){gaps++;gapPositions.add(Math.min(pos,primer.length-1));continue;}if(pos>=last||q[i]!==primer[pos])return null;aligned[pos++]=s[i];if(s[i]==='-')gaps++;}
 if(pos!==last)return null;
 const mismatches=aligned.map((base,i)=>base!==primer[i]||gapPositions.has(i)),unknown=aligned.filter(b=>b==='?'||b==='N').length;
 const total=mismatches.filter(Boolean).length,coverage=(last-first+1)/primer.length;if(coverage<0.75||total>6)return null;
 const hf=Number(h.hit_from),ht=Number(h.hit_to);if(!Number.isInteger(hf)||!Number.isInteger(ht)||hf===ht)return null;
 const plus=(hf<ht)!==reversed,missing5=first-1,missing3=primer.length-last;
 const start=Math.min(hf,ht)-(plus?missing5:missing3),end=Math.max(hf,ht)+(plus?missing3:missing5);
 if(start<1||subjectLength&&end>subjectLength)return null;
 const accession=String(d.id||'').match(/(?:ref|gb|emb|dbj)\|([^|]+)\|/)?.[1]||String(d.accession||'');if(!accession)return null;
 return {primerType:type,accession,title:d.title||'',start,end,strand:plus?'+':'-',queryStart:first,queryEnd:last,coverage,total,last5:mismatches.slice(-5).filter(Boolean).length,last8:mismatches.slice(-8).filter(Boolean).length,terminal:mismatches.at(-1)!,terminalUnknown:aligned.at(-1)==='?'||aligned.at(-1)==='N',unknown,gaps,alignedPrimer:q,alignedSubject:s};
}
export function bindingScore(h:BindingSite){return Math.max(0,100-12*h.total-18*h.last8-25*h.last5-(h.terminal?35:0)-40*(1-h.coverage));}
export function productRisk(left:BindingSite,right:BindingSite,length:number,expected=false):PairDetails{
 const factor=length<=2000?1:length<=5000?.9:length<=10000?.65:.35;
 let score=expected?0:Math.min(bindingScore(left),bindingScore(right))*factor;
 const hard=!expected&&length<=5000&&[left,right].every(h=>h.coverage===1&&h.gaps===0&&h.last5===0&&h.total<=1);
 if(hard)score=Math.max(80,score);
 const risk=expected?'none':score>=80?'high':score>=60?'medium':score>=35?'low':score>0?'very_low':'none';
 return {pairType:left.primerType===right.primerType?(left.primerType==='F'?'F-F':'R-R'):'F-R',left,right,score:Math.round(score*10)/10,risk,extended:length>5000,reasons:[`${left.primerType}（左）总错配 ${left.total}，3′5 nt ${left.last5}，3′8 nt ${left.last8}`,`${right.primerType}（右）总错配 ${right.total}，3′5 nt ${right.last5}，3′8 nt ${right.last8}`,`同一模板、相向且不重叠，预测 ${length} bp`,...(hard?['两侧 3′5 nt 全匹配、总错配均 ≤1，且产物 ≤5 kb，按高风险处理']:[]),...([left,right].some(h=>h.coverage<1||h.gaps)?['含部分或有缺口的局部比对；未比对碱基按不匹配惩罚，边界为推算值，需全长复核']:[])]};
}
export function pairSites(sites:BindingSite[],p:Selection,maxProduct:number){
 const groups=new Map<string,BindingSite[]>();for(const h of sites){const group=groups.get(h.accession)||[];group.push(h);groups.set(h.accession,group);}
 const products=new Map<string,Product>();let commonSubjects=0,orientationPairs=0,lengthPairs=0,pairingLimited=false,operations=0;
 outer:for(const [accession,all] of groups){if(all.some(h=>h.primerType==='F')&&all.some(h=>h.primerType==='R'))commonSubjects++;
  const plus=all.filter(h=>h.strand==='+').sort((a,b)=>a.start-b.start),minus=all.filter(h=>h.strand==='-').sort((a,b)=>a.start-b.start);
  for(const a of plus){let lo=0,hi=minus.length;while(lo<hi){const m=(lo+hi)>>>1;if(minus[m].start<=a.end)lo=m+1;else hi=m;}
   for(let i=lo;i<minus.length&&minus[i].start-a.start+1<=maxProduct;i++){if(++operations>200000){pairingLimited=true;break outer;}const b=minus[i];orientationPairs++;const length=b.end-a.start+1;if(length<50||length>maxProduct)continue;lengthPairs++;
    const expected=accession===p.accession&&a.primerType==='F'&&b.primerType==='R'&&a.total===0&&b.total===0&&length===p.productLength&&(!p.target||a.start===p.target.start&&b.end===p.target.end);
    const pair=productRisk(a,b,length,expected),key=accession+':'+a.start+':'+b.end+':'+pair.pairType;
    const product:Product={accession,title:a.title,start:a.start,end:b.end,length,expected,fMismatches:a.primerType==='F'?a.total:b.total,rMismatches:b.primerType==='R'?b.total:a.total,pair};
    const old=products.get(key);if(!old||expected&&!old.expected||!old.expected&&pair.score>(old.pair?.score||0))products.set(key,product);
    if(products.size>5000){pairingLimited=true;break outer;}
   }
  }
 }
 const list=[...products.values()].sort((a,b)=>Number(b.expected)-Number(a.expected)||(b.pair?.score||0)-(a.pair?.score||0)||a.accession.localeCompare(b.accession)||a.start-b.start);
 return {products:list.slice(0,500),productCount:list.length,pairingLimited:pairingLimited||list.length>500,commonSubjects,subjects:groups.size,orientationPairs,lengthPairs};
}
export function evaluateReport(raw:any,chunk:Chunk,maxProduct:number):CheckResult[]{
 const reports=raw?.BlastOutput2;if(!Array.isArray(reports)||reports.length!==chunk.pairs.length*2)throw Error('F 或 R 搜索结果缺失，无法执行引物对验证。');
 const mapped=new Map<string,{sites:BindingSite[];returned:number;human:number;confirmed:boolean;unknown:boolean;rejected:number;db?:number}>();
 for(const entry of reports){const report=entry.report,search=report?.results?.search,database=chunk.database||'refseq_rna';if(report?.program!=='blastn'||report?.search_target?.db!==database||!search)throw Error('BLAST 程序或数据库与任务不一致。');const name=String(search.query_title||'').split(/\s/)[0];if(!/^p\d+_[FR]$/.test(name)||mapped.has(name))throw Error('BLAST 查询标识异常。');const p=chunk.pairs[Number(name.slice(1,-2))];if(!p)throw Error('BLAST 查询无法对应引物。');const type=name.endsWith('_F')?'F':'R',sequence=type==='F'?p.forward:p.reverse;if(sequence.length!==search.query_len)throw Error('BLAST 查询长度与退火序列不符。');const hits=search.hits||[],sites:BindingSite[]=[];let human=0,unknown=false,foreign=false,rejected=0;
  for(const hit of hits){const descriptions=hit.description||[];if(!descriptions.length)unknown=true;const humans=descriptions.filter((d:any)=>Number(d.taxid)===9606||d.sciname==='Homo sapiens');if(humans.length)human++;if(descriptions.some((d:any)=>!d.taxid&&!d.sciname))unknown=true;if(descriptions.some((d:any)=>d.taxid&&Number(d.taxid)!==9606||d.sciname&&d.sciname!=='Homo sapiens'))foreign=true;
   for(const hsp of hit.hsps||[])for(const d of humans){const h=normalizeHit(sequence,type,hsp,d,hit.len);if(h)sites.push(h);else rejected++;}
  }
  const unique=new Map<string,BindingSite>();for(const h of sites){const key=h.accession+':'+h.start+':'+h.end+':'+h.strand;const old=unique.get(key);if(!old||bindingScore(h)>bindingScore(old))unique.set(key,h);}
  mapped.set(name,{sites:[...unique.values()],returned:hits.length,human,confirmed:report.params?.entrez_query==='txid9606[ORGN]'&&!unknown&&!foreign,unknown,rejected,db:search.stat?.db_num});
 }
 return chunk.pairs.map((p,i)=>{const f=mapped.get(`p${i}_F`),r=mapped.get(`p${i}_R`);if(!f||!r)throw Error('F/R 候选搜索未完成。');const paired=pairSites([...f.sites,...r.sites],p,maxProduct),hitLimit=chunk.hitLimit||500,truncated=f.returned>=hitLimit||r.returned>=hitLimit,confirmed=f.confirmed&&r.confirmed;
  return {key:p.itemId+'|'+p.accession+'|'+p.forward+'|'+p.reverse,input:p.input,rank:p.rank,accession:p.accession,forward:p.forward,reverse:p.reverse,target:p.target,fHits:f.sites.length,rHits:r.sites.length,expectedFound:paired.products.some(p=>p.expected),products:paired.products,productCount:paired.productCount,limited:truncated||!confirmed,evidence:{scope:confirmed?'human_confirmed':'unconfirmed',hitLimit,fReturned:f.returned,rReturned:r.returned,fHuman:f.human,rHuman:r.human,truncated,speciesMissing:f.unknown||r.unknown,databaseSequences:f.db},evaluation:{version:'2.0',database:chunk.database||'refseq_rna',coverage:!confirmed?'unknown':truncated||paired.pairingLimited?'limited':'complete',grade:null,validation:'review',high:0,medium:0,low:0,unassigned:0,commonSubjects:paired.commonSubjects,subjects:paired.subjects,orientationPairs:paired.orientationPairs,lengthPairs:paired.lengthPairs,pairingLimited:paired.pairingLimited,normalizationRejected:f.rejected+r.rejected,minProduct:50,primaryMax:5000,maxProduct,messages:[]},notes:['候选位点采用 ≥75% 查询覆盖、惩罚后总错配 ≤6 的初筛；局部比对未覆盖碱基不视为匹配。','按模板分组，检查 F–R、F–F、R–R 相向组合；产物 50 bp 至设定上限，5 kb 以上单列远距离风险。','风险为规则型预测，不是扩增概率，也不等同于官方 Primer-BLAST。']};
 });
}
