import importlib.util,json,zipfile,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('official_runner',root/'scripts/run_primer_blast.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
reports=json.loads((root/'results/primer-blast-reports.json').read_text(encoding='utf-8'))
with zipfile.ZipFile(root/'results/primer-blast-reports.zip') as archive:
 for r in reports:
  if r['status']!='completed':continue
  raw=archive.read(r['gene']+'.html');assert hashlib.sha256(raw).hexdigest()==r['sha256_html']
  parsed=m.analyze(raw.decode('utf-8'),r)
  assert parsed['status']=='completed' and parsed['counts']==r['counts']
  assert parsed['expected_accession_found']==r['expected_accession_found']
  wrong={**r,'forward':'AAAAAAAAAAAAAAAAAA'}
  assert m.analyze(raw.decode('utf-8'),wrong)['status']=='needs_review'
assert m.analyze('<html>Queued</html>',{'forward':'A','reverse':'T'})['status']=='needs_review'
print('Official report integrity and pair-identity rejection checks passed; no network requests.')
