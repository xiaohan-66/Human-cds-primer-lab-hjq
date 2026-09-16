"""Run official Primer-BLAST checks of supplied Studio lead pairs, at most 3 jobs in flight.
No local BLAST substitution; preserve complete official responses and effective settings.
"""
import csv,json,re,time,datetime,hashlib,html,os,urllib.request,urllib.parse,concurrent.futures,threading
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'results/primer-blast';OUT.mkdir(parents=True,exist_ok=True)
BASE=json.loads((ROOT/'data/primer-blast-settings.json').read_text()); rows=list(csv.DictReader((ROOT/'results/primer-blast-review.csv').open()))
lock=threading.Lock(); last_submit=[0.0]
def stamp():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def request(url,data=None):
 proxy=os.environ.get('HTTPS_PROXY');op=urllib.request.build_opener(urllib.request.ProxyHandler({'https':proxy}) if proxy else urllib.request.ProxyHandler())
 with op.open(urllib.request.Request(url,data=data,headers={'User-Agent':'PrimerStudioResearchBenchmark/0.2'}),timeout=60) as response:return response.read().decode('utf-8','replace')
def refresh(body):
 m=re.search(r'HTTP-EQUIV=["\']?Refresh.*?CONTENT=["\']\d+;\s*URL=([^"\']+)',body,re.I)
 return html.unescape(m.group(1)) if m else None
def clean(s):return html.unescape(re.sub('<[^>]+>',' ',s)).strip()
def analyze(body,row):
 if 'Primer pair 1' not in body:return {'status':'needs_review','reason':'No completed primer pair table; inspect original response'}
 pairs={k:re.findall(r'<th>'+k+r' primer</th><td>([ACGT]+)</td>',body) for k in ['Forward','Reverse']}
 if pairs['Forward']!=[row['forward']] or pairs['Reverse']!=[row['reverse']]:return {'status':'needs_review','reason':'Returned primer pair differs from submitted pair'}
 sections=re.split(r'<div class="prPairTl">([^<]+)</div>',body);counts={};products=[]
 for i in range(1,len(sections),2):
  title=sections[i];block=sections[i+1];found=re.findall(r'>([NX][MR]_\d+\.\d+)</a>([^<]*)<pre>(.*?)</pre>',block,re.S)
  counts[title]=len(found)
  for accession,desc,alignment in found:
   length=re.search(r'product length\s*=\s*(\d+)',alignment)
   products.append({'section':title,'accession':accession,'description':clean(desc),'length':int(length.group(1)) if length else None,'alignment':clean(alignment)})
 settings=dict((clean(a),clean(b)) for a,b in re.findall(r'<tr><td>(.*?)</td><td>(.*?)</td></tr>',body,re.S))
 return {'status':'completed','counts':counts,'products':products,'effective_settings':settings,'expected_accession_found':any(p['accession']==row['accession'] and p['section']=='Products on intended targets' for p in products)}
def run(row):
 gene=row['gene'];meta=OUT/(gene+'.json');raw=OUT/(gene+'.html')
 if meta.exists():return json.loads(meta.read_text())
 result={'gene':gene,'accession':row['accession'],'forward':row['forward'],'reverse':row['reverse'],'started_at':stamp(),'arm':'studio_adaptive_lead'}
 if not row['forward']:result.update(status='no_studio_candidate');meta.write_text(json.dumps(result,indent=2));return result
 fields={**BASE,'INPUT_SEQUENCE':row['accession'],'PRIMER_LEFT_INPUT':row['forward'],'PRIMER_RIGHT_INPUT':row['reverse']};result['submitted_settings']=fields
 try:
  if gene=='TP53' and (ROOT/'tmp/pilot-result.html').exists():
   body=(ROOT/'tmp/pilot-result.html').read_text(encoding='utf-8-sig');result['source']='retained pilot response'
  else:
   with lock:
    time.sleep(max(0,10-(time.monotonic()-last_submit[0])));last_submit[0]=time.monotonic()
    body=request('https://www.ncbi.nlm.nih.gov/tools/primer-blast/primertool.cgi',urllib.parse.urlencode(fields).encode())
   raw.write_text(body,encoding='utf-8');url=refresh(body);result['job_url']=url
   deadline=time.monotonic()+1200
   while url and time.monotonic()<deadline:
    meta.write_text(json.dumps({**result,'status':'running'},indent=2))
    time.sleep(20);body=request(url);raw.write_text(body,encoding='utf-8');url=refresh(body)
   if url:raise TimeoutError('Official job did not complete within 20 minutes; job URL retained')
  raw.write_text(body,encoding='utf-8');result.update(analyze(body,row));result['sha256_html']=hashlib.sha256(raw.read_bytes()).hexdigest()
 except Exception as e:result.update(status='request_error',error=str(e))
 result['completed_at']=stamp();meta.write_text(json.dumps(result,indent=2,ensure_ascii=False),encoding='utf-8');print(gene,result['status'],flush=True);return result
if __name__=='__main__':
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
  results=list(pool.map(run,rows))
 (OUT/'index.json').write_text(json.dumps([{'gene':r['gene'],'status':r['status'],'report':r['gene']+'.json'} for r in results],indent=2))
 print('SUMMARY',dict((s,sum(r['status']==s for r in results)) for s in set(r['status'] for r in results)),flush=True)
