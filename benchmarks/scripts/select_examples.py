from pathlib import Path
import csv,hashlib,json,zipfile
ROOT=Path(__file__).resolve().parents[1];D=ROOT/'examples'
records=json.loads((D/'evaluated-records.json').read_text());studio=json.loads((D/'results/studio.json').read_text(encoding='utf-8'));p3=json.loads((D/'results/primer3.json').read_text())
lookup={r['gene']:r for r in records};arms={'studio_exact':[r for r in studio['results'] if r['mode']=='exact'],'primer3_exact':p3['results'],'studio_adaptive':[r for r in studio['results'] if r['mode']=='adaptive']}
assert all(len(rs)==len(records) for rs in arms.values())
by={name:{r['gene']:r for r in rs} for name,rs in arms.items()};eligible=[r['gene'] for r in records if all(by[name][r['gene']]['pairs'] for name in arms)];selected=eligible[:60];assert len(selected)==60
checks=0
for gene in selected:
 record=lookup[gene];seq=record['sequence'];assert hashlib.sha256(seq.encode()).hexdigest()==record['sequence_sha256']
 for name in arms:
  for p in by[name][gene]['pairs']:
   f=p['forward'];r=p['reverse'];rc=seq[r['start']-1:r['end']].translate(str.maketrans('ACGT','TGCA'))[::-1]
   assert seq[f['start']-1:f['end']]==f['sequence'] and rc==r['sequence']
   assert 18<=len(f['sequence'])<=25 and 18<=len(r['sequence'])<=25
   assert 55-1e-6<=f['tm']<=65+1e-6 and 55-1e-6<=r['tm']<=65+1e-6 and abs(f['tm']-r['tm'])<=3+1e-6
   assert p['productStart']<=record['start'] and p['productEnd']>=record['end'] and p['productLength']==p['productEnd']-p['productStart']+1
   checks+=1
rows=[{'gene':g,'accession':lookup[g]['accession'],**{name+'_pairs':len(by[name][g]['pairs']) for name in arms}} for g in selected]
with (D/'selected-60.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=rows[0].keys());w.writeheader();w.writerows(rows)
allrows=[{'gene':r['gene'],'accession':r['accession'],'arm':name,'status':r['status'],'pairs':len(r['pairs']),'selected':r['gene'] in selected,'error':r.get('error','')} for name,rs in arms.items() for r in rs]
with (D/'all-attempts.csv').open('w',newline='',encoding='utf-8') as f:
 w=csv.DictWriter(f,fieldnames=allrows[0].keys());w.writeheader();w.writerows(allrows)
(D/'selected-records.json').write_text(json.dumps([lookup[g] for g in selected],indent=2)+'\n')
summary={'selection':'Post hoc: first 60 genes in evaluated input order with candidates in all three arms. Curated examples, not a performance estimate.','evaluated_genes':len(records),'eligible_genes':len(eligible),'selected_genes':60,'checked_pairs':checks,'selected':{name:{'with_candidates':60,'total':60,'pairs':sum(len(by[name][g]['pairs']) for g in selected)} for name in arms},'whole_evaluated_pool':{name:{'with_candidates':sum(bool(r['pairs']) for r in rs),'total':len(rs)} for name,rs in arms.items()}}
(D/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
with zipfile.ZipFile(D/'raw-design-results.zip','w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in [D/'results/studio.json',D/'results/primer3.json',D/'evaluated-records.json',D/'pool-records.json',D/'retrieval-log.json',D/'candidate-gene-pool.json']:z.write(p,str(p.relative_to(D)))
(D/'README.md').write_text(f'''# 60 curated design examples

**Selected after observing design outcomes. Not an unbiased benchmark or a claim of >90% general success.** The original [60-gene benchmark](../results/REPORT.md) remains unchanged and includes every unsuccessful case.

We evaluated {len(records)} distinct genes across Studio exact-CDS, Primer3 exact-CDS and Studio adaptive settings. {len(eligible)} genes returned at least one candidate in all three arms. The first 60 in the frozen input order form this example set, so all three candidate-yield figures are 60/60 (100%) **by selection**.

These are candidate-generation examples, not experimentally validated primers, uniquely specific pairs, or a new official Primer-BLAST cohort. The official 57-pair review elsewhere in this repository belongs to the original panel.

## Evidence

- [Selected genes, accessions and pair counts](selected-60.csv)
- [Selected sequences and CDS coordinates](selected-records.json)
- [All evaluated outcomes, including failures](all-attempts.csv)
- [Summary, including unselected-pool yields](summary.json)
- [Raw outputs, evaluated sequence snapshot and retrieval provenance](raw-design-results.zip)

All {checks} returned pairs for selected genes passed template-sequence, coordinate, CDS coverage, length and reported-Tm checks. These checks do not establish specificity or wet-lab success.

## Selection and provenance

The expansion started with the original 60 records. Additional candidates came from the ordered 190-symbol list in the archive. For each symbol, up to ten NCBI RefSeq mRNA records were retrieved; the lowest numeric NM accession with a simple CDS and exact gene-symbol match was selected. This is not a MANE/canonical transcript guarantee. Exclusions and request provenance are recorded.

The evaluated snapshot contains the original 60 plus {len(records)-60} additional genes. Acquisition continued briefly while this snapshot was evaluated, then stopped once at least 60 eligible examples were available. Extra fetched records were not silently counted as evaluated. The archive separates the evaluated snapshot from the acquisition pool.

## Reproduce

Extract the archive into this directory, then set `PRIMER_BENCHMARK_RECORDS=benchmarks/examples/evaluated-records.json` and `PRIMER_BENCHMARK_OUT=benchmarks/examples/results` in your shell. Run the existing Studio and Primer3 runners described in [the benchmark protocol](../README.md), then run `python benchmarks/scripts/select_examples.py`. Do not overwrite the original benchmark records. For a new acquisition, use `fetch_example_pool.py`; NCBI records may change.
''',encoding='utf-8')
print(json.dumps(summary))
