import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {D1Store} from '../lib/ncbi/store.ts';
import {createService,NcbiError,retryDelay} from '../lib/ncbi/service.ts';
const schema=readFileSync(new URL('../drizzle/0000_fresh_human_torch.sql',import.meta.url),'utf8');
function database(){
 const db=new DatabaseSync(':memory:');db.exec(schema);
 const adapter={prepare(sql){let args=[];return {
 bind(...params){args=params.map(p=>p instanceof ArrayBuffer?Buffer.from(p):p);return this;},
 async first(){return db.prepare(sql).get(...args)||null;},
 async run(){return db.prepare(sql).run(...args);}
 };}};
 return {store:new D1Store(adapter),db};
}
const fixture=JSON.parse(readFileSync(new URL('../data/ncbi-seeds.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));const xml=fixture.ALKBH3.xml;
const ok=()=>new Response(xml);const search=()=>Response.json({esearchresult:{idlist:['123']}});
function clock(){let t=Date.now();return {now:()=>t,sleep:async n=>{t+=n},random:()=>0};}
let checks=0;
{
 const {store,db}=database(),c=clock();let calls=[];const fetcher=async url=>{calls.push({url,t:c.now()});return url.includes('esearch')?search():ok()};
 const service=createService({store,...c,fetcher});const a=await service.search(' alkbh3 ');assert.equal(a.source,'live');assert.equal(calls.length,2);assert.ok(calls[1].t-calls[0].t>=1100);assert.equal(a.xml,xml);
 const b=await createService({store,...c,fetcher}).search('ALKBH3');assert.equal(b.source,'cache');assert.equal(b.fetchedAt,a.fetchedAt);assert.equal(calls.length,2);
 assert.match(db.prepare('EXPLAIN QUERY PLAN SELECT payload FROM sequence_cache WHERE query=?').get('ALKBH3').detail,/INDEX/);checks++;
}
{
 const {store}=database(),c=clock();let n=0;const events=[];const service=createService({store,...c,fetcher:async()=>{events.push(c.now());return ++n===1?new Response('',{status:429,headers:{'Retry-After':'5'}}):ok()}});await service.search('NM_139178.4');assert.equal(n,2);assert.ok(events[1]-events[0]>=5000);checks++;
}
{
 const {store}=database(),c=clock();let n=0;const service=createService({store,...c,fetcher:async()=>++n===1?Response.json({error:'API rate limit exceeded'}):ok()});await service.search('NM_139178.4');assert.equal(n,2);checks++;
}
{
 const {store}=database(),c=clock();let n=0;const service=createService({store,...c,fetcher:async()=>{n++;return new Response('',{status:429,headers:{'Retry-After':'120'}})}});await assert.rejects(()=>service.search('NM_139178.4'),e=>e instanceof NcbiError&&e.status===429&&e.retryAfter===120);assert.equal(n,1);await assert.rejects(()=>service.search('NM_123456.1'),e=>e.status===429);assert.equal(n,1);assert.equal(await store.get('NM_139178.4'),null);checks++;
}
{
 const {store}=database(),c=clock();const old=c.now()-8*86400000;await store.put('NM_139178.4',{xml,fetchedAt:old});let n=0;const response=await createService({store,...c,fetcher:async()=>{n++;return new Response('',{status:503})}}).search('NM_139178.4');assert.equal(response.source,'stale');assert.equal(response.fetchedAt,old);assert.equal(n,3);checks++;
}
{
 const {store}=database(),c=clock();let n=0;const r=await createService({store,...c,seeds:{ALKBH3:{xml,fetchedAt:c.now()}},fetcher:async()=>{n++;throw Error('must not fetch')}}).search('ALKBH3');assert.equal(r.source,'snapshot');assert.equal(n,0);checks++;
}
{
 const {store}=database(),c=clock();const service=createService({store,...c,fetcher:async()=>Response.json({esearchresult:{idlist:[]}})});await assert.rejects(()=>service.search('NO_GENE'),e=>e.status===404);assert.equal(await store.get('NO_GENE'),null);await assert.rejects(()=>service.search('[bad]'),e=>e.status===400);checks++;
}
{
 const {store}=database();let calls=0;const fetcher=async url=>{calls++;return url.includes('esearch')?search():ok()};const requests=Array.from({length:6},()=>createService({store,fetcher}).search('CONCURRENT'));const responses=await Promise.all(requests);assert.equal(calls,2);assert.ok(responses.every(r=>r.xml===xml));checks++;
}
{
 const {store}=database(),c=clock();const service=createService({store,...c,fetcher:async()=>new Response('<GBSet><ERROR>bad</ERROR></GBSet>')});await assert.rejects(()=>service.search('NM_123456.1'),e=>e.status===404);assert.equal(await store.get('NM_123456.1'),null);checks++;
}
assert.equal(retryDelay(new Date(10000).toUTCString(),0),10000);
{
 const {store}=database(),c=clock();const bad=xml.replaceAll('NM_139178','XM_139178');await store.put('WDFY3',{xml:bad,fetchedAt:c.now()});let calls=0;
 const result=await createService({store,...c,fetcher:async url=>{calls++;if(url.includes('esearch')){assert.match(new URL(url).searchParams.get('term'),/srcdb_refseq_known\[properties\]/);return search();}return ok();}}).search('WDFY3');assert.equal(result.source,'live');assert.equal(calls,2);assert.equal((await store.get('WDFY3')).xml,xml);checks++;
}
console.log({cacheAndRateLimitScenarios:checks,sqlite:'actual SQL tested',concurrentRequests:6,upstreamCalls:2});
