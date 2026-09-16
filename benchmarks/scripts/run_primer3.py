import json,pathlib,time,platform,os
import primer3
ROOT=pathlib.Path(__file__).resolve().parents[1]
input_path=pathlib.Path(os.environ.get('PRIMER_BENCHMARK_RECORDS',str(ROOT/'data/records.json')))
output_dir=pathlib.Path(os.environ.get('PRIMER_BENCHMARK_OUT',str(ROOT/'results')));output_dir.mkdir(parents=True,exist_ok=True)
records=json.loads(input_path.read_text(encoding='utf-8-sig'))
# Shared exact-CDS task: fixed 5-prime endpoints, intact stop, 18-25 nt, Tm 55-65, delta <=3.
# Primer3 retains its standard structure/GC/poly-X acceptance filters; these differ from Studio ranking.
config={'PRIMER_TASK':'generic','PRIMER_PICK_LEFT_PRIMER':1,'PRIMER_PICK_RIGHT_PRIMER':1,'PRIMER_PICK_INTERNAL_OLIGO':0,'PRIMER_NUM_RETURN':5,'PRIMER_MIN_SIZE':18,'PRIMER_OPT_SIZE':20,'PRIMER_MAX_SIZE':25,'PRIMER_MIN_TM':55,'PRIMER_OPT_TM':60,'PRIMER_MAX_TM':65,'PRIMER_PAIR_MAX_DIFF_TM':3,'PRIMER_SALT_MONOVALENT':50,'PRIMER_SALT_DIVALENT':1.5,'PRIMER_DNTP_CONC':0.6,'PRIMER_DNA_CONC':50,'PRIMER_TM_FORMULA':1,'PRIMER_SALT_CORRECTIONS':1,'PRIMER_EXPLAIN_FLAG':1}
results=[]
for row in records:
    seq=row['sequence'][row['start']-1:row['end']]
    args={'SEQUENCE_ID':row['accession'],'SEQUENCE_TEMPLATE':seq,'SEQUENCE_FORCE_LEFT_START':0,'SEQUENCE_FORCE_RIGHT_START':len(seq)-1}
    t=time.perf_counter()
    try:
        raw=primer3.bindings.design_primers(args,{**config,'PRIMER_PRODUCT_SIZE_RANGE':[[len(seq),len(seq)]]})
        pairs=[]
        for i in range(raw.get('PRIMER_PAIR_NUM_RETURNED',0)):
            fpos,flen=raw[f'PRIMER_LEFT_{i}'];rpos,rlen=raw[f'PRIMER_RIGHT_{i}']
            pairs.append({'forward':{'sequence':raw[f'PRIMER_LEFT_{i}_SEQUENCE'],'start':row['start']+fpos,'end':row['start']+fpos+flen-1,'tm':raw[f'PRIMER_LEFT_{i}_TM']},'reverse':{'sequence':raw[f'PRIMER_RIGHT_{i}_SEQUENCE'],'start':row['start']+rpos-rlen+1,'end':row['start']+rpos,'tm':raw[f'PRIMER_RIGHT_{i}_TM']},'productStart':row['start']+fpos,'productEnd':row['start']+rpos,'productLength':raw[f'PRIMER_PAIR_{i}_PRODUCT_SIZE']})
        result={'status':'candidates' if pairs else 'no_candidates','pairs':pairs,'raw':raw}
    except Exception as e:result={'status':'error','error':str(e),'pairs':[]}
    results.append({'gene':row['gene'],'accession':row['accession'],'elapsed_ms':1000*(time.perf_counter()-t),**result})
    print(row['gene'],result['status'],flush=True)
(output_dir/'primer3.json').write_text(json.dumps({'primer3_py':primer3.__version__,'python':platform.python_version(),'config':config,'results':results},indent=2)+'\n')
