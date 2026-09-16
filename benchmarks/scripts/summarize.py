import csv,hashlib,json,pathlib,statistics,urllib.parse
ROOT=pathlib.Path(__file__).resolve().parents[1]
records=json.loads((ROOT/'data/records.json').read_text(encoding='utf-8-sig')); studio=json.loads((ROOT/'results/studio.json').read_text(encoding='utf-8-sig')); p3=json.loads((ROOT/'results/primer3.json').read_text(encoding='utf-8-sig'))
lookup={r['gene']:r for r in records}
def check(row,pair):
    seq=row['sequence'];f=pair['forward'];r=pair['reverse'];rc=lambda s:s.translate(str.maketrans('ACGT','TGCA'))[::-1]
    checks={'forward_matches':seq[f['start']-1:f['end']]==f['sequence'],'reverse_matches':rc(seq[r['start']-1:r['end']])==r['sequence'],'length_18_25':18<=len(f['sequence'])<=25 and 18<=len(r['sequence'])<=25,'cds_covered':pair['productStart']<=row['start'] and pair['productEnd']>=row['end'],'length_consistent':pair['productEnd']-pair['productStart']+1==pair['productLength'],'tm_constraints':55-1e-6<=f['tm']<=65+1e-6 and 55-1e-6<=r['tm']<=65+1e-6 and abs(f['tm']-r['tm'])<=3+1e-6}
    return checks
arms={'studio_exact':[r for r in studio['results'] if r['mode']=='exact'],'primer3_exact':p3['results'],'studio_adaptive':[r for r in studio['results'] if r['mode']=='adaptive']}
assert len(records)==60 and len(lookup)==60, 'Expected 60 unique genes'
assert all(hashlib.sha256(r['sequence'].encode()).hexdigest()==r['sequence_sha256'] for r in records), 'Reference sequence checksum mismatch'
assert all(len(rows)==60 for rows in arms.values()), 'Missing benchmark attempts'
summary={};validation=[];csvrows=[]
for name,rows in arms.items():
    if not rows:continue
    for r in rows:
        validations=[check(lookup[r['gene']],p) for p in r['pairs']]
        for i,v in enumerate(validations):validation.append({'arm':name,'gene':r['gene'],'rank':i+1,**v})
        csvrows.append({'arm':name,'gene':r['gene'],'accession':r['accession'],'status':r['status'],'pairs':len(r['pairs']),'all_returned_pairs_valid':all(all(v.values()) for v in validations) if validations else '', 'cds_length':lookup[r['gene']]['end']-lookup[r['gene']]['start']+1,'elapsed_ms':round(r['elapsed_ms'],3),'error':r.get('error','')})
    summary[name]={'genes':len(rows),'genes_with_candidates':sum(bool(r['pairs']) for r in rows),'pairs':sum(len(r['pairs']) for r in rows),'errors':sum(r['status']=='error' for r in rows),'no_candidates':sum(not r['pairs'] and r['status']!='error' for r in rows),'median_ms':round(statistics.median(r['elapsed_ms'] for r in rows),3),'total_ms':round(sum(r['elapsed_ms'] for r in rows),3)}
invalid=[r for r in validation if not all(v for k,v in r.items() if k not in ['arm','gene','rank'])]
official_path=ROOT/'results/primer-blast-summary.json'
official=json.loads(official_path.read_text(encoding='utf-8')) if official_path.exists() else None
summary['scope']={'selection':'60 fixed-accession convenience genes; not random/genome representative','records':len(records),'unique_genes':len(lookup),'primer_blast':official if official else 'not_run','wet_lab':'not_run','invalid_returned_pairs':len(invalid),'record_sha256':hashlib.sha256((ROOT/'data/records.json').read_bytes()).hexdigest()}
official_records_path=ROOT/'results/primer-blast-reports.json'
official_records={r['gene']:r for r in json.loads(official_records_path.read_text(encoding='utf-8'))} if official_records_path.exists() else {}
(ROOT/'results/summary.json').write_text(json.dumps(summary,indent=2)+'\n')
(ROOT/'results/validation.json').write_text(json.dumps(validation,indent=2)+'\n')
with (ROOT/'results/per-gene.csv').open('w',newline='',encoding='utf-8') as f:
    writer=csv.DictWriter(f,fieldnames=csvrows[0].keys());writer.writeheader();writer.writerows(csvrows)
# Official service handoff: every status remains pending until an actual report is retained.
review=[]
for r in arms['studio_adaptive'] or arms['studio_exact']:
    p=r['pairs'][0] if r['pairs'] else None
    params={'INPUT_SEQUENCE':r['accession'],'PRIMER_LEFT_INPUT':p['forward']['sequence'],'PRIMER_RIGHT_INPUT':p['reverse']['sequence'],'ORGANISM':'Homo sapiens (taxid:9606)'} if p else {}
    review.append({'gene':r['gene'],'accession':r['accession'],'forward':p['forward']['sequence'] if p else '', 'reverse':p['reverse']['sequence'] if p else '', 'official_url':'https://www.ncbi.nlm.nih.gov/tools/primer-blast/?'+urllib.parse.urlencode(params) if p else '', 'status':official_records.get(r['gene'],{}).get('status','not_run' if p else 'no_studio_candidate'),'required_database':'RefSeq RNA','required_max_product_bp':20000,'required_max_hits':500,'raw_report_path':'primer-blast-reports.zip' if r['gene'] in official_records and p else '', 'completed_at':official_records.get(r['gene'],{}).get('completed_at',''),'discordance_notes':''})
with (ROOT/'results/primer-blast-review.csv').open('w',newline='',encoding='utf-8') as f:
    writer=csv.DictWriter(f,fieldnames=review[0].keys());writer.writeheader();writer.writerows(review)
lines=['# Benchmark results','', 'Fixed panel: 60 distinct human genes, one versioned RefSeq transcript per gene.','', '| Arm | Genes with candidates | Returned pairs | Errors | No candidate |','|---|---:|---:|---:|---:|']
for name,stats in summary.items():
    if name=='scope':continue
    lines.append(f"| {name} | {stats['genes_with_candidates']}/{stats['genes']} | {stats['pairs']} | {stats['errors']} | {stats['no_candidates']} |")
lines+=['',f'Independent coordinate/sequence/basic-constraint checks: {len(validation)} returned pairs; {len(invalid)} failures. Tm checks use each engine’s reported values, not an independent thermodynamic truth.','', '**These are candidate-yield measurements, not specificity accuracy or wet-lab success.** Primer3 retains its default structural filters and uses a different Tm implementation; Studio ranks warnings rather than enforcing the same hard exclusions. Adaptive Studio is a separate task and must not be compared directly with exact-CDS Primer3.','', ('Official Primer-BLAST supplied-pair review: '+str(official['completed'])+' completed reports. See [official report](PRIMER-BLAST.md). This is external review of Studio adaptive leads, not de novo design or a matched pairing-engine accuracy benchmark. No calibrated A–D thresholds are claimed.') if official else 'Primer-BLAST: **not run**. No agreement, precision, recall, or calibrated A–D thresholds are claimed. The review CSV provides a traceable queue, not completed validation.','', '## Rejected biological cases','']
for r in arms['studio_adaptive']:
    if r['status']=='error':lines.append(f"- {r['gene']} / {r['accession']}: `{r['error']}`")
lines+=['','All attempts remain in per-gene.csv, including failures. This fixed convenience panel is not a random or representative sample of the human transcriptome.','', 'See [protocol](../README.md) for task matching, timing limitations and reproduction.']
(ROOT/'results/REPORT.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps(summary,indent=2))
if invalid:raise SystemExit('Returned-pair invariants failed; inspect validation.json')

