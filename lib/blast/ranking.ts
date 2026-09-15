import type {CheckResult} from './core';
export function verificationReasons(r:CheckResult):string[]{return r.evaluation?[`Primer-pair 等级：${r.evaluation.grade||'暂不评级'}`, ...r.evaluation.messages]:[
 r.target?.status==='matched'?'目标模板全长匹配':r.target?.status==='mismatch'?'目标模板校验失败':'尚无独立模板校验',
 `已发现其他基因 ${r.summary?.otherGene||0} 个、同基因其他转录本 ${r.summary?.sameGene||0} 个、同转录本其他产物 ${r.summary?.sameTranscript||0} 个`,
 r.summary?.incomplete||!r.evidence||r.evidence.scope!=='human_confirmed'?'检索证据不完整，仅作暂定比较，不判为特异性通过':'在本次检索范围和配对规则内比较，仍需实验验证',
 ];}
export function compareVerification(a:CheckResult,b:CheckResult){
 if(a.evaluation&&b.evaluation){const n=(r:CheckResult)=>r.evaluation?.grade?({A:0,B:1,C:2,D:3}[r.evaluation.grade]):4;return n(a)-n(b)||a.evaluation.high-b.evaluation.high||a.evaluation.medium-b.evaluation.medium||a.evaluation.low-b.evaluation.low||a.rank-b.rank;}
 const score=(r:CheckResult)=>[
  r.target?.status==='mismatch'?2:r.target?.status==='matched'?0:1,
  r.summary?.otherGene||0,
  r.summary?.unknown||0,
  r.summary?.sameTranscript||0,
  r.summary?.sameGene||0,
  r.summary?.incomplete||!r.evidence||r.evidence.scope!=='human_confirmed'?1:0,
  r.expectedFound?0:1,r.rank,
 ];
 const aa=score(a),bb=score(b);for(let i=0;i<aa.length;i++)if(aa[i]!==bb[i])return aa[i]-bb[i];return 0;
}
