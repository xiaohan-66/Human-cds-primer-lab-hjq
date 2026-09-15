import {env} from 'cloudflare:workers';
export function ncbiBindings(){const bindings=env as unknown as {DB?:D1Database;NCBI_API_KEY?:string;NCBI_EMAIL?:string};if(!bindings.DB)throw Error('共享缓存暂时不可用，请稍后重试。');return {db:bindings.DB,apiKey:bindings.NCBI_API_KEY,email:bindings.NCBI_EMAIL};}
