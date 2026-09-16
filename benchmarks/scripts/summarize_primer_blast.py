"""Summarize retained official responses without converting them into A-D truth labels."""
from pathlib import Path
import json,csv,zipfile,hashlib
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'results/primer-blast'
rows=list(csv.DictReader((ROOT/'results/primer-blast-review.csv').open())); reports=[json.loads((D/(r['gene']+'.json')).read_text(encoding='utf-8')) for r in rows]
assert len(reports)==60 and all(r['status']!='running' for r in reports), 'Official checks still running'
records=[]
for r in reports:
 f=D/(r['gene']+'.html')
 if r['status']=='completed':
  assert hashlib.sha256(f.read_bytes()).hexdigest()==r['sha256_html']
  assert r['effective_settings'].get('Max target size')=='20000'
  assert r['effective_settings'].get('Max number of Blast target sequences')=='500'
 records.append({'gene':r['gene'],'accession':r['accession'],'status':r['status'],'expected_accession_found':r.get('expected_accession_found',''),'intended_products':r.get('counts',{}).get('Products on intended targets',''),'potentially_unintended_products':r.get('counts',{}).get('Products on potentially unintended templates',''),'blast_hits_analyzed':r.get('effective_settings',{}).get('Number of Blast hits analyzed',''),'report_sha256':r.get('sha256_html',''),'completed_at':r.get('completed_at','')})
with (ROOT/'results/primer-blast-summary.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=records[0].keys());w.writeheader();w.writerows(records)
completed=[r for r in reports if r['status']=='completed'];stats={'panel_genes':60,'submitted_pairs':sum(bool(r['forward']) for r in reports),'completed':len(completed),'no_candidate':sum(r['status']=='no_studio_candidate' for r in reports),'unresolved':sum(r['status'] not in ['completed','no_studio_candidate'] for r in reports),'expected_detected':sum(r['expected_accession_found'] for r in completed),'with_additional_products':sum(r['counts'].get('Products on potentially unintended templates',0)>0 for r in completed)}
(ROOT/'results/primer-blast-summary.json').write_text(json.dumps(stats,indent=2)+'\n')
# Archive byte-for-byte retained HTML and structured extraction; inspect without remote job availability.
with zipfile.ZipFile(ROOT/'results/primer-blast-reports.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(D.rglob("*")):
  if p.suffix in ['.html','.json']:z.write(p,str(p.relative_to(D)))
# A single structured file is convenient for analysis and keeps the repo browsable.
(ROOT/'results/primer-blast-reports.json').write_text(json.dumps(reports,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
text=f'''# Official Primer-BLAST review

60-gene frozen panel; {stats['submitted_pairs']} available Studio adaptive lead pairs submitted to the official NCBI Primer-BLAST service. Three genes without Studio candidates stay in the denominator.

| Observation | Count |
|---|---:|
| Completed official reports | {stats['completed']} |
| Expected accession product detected | {stats['expected_detected']} |
| Reports with potentially unintended products | {stats['with_additional_products']} |
| No Studio candidate | {stats['no_candidate']} |
| Unresolved requests / reports | {stats['unresolved']} |

Additional products may include same-gene isoforms and must not automatically be classified as other-gene off-targets. A report with no additional products is not proof of complete specificity. The search was limited to human RefSeq RNA, with a 20,000-bp target-product limit and 500 BLAST target sequences; database contents may change.

This is an external review of supplied Studio pairs, **not a comparison of de novo design yield against Primer-BLAST**, nor a matched benchmark of the Studio BLAST pairing engine. Primer3 lead pairs were not submitted in this arm. No precision/recall or A-D calibration is inferred.

## Evidence and reproducibility

- [Per-gene summary](primer-blast-summary.csv)
- [Full structured results](primer-blast-reports.json): submitted and effective settings, pair identity, reported products, timestamps and original-report hashes.
- [Original HTML reports and extracted JSON](primer-blast-reports.zip): archived for independent review.
- [Request settings](../data/primer-blast-settings.json)
- [Runner](../scripts/run_primer_blast.py): at most three active jobs, at least ten seconds between submissions, twenty seconds between status checks per job. Do not run this network benchmark automatically in CI.

Run from the repository root: `python benchmarks/scripts/run_primer_blast.py`, then `python benchmarks/scripts/summarize_primer_blast.py`. `HTTPS_PROXY` is optional. Existing report files are retained; use a separate copy of the repository for a new dated run. NCBI's service and form fields can change, so inspect actual returned settings.

The completed-report parser verifies that the official forward and reverse sequences match the supplied pair. It checks the expected accession in the intended-product section, and extracts product-level counts; these are not counts of distinct genes. Original reports are authoritative if extraction and display disagree.
'''
(ROOT/'results/PRIMER-BLAST.md').write_text(text,encoding='utf-8');print(json.dumps(stats))
