import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {pack} from '../lib/batch/store.ts';
import {qualityIssues} from '../lib/batch/adaptive.ts';
const base='http://localhost:3001',cookie='primer_session='+crypto.randomUUID().replaceAll('-','').repeat(2),id=crypto.randomUUID();
async function api(body){const r=await fetch(base+'/api/batches',{method:'POST',headers:{cookie,origin:base,'Content-Type':'application/json'},body:JSON.stringify({...body,id})});const b=await r.json();assert.equal(r.status,200,JSON.stringify(b));return b;}
let seed=71;const random=n=>Array.from({length:n},()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return 'ACGT'[seed>>>30]}).join('');const cds='ATGGGGGGCGCTACGCTGCAG'+('GCTGACCTG'.repeat(30))+'TAA',sequence=random(500)+cds+random(500),record={accession:'NM_TEST.1',gene:'TEST',protein:'',title:'Local synthetic fixture only',recommendation:'',sequence,start:501,end:500+cds.length};
const settings={mode:'flanking',removeStop:false,tmMin:40,tmMax:80,upstream:0,downstream:0,autoExpandRepeats:false};let batch=await api({action:'create',input:'TEST_DIRTY\nTEST_EXACT',settings});
const directory='.wrangler/state/v3/d1/miniflare-D1DatabaseObject',db=new DatabaseSync(directory+'/'+readdirSync(directory).find(n=>n.endsWith('.sqlite')));db.exec('PRAGMA busy_timeout=5000');const payload=Buffer.from(await pack({records:[record],selected:record.accession}));for(const [n,i] of batch.items.entries())db.prepare('UPDATE primer_items SET payload=?,settings=? WHERE id=?').run(payload,JSON.stringify({...settings,mode:n?'exact':'flanking'}),i.id);db.close();
await api({action:'step'});batch=await api({action:'step'});assert.ok(batch.items.every(i=>i.status==='complete'));assert.ok(batch.items[0].pairs.some(p=>qualityIssues(p).length));
batch=await api({action:'optimize_quality'});assert.equal(batch.items[0].status,'queued');assert.equal(batch.items[0].settings.autoExpandRepeats,true);assert.equal(batch.items[1].status,'complete');
batch=await api({action:'step'});assert.equal(batch.items[0].search.status,'replaced');assert.ok(batch.items[0].pairs.every(p=>!qualityIssues(p).length));assert.equal(batch.items[1].search.status,'disabled');
batch=await api({action:'optimize_quality'});assert.ok(batch.items.every(i=>i.status==='complete'));
console.log('PASS HTTP bulk reoptimization: flagged flanking target replaced, exact target preserved, no unnecessary requeue of clean results.');
