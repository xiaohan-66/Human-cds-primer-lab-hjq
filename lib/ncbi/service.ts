import type {Cached,Store} from './store';
export const hasKnownTranscripts=(xml:string)=>/<GBSeq_accession-version>NM_/.test(xml)&&!/<GBSeq_accession-version>[X][MR]_/.test(xml);
const FRESH=7*86400000,STALE=30*86400000;
export class NcbiError extends Error{constructor(message:string,public status=503,public retryAfter=0){super(message);}}
export type Payload=Cached & {source:'live'|'cache'|'snapshot'|'stale';warning?:string};
export function normalizeQuery(raw:string){const q=raw.trim().replace(/\s+/g,' ');if(!q||q.length>120||!/[a-zA-Z0-9]/.test(q)||/[\[\]"<>]/.test(q))throw new NcbiError('请输入有效的基因名称或 RefSeq 编号。',400);return q.toUpperCase();}
export function retryDelay(value:string|null,now:number){if(!value)return 0;const seconds=Number(value);return Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,(Date.parse(value)||now)-now);}
export function createService({store,fetcher=fetch,now=Date.now,sleep=(ms:number)=>new Promise<void>(r=>setTimeout(r,ms)),random=Math.random,apiKey,email,seeds={}}:{store:Store;fetcher?:typeof fetch;now?:()=>number;sleep?:(ms:number)=>Promise<void>;random?:()=>number;apiKey?:string;email?:string;seeds?:Record<string,Cached>}){
 async function upstream(path:string,deadline:number){
 for(let attempt=0;attempt<3;attempt++){
 for(;;){const wait=await store.slot(now());if(!wait)break;if(now()+wait+1000>deadline)throw new NcbiError('NCBI 正在限流，请在倒计时结束后重试。',429,Math.ceil(wait/1000));await sleep(wait);}
 if(deadline-now()<1000)throw new NcbiError('检索等待时间较长，请稍后重试。',503,5);
 const url=new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'+path);url.searchParams.set('tool','human_cds_primer_lab');if(apiKey)url.searchParams.set('api_key',apiKey);if(email)url.searchParams.set('email',email);
 let res:Response,body:string;
 try{res=await fetcher(url.toString(),{signal:AbortSignal.timeout(Math.min(15000,Math.max(1,deadline-now())))});body=await res.text();}catch{if(attempt===2||deadline-now()<3000)throw new NcbiError('NCBI 连接暂时不稳定，请稍后重试。',503,5);await sleep(1000*(attempt+1));continue;}
 const limited=res.status===429||(/"error"\s*:\s*"[^"]*(rate limit|too many requests)/i.test(body));
 if(limited||res.status>=500){const delay=Math.max(retryDelay(res.headers.get('retry-after'),now()),(2**attempt)*1000+Math.floor(random()*500));await store.cooldown(now()+delay);if(attempt===2||now()+delay+1000>deadline)throw new NcbiError(limited?'NCBI 正在限流，请在倒计时结束后重试。':'NCBI 暂时不可用，请稍后重试。',limited?429:503,Math.max(1,Math.ceil(delay/1000)));await sleep(delay);continue;}
 if(!res.ok)throw new NcbiError('NCBI 暂时无法处理检索，请稍后重试。',503,10);
 if(body.length>8000000)throw new NcbiError('返回记录过大，请使用具体 NM_ 编号检索。',422);
 return body;
 }
 throw new NcbiError('NCBI 暂时不可用。');
 }
 return {async search(raw:string):Promise<Payload>{
 const q=normalizeQuery(raw),deadline=now()+45000;let cached=await store.get(q);if(cached&&!hasKnownTranscripts(cached.xml))cached=null;const seed=seeds[q]&&hasKnownTranscripts(seeds[q].xml)?seeds[q]:undefined;if(seed&&(!cached||seed.fetchedAt>cached.fetchedAt))cached=seed;
 if(cached&&now()-cached.fetchedAt<FRESH)return {...cached,source:cached===seed?'snapshot':'cache'};
 const owner=crypto.randomUUID();let acquired=false;
 try{
 for(;;){acquired=await store.acquire(q,owner,now());if(acquired)break;const updated=await store.get(q);if(updated&&hasKnownTranscripts(updated.xml)&&now()-updated.fetchedAt<FRESH)return {...updated,source:'cache'};if(now()+1500>deadline)throw new NcbiError('相同基因正在检索中，请稍后重试。',503,5);await sleep(1000);}
 const updated=await store.get(q);if(updated&&hasKnownTranscripts(updated.xml)&&now()-updated.fetchedAt<FRESH)return {...updated,source:'cache'};
 let id=q;
 if(!/^NM_\d+(\.\d+)?$/i.test(q)){
 const term=`(${/^[A-Za-z0-9-]+$/.test(q)?q+'[Gene Name]':'"'+q+'"[All Fields]'}) AND txid9606[Organism] AND biomol_mrna[PROP] AND srcdb_refseq_known[properties]`;
 let result:{esearchresult?:{idlist?:string[]};error?:string};try{result=JSON.parse(await upstream('esearch.fcgi?db=nuccore&retmode=json&retmax=20&term='+encodeURIComponent(term),deadline));}catch(e){if(e instanceof NcbiError)throw e;throw new NcbiError('NCBI 检索响应异常，请稍后重试。');}
 if(result.error||!result.esearchresult?.idlist)throw new NcbiError('NCBI 检索响应异常，请稍后重试。');
 if(!result.esearchresult.idlist.length)throw new NcbiError('未找到人源参考 mRNA，请尝试官方基因符号或 NM_ 编号。',404);
 if(!result.esearchresult.idlist.every(x=>/^\d+$/.test(x)))throw new NcbiError('NCBI 返回了无效记录编号。');id=result.esearchresult.idlist.join(',');
 }
 const xml=await upstream('efetch.fcgi?db=nuccore&rettype=gb&retmode=xml&id='+encodeURIComponent(id),deadline);
 if(!hasKnownTranscripts(xml)||!xml.includes('<GBSeq>')||!xml.includes('</GBSet>')||!xml.includes('<GBSeq_organism>Homo sapiens</GBSeq_organism>')||/<ERROR>/i.test(xml))throw new NcbiError('未找到有效的人源 mRNA 记录，请检查名称或编号。',404);
 const value={xml,fetchedAt:now()};await store.put(q,value);return {...value,source:'live'};
 }catch(e){if(cached&&now()-cached.fetchedAt<STALE&&(e instanceof NcbiError)&&(e.status===429||e.status===503))return {...cached,source:'stale',warning:'NCBI 暂时不可用，已使用历史缓存。请留意序列获取时间。'};throw e;}
 finally{if(acquired)await store.release(q,owner);}
 }};
}
