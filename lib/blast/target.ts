export type TargetCheck={status:'matched'|'mismatch';accession:string;start:number;end:number;length:number;cdsCovered:boolean;stopRemoved:boolean;reasons:string[]};
type Positioned={forward:{sequence:string;start:number;end:number};reverse:{sequence:string;start:number;end:number};productStart:number;productEnd:number;productLength:number;removeStop:boolean};
const rc=(s:string)=>[...s].reverse().map(c=>({A:'T',T:'A',G:'C',C:'G'}[c]||'N')).join('');
/** Independent exact alignment to the selected, versioned transcript; never a specificity verdict. */
export function checkTarget(sequence:string,cdsStart:number,cdsEnd:number,p:Positioned,accession=''):TargetCheck{
 const s=sequence.toUpperCase(),reasons:string[]=[];
 const coords=[cdsStart,cdsEnd,p.forward.start,p.forward.end,p.reverse.start,p.reverse.end,p.productStart,p.productEnd,p.productLength];
 if(!coords.every(Number.isInteger)||cdsStart<1||cdsEnd>s.length||cdsStart>cdsEnd||p.forward.start<1||p.reverse.end>s.length||p.forward.end>=p.reverse.start)reasons.push('坐标或引物方向不符合目标模板');
 if(!/^[ACGT]{18,25}$/.test(p.forward.sequence)||s.slice(p.forward.start-1,p.forward.end)!==p.forward.sequence)reasons.push('F 引物未在指定坐标全长匹配');
 if(!/^[ACGT]{18,25}$/.test(p.reverse.sequence)||rc(s.slice(p.reverse.start-1,p.reverse.end))!==p.reverse.sequence)reasons.push('R 引物未在指定坐标反向互补匹配');
 if(p.productStart!==p.forward.start||p.productEnd!==p.reverse.end||p.productLength!==p.productEnd-p.productStart+1)reasons.push('产物坐标与长度不一致');
 const stopRemoved=p.removeStop===true;
 const cdsCovered=p.productStart<=cdsStart&&p.productEnd>=cdsEnd-(stopRemoved?3:0);
 if(!cdsCovered)reasons.push('产物未覆盖所需 CDS');
 if(stopRemoved&&(p.productStart!==cdsStart||p.productEnd!==cdsEnd-3||!['TAA','TAG','TGA'].includes(s.slice(cdsEnd-3,cdsEnd))))reasons.push('去终止密码子模式边界不正确');
 return {status:reasons.length?'mismatch':'matched',accession,start:p.productStart,end:p.productEnd,length:p.productLength,cdsCovered,stopRemoved,reasons};
}
