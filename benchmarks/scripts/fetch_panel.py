import argparse, datetime, hashlib, json, pathlib, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
PANEL='''TP53 NM_000546
BRCA1 NM_007294
BRCA2 NM_000059
EGFR NM_005228
KRAS NM_004985
HRAS NM_005343
NRAS NM_002524
BRAF NM_004333
MAP2K1 NM_002755
MAPK1 NM_002745
MAPK3 NM_002746
AKT1 NM_005163
AKT2 NM_001626
PTEN NM_000314
PIK3CA NM_006218
MTOR NM_004958
APC NM_000038
CTNNB1 NM_001904
SMAD4 NM_005359
TGFBR2 NM_003242
RB1 NM_000321
CDKN1A NM_000389
CDKN2A NM_000077
CCND1 NM_053056
CDK2 NM_001798
CDK4 NM_000075
MYC NM_002467
BCL2 NM_000633
BAX NM_004324
CASP3 NM_004346
GAPDH NM_002046
ACTB NM_001101
HPRT1 NM_000194
TBP NM_003194
RPLP0 NM_001002
PPIA NM_021130
G6PD NM_000402
PGK1 NM_000291
LDHA NM_005566
SDHA NM_004168
HIF1A NM_001530
VEGFA NM_003376
IL6 NM_000600
TNF NM_000594
IFNG NM_000619
STAT1 NM_007315
STAT3 NM_003150
JAK1 NM_002227
JAK2 NM_004972
NFKB1 NM_003998
RELA NM_021975
NFE2L2 NM_006164
KEAP1 NM_012289
SOD1 NM_000454
SOD2 NM_000636
CAT NM_001752
GPX1 NM_000581
ATM NM_000051
ATR NM_001184
CHEK2 NM_007194'''
def main():
    rows=[dict(zip(['gene','requested_accession'],s.split())) for s in PANEL.splitlines()]
    assert len(rows)==60 and len({r['gene'] for r in rows})==60
    dest=ROOT/'data';dest.mkdir(parents=True,exist_ok=True)
    (dest/'panel.json').write_text(json.dumps(rows,indent=2)+'\n')
    records=[];excluded=[];sources=[]
    for offset in range(0,len(rows),10):
        batch=rows[offset:offset+10]
        url='https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?'+urllib.parse.urlencode({'db':'nuccore','id':','.join(r['requested_accession'] for r in batch),'rettype':'gb','retmode':'xml','tool':'primer-studio-benchmark'})
        for attempt in range(3):
            try:
                with urllib.request.urlopen(url,timeout=90) as response: raw=response.read()
                doc=ET.fromstring(raw);break
            except Exception:
                if attempt==2:raise
                time.sleep(5*(attempt+1))
        stamp=datetime.datetime.now(datetime.timezone.utc).isoformat()
        sources.append({'url':url,'retrieved_at':stamp,'sha256_xml':hashlib.sha256(raw).hexdigest()})
        by_id={r.findtext('GBSeq_accession-version','').split('.')[0]:r for r in doc.findall('GBSeq')}
        for item in batch:
            row=by_id.get(item['requested_accession']); reason=None
            if row is None:reason='record_not_returned'
            elif row.findtext('GBSeq_organism')!='Homo sapiens':reason='not_human'
            if reason:excluded.append({**item,'reason':reason});continue
            cds=next((x for x in row.findall('./GBSeq_feature-table/GBFeature') if x.findtext('GBFeature_key')=='CDS'),None)
            loc=cds.findtext('GBFeature_location','') if cds is not None else ''
            import re
            if not re.fullmatch(r'\d+\.\.\d+',loc):excluded.append({**item,'reason':'unsupported_cds_location','location':loc});continue
            quals={x.findtext('GBQualifier_name'):x.findtext('GBQualifier_value') for x in cds.findall('./GBFeature_quals/GBQualifier')}
            gene=quals.get('gene','')
            if gene!=item['gene']:excluded.append({**item,'reason':'gene_mismatch','returned_gene':gene});continue
            start,end=map(int,loc.split('..'));seq=row.findtext('GBSeq_sequence','').upper()
            records.append({**item,'accession':row.findtext('GBSeq_accession-version'),'organism':'Homo sapiens','title':row.findtext('GBSeq_definition'),'sequence':seq,'start':start,'end':end,'protein':quals.get('protein_id',''),'recommendation':'fixed accession benchmark panel; not a MANE assertion','retrieved_at':stamp,'sequence_sha256':hashlib.sha256(seq.encode()).hexdigest()})
        print(f'Fetched {offset+len(batch)}/60; retained {len(records)}; excluded {len(excluded)}',flush=True)
        time.sleep(1.1)
    (dest/'records.json').write_text(json.dumps(records,indent=2)+'\n')
    (dest/'provenance.json').write_text(json.dumps({'selection':'Convenience panel selected before running either designer; one fixed RefSeq accession per gene. No selection by design outcome.','sources':sources,'excluded':excluded},indent=2)+'\n')
if __name__=='__main__':main()
