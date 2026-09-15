import type {ItemData} from './core';
export async function pack(data:ItemData){const bytes=await new Response(new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();if(bytes.byteLength>1500000)throw Error('转录本记录过大，请改用明确的 NM 编号。');return bytes;}
export async function unpack(payload:ArrayBuffer|null):Promise<ItemData>{return payload?JSON.parse(await new Response(new Blob([new Uint8Array(payload)]).stream().pipeThrough(new DecompressionStream('gzip'))).text()):{};}
export async function session(request:Request){const known=request.headers.get('oai-authenticated-user-id');const cookie=request.headers.get('cookie')?.match(/(?:^|;\s*)primer_session=([a-f0-9]{64})(?:;|$)/)?.[1];const token=cookie||Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(known?'user:'+known:'guest:'+token));return {owner:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),headers:{'Cache-Control':'no-store',...(!known&&!cookie?{'Set-Cookie':`primer_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(request.url).protocol==='https:'?'; Secure':''}`}:{})}};}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(request.headers.get('sec-fetch-site')==='cross-site'||origin&&origin!==new URL(request.url).origin)throw Error('请求来源无效。');}
export type Row={id:string;batch_id:string;position:number;input:string;status:string;settings:string;payload:ArrayBuffer|null;lease:string|null;lease_until:number};
export async function detail(db:D1Database,id:string,owner:string,changedIds?:string[]){
 const batch=await db.prepare('SELECT id,created_at,settings FROM primer_batches WHERE id=? AND owner=?').bind(id,owner).first<{id:string;created_at:number;settings:string}>();if(!batch)return null;
 // Read compressed sequence payloads one at a time, never materialize 50 transcript sets together.
 const rows=await db.prepare('SELECT id,input,status,settings FROM primer_items WHERE batch_id=? ORDER BY position').bind(id).all<Pick<Row,'id'|'input'|'status'|'settings'>>();
 const items=[];
 for(const r of rows.results){if(changedIds&&!changedIds.includes(r.id))continue;const saved=await db.prepare('SELECT payload FROM primer_items WHERE id=? AND batch_id=?').bind(r.id,id).first<{payload:ArrayBuffer|null}>();const data=await unpack(saved?.payload||null);items.push({id:r.id,input:r.input,status:r.status,settings:JSON.parse(r.settings),...data,records:data.records?.map(({sequence,...record})=>record)});}
 return {...batch,settings:JSON.parse(batch.settings),items,...(changedIds?{partial:true,states:rows.results.map(r=>({id:r.id,status:r.status}))}:{})};
}
