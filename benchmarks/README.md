# Human CDS benchmark · 60 genes

This is a reproducible **candidate-generation benchmark**, not a specificity accuracy study. The [full report](results/REPORT.md), [per-gene outcomes](results/per-gene.csv), and raw engine outputs are committed, including failed attempts.

## Dataset

The accession panel was fixed before running either engine: 60 distinct human genes, one RefSeq transcript per gene. This convenience panel spans signaling, DNA repair, metabolism and common reference genes; it is not random, genome-wide, or an assertion of MANE/canonical transcript selection. All 60 requested records were retained, with no outcome-based substitutions. Sequences, accession versions, CDS coordinates, retrieval URLs/timestamps and checksums are in [data](data/). Network retrieval is separate from design timing.

## Matched task and parameters

| Setting | Studio exact / Primer3 exact |
|:--|:--|
| Template | Identical frozen transcript and annotated CDS |
| Product | Full CDS, fixed endpoints, stop retained |
| Primer length | 18–25 nt |
| Tm / pair difference | 55–65 °C / ≤3 °C |
| Return limit | Up to 5 pairs per gene |
| Primer3 | primer3-py 2.3.1; full arguments in results/primer3.json |

Primer3 fixes the left/right 5′ endpoints to the CDS ends. It retains its own default GC, repeat and structural acceptance filters. Studio's quality ranking and thermodynamic implementation differ. Consequently, candidate yield is **not a controlled measure of algorithm superiority**. The third arm, Studio adaptive, allows flanking sequence and expansion up to 500 bp per side; it answers a different task and is reported separately.

565 returned pairs were checked for template matching, reverse-complement orientation, coordinates, full CDS coverage, product length, primer length and reported Tm constraints. There were zero invariant failures. The Tm check uses engine-reported values; it is not an independent thermodynamic reference. Single-run local timings are exploratory and do not support speedup claims.

## Reproduce

From the repository root, with Node 24 and Python 3.12:

```sh
npm ci
python -m pip install -r benchmarks/requirements.txt
node --import ./tests/register.mjs --experimental-transform-types benchmarks/scripts/run_studio.mjs
python benchmarks/scripts/run_primer3.py
python benchmarks/scripts/summarize.py
```

These commands use the committed sequences and require no NCBI requests. They overwrite results with the new run. To intentionally refresh the dataset, run `python benchmarks/scripts/fetch_panel.py`; this changes the reference snapshot, so compare checksums before comparing results. On Windows, install primer3-py into an ASCII-only environment path if its native library cannot load its thermodynamic data from a Unicode path.

## Primer-BLAST comparison: pending

No official Primer-BLAST reports have been collected in this release. [The review queue](results/primer-blast-review.csv) contains 57 available Studio adaptive lead pairs and three unavailable cases, **not completed validation**. Links are a convenience: verify all fields in the official form before submission.

For each available pair, use the frozen accession version, both supplied primers, Homo sapiens, RefSeq RNA, maximum target amplicon 20,000 bp and 500 returned target sequences. Record the actual database/date, all mismatch and detection settings, raw report, completion time, expected product, same-gene products and other-gene products. Compare these against Studio reconstruction of the same query conditions; log unavailable records and truncated searches separately. Do not equate a basic BLAST URL API request with an official Primer-BLAST run.

The queue currently covers Studio leads only. A complete cross-tool study must also retain and evaluate Primer3 leads under the same specificity protocol. Neither agreement rates nor precision/recall can be reported until those reports and a defensible reference annotation exist.

## Calibration plan

The **Primer Studio Specificity Grade (heuristic)** remains uncalibrated. Future work should annotate reconstructed products independently, retain limited-coverage cases, stratify by gene/isoform and product length, and separate calibration and held-out evaluation genes. Select thresholds on the calibration set, then report held-out confusion matrices and uncertainty. Wet-lab PCR, product size and sequencing provide a separate experimental endpoint; software agreement alone does not validate PCR success.

## Method references

- [Primer3 manual](https://primer3.org/manual.html): forced endpoints, constraints and thermodynamic settings.
- [NCBI Primer-BLAST](https://www.ncbi.nlm.nih.gov/tools/primer-blast/): official primer specificity service.
- [NCBI BLAST URL API](https://blast.ncbi.nlm.nih.gov/doc/blast-help/urlapi.html): BLAST requests, distinct from Primer-BLAST.
