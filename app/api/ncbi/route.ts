import {ncbiBindings} from '@/db/bindings';
import {D1Store} from '@/lib/ncbi/store';
import {createService,NcbiError} from '@/lib/ncbi/service';
import seeds from '@/data/ncbi-seeds.json';
export async function GET(request:Request){
 try{const {db,apiKey,email}=ncbiBindings();const service=createService({store:new D1Store(db),apiKey,email,seeds});const result=await service.search(new URL(request.url).searchParams.get('q')||'');return Response.json(result,{headers:{'Cache-Control':'private, max-age=300','X-Sequence-Source':result.source}});}
 catch(e){const error=e instanceof NcbiError?e:new NcbiError('检索服务暂时不可用，请稍后重试。',503,10);return Response.json({error:error.message,retryAfter:error.retryAfter},{status:error.status,headers:{'Cache-Control':'no-store',...(error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});}
}
