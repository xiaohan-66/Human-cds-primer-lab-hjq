from pathlib import Path
import json,urllib.request,urllib.parse,time,hashlib,datetime,re,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'examples';D.mkdir(exist_ok=True);C=D/'fetch-cache';C.mkdir(exist_ok=True)
GENES='''RPA1 RPA2 RPA3 PCNA RFC1 RFC2 RFC3 RFC4 RFC5 MCM2 MCM3 MCM4 MCM5 MCM6 MCM7 MCM8 MCM9 MCM10 POLA1 POLA2 POLD1 POLD2 POLD3 POLD4 POLE POLE2 POLE3 POLE4 LIG1 LIG3 LIG4 XRCC1 XRCC2 XRCC3 XRCC4 XRCC5 XRCC6 RAD50 RAD51 RAD52 RAD54L RAD17 RAD9A HUS1 NBN MRE11 EXO1 FEN1 RBBP8 BLM WRN RECQL RECQL4 RECQL5 ERCC1 ERCC2 ERCC3 ERCC4 ERCC5 ERCC6 XPA XPC DDB1 DDB2 PARP1 PARP2 PARP3 PNKP APEX1 APEX2 OGG1 MUTYH UNG MPG TDG SMUG1 MLH1 MSH2 MSH3 MSH6 PMS2 FANCA FANCC FANCD2 FANCI FANCL UBE2T PALB2 BRIP1 BARD1 CHEK1 WEE1 CDC25A CDC25B CDC25C CDC6 CDT1 CDC7 DBF4 CDC45 CDK1 CDK6 CDK7 CDK9 CDK12 CDK13 CCNA2 CCNB1 CCNE1 E2F1 E2F2 E2F3 RBX1 SKP1 CUL1 CUL3 CUL4A CUL4B FBXW7 UBE2C UBE2S UBE2D1 UBE2N USP7 USP10 USP28 UBR5 HUWE1 PSMA1 PSMA2 PSMA3 PSMA4 PSMA5 PSMA6 PSMA7 PSMB1 PSMB2 PSMB3 PSMB4 PSMB5 PSMB6 PSMB7 VCP HSPA8 HSP90AA1 HSP90AB1 HSPD1 HSPE1 DNAJB1 HSPA1A HSPA5 CALR CANX PDIA3 PDIA4 PDIA6 P4HB SEC61A1 SRP54 SRP68 SRP72 EEF1A1 EEF2 EIF4E EIF4A1 EIF4G1 EIF3A EIF3B EIF3D RPL3 RPL4 RPL5 RPL6 RPL7 RPL8 RPL9 RPL10 RPL11 RPL12 RPS2 RPS3 RPS4X RPS5 RPS6 RPS7 RPS8 RPS9 RPS10 RPS11 RPS12'''.split()
(D/'candidate-gene-pool.json').write_text(json.dumps(GENES,indent=2)+'\n')
original=json.loads((ROOT/'data/records.json').read_text());records=list(original);attempts=[]
def fetch(endpoint,params):
 url='https://eutils.ncbi.nlm.nih.gov/entrez/eutils/'+endpoint+'?'+urllib.parse.urlencode(params)
 for i in range(3):
  try:
   time.sleep(.4)
   with urllib.request.urlopen(url,timeout=60) as f:raw=f.read()
   return raw,{'url':url,'retrieved_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest()}
  except Exception:
   if i==2:raise
   time.sleep(3*(i+1))
for ix,gene in enumerate(GENES):
 cache=C/(gene+'.json')
 if cache.exists():result=json.loads(cache.read_text())
 else:
  result={'gene':gene,'sources':[]}
  try:
   raw,source=fetch('esearch.fcgi',{'db':'nuccore','term':gene+'[Gene Name] AND txid9606[Organism:exp] AND refseq[filter] AND biomol_mrna[PROP]','retmode':'json','retmax':10});result['sources'].append(source);ids=json.loads(raw)['esearchresult']['idlist']
   if not ids:raise ValueError('No RefSeq mRNA returned')
   raw,source=fetch('efetch.fcgi',{'db':'nuccore','id':','.join(ids),'rettype':'gb','retmode':'xml'});result['sources'].append(source);doc=ET.fromstring(raw);eligible=[]
   for r in doc.findall('GBSeq'):
    acc=r.findtext('GBSeq_accession-version','')
    if not acc.startswith('NM_') or r.findtext('GBSeq_organism')!='Homo sapiens':continue
    cds=next((x for x in r.findall('./GBSeq_feature-table/GBFeature') if x.findtext('GBFeature_key')=='CDS'),None)
    if cds is None:continue
    loc=cds.findtext('GBFeature_location','');q={x.findtext('GBQualifier_name'):x.findtext('GBQualifier_value') for x in cds.findall('./GBFeature_quals/GBQualifier')}
    if q.get('gene')!=gene or not re.fullmatch(r'\d+\.\.\d+',loc):continue
    start,end=map(int,loc.split('..'));seq=r.findtext('GBSeq_sequence','').upper();eligible.append({'gene':gene,'requested_accession':acc.split('.')[0],'accession':acc,'organism':'Homo sapiens','title':r.findtext('GBSeq_definition'),'sequence':seq,'start':start,'end':end,'protein':q.get('protein_id',''),'retrieved_at':source['retrieved_at'],'sequence_sha256':hashlib.sha256(seq.encode()).hexdigest(),'recommendation':'example pool: lowest numeric NM accession among first 10 search records with simple CDS; not MANE selection'})
   if not eligible:raise ValueError('No simple-CDS human NM record with exact gene symbol in first ten search records')
   eligible.sort(key=lambda r:int(r['requested_accession'].split('_')[1]));result.update(status='retained',record=eligible[0])
  except Exception as e:result.update(status='excluded',reason=str(e))
  cache.write_text(json.dumps(result,ensure_ascii=True,indent=2))
 attempts.append({k:v for k,v in result.items() if k!='record'})
 if result['status']=='retained':records.append(result['record'])
 (D/'pool-records.json').write_text(json.dumps(records,ensure_ascii=True,indent=2)+'\n');(D/'retrieval-log.json').write_text(json.dumps(attempts,indent=2)+'\n')
 print(ix+1,len(GENES),gene,result['status'],flush=True)
print('Retained pool',len(records),flush=True)
