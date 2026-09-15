export type Cached={xml:string;fetchedAt:number};
export interface Store{
 get(q:string):Promise<Cached|null>;
 put(q:string,value:Cached):Promise<void>;
 acquire(q:string,owner:string,now:number):Promise<boolean>;
 release(q:string,owner:string):Promise<void>;
 slot(now:number):Promise<number>;
 cooldown(until:number):Promise<void>;
}
export class D1Store implements Store{
 constructor(private db:D1Database){}
 async get(q:string){const row=await this.db.prepare('SELECT payload, fetched_at FROM sequence_cache WHERE query = ?').bind(q).first<{payload:ArrayBuffer;fetched_at:number}>();if(!row)return null;const bytes=new Uint8Array(row.payload);const xml=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();return {xml,fetchedAt:row.fetched_at};}
 async put(q:string,v:Cached){const bytes=await new Response(new Blob([v.xml]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();if(bytes.byteLength>1500000)return;await this.db.prepare('INSERT INTO sequence_cache(query,payload,fetched_at) VALUES(?,?,?) ON CONFLICT(query) DO UPDATE SET payload=excluded.payload,fetched_at=excluded.fetched_at').bind(q,bytes,v.fetchedAt).run();}
 async acquire(q:string,owner:string,now:number){const row=await this.db.prepare('INSERT INTO query_leases(query,owner,expires_at) VALUES(?,?,?) ON CONFLICT(query) DO UPDATE SET owner=excluded.owner,expires_at=excluded.expires_at WHERE query_leases.expires_at <= ? RETURNING owner').bind(q,owner,now+90000,now).first<{owner:string}>();return row?.owner===owner;}
 async release(q:string,owner:string){await this.db.prepare('DELETE FROM query_leases WHERE query = ? AND owner = ?').bind(q,owner).run();}
 async slot(now:number){const row=await this.db.prepare("INSERT INTO upstream_gate(id,next_at) VALUES('ncbi',?) ON CONFLICT(id) DO UPDATE SET next_at=excluded.next_at WHERE upstream_gate.next_at <= ? RETURNING next_at").bind(now+1100,now).first();if(row)return 0;const gate=await this.db.prepare("SELECT next_at FROM upstream_gate WHERE id='ncbi'").first<{next_at:number}>();return Math.max(1,(gate?.next_at??now+1100)-now);}
 async cooldown(until:number){await this.db.prepare("INSERT INTO upstream_gate(id,next_at) VALUES('ncbi',?) ON CONFLICT(id) DO UPDATE SET next_at=MAX(upstream_gate.next_at,excluded.next_at)").bind(until).run();}
}
