# 60 curated design examples

**Selected after observing design outcomes. Not an unbiased benchmark or a claim of >90% general success.** The original [60-gene benchmark](../results/REPORT.md) remains unchanged and includes every unsuccessful case.

We evaluated 157 distinct genes across Studio exact-CDS, Primer3 exact-CDS and Studio adaptive settings. 67 genes returned at least one candidate in all three arms. The first 60 in the frozen input order form this example set, so all three candidate-yield figures are 60/60 (100%) **by selection**.

These are candidate-generation examples, not experimentally validated primers, uniquely specific pairs, or a new official Primer-BLAST cohort. The official 57-pair review elsewhere in this repository belongs to the original panel.

## Evidence

- [Selected genes, accessions and pair counts](selected-60.csv)
- [Selected sequences and CDS coordinates](selected-records.json)
- [All evaluated outcomes, including failures](all-attempts.csv)
- [Summary, including unselected-pool yields](summary.json)
- [Raw outputs, evaluated sequence snapshot and retrieval provenance](raw-design-results.zip)

All 842 returned pairs for selected genes passed template-sequence, coordinate, CDS coverage, length and reported-Tm checks. These checks do not establish specificity or wet-lab success.

## Selection and provenance

The expansion started with the original 60 records. Additional candidates came from the ordered 190-symbol list in the archive. For each symbol, up to ten NCBI RefSeq mRNA records were retrieved; the lowest numeric NM accession with a simple CDS and exact gene-symbol match was selected. This is not a MANE/canonical transcript guarantee. Exclusions and request provenance are recorded.

The evaluated snapshot contains the original 60 plus 97 additional genes. Acquisition continued briefly while this snapshot was evaluated, then stopped once at least 60 eligible examples were available. Extra fetched records were not silently counted as evaluated. The archive separates the evaluated snapshot from the acquisition pool.

## Reproduce

Extract the archive into this directory, then set `PRIMER_BENCHMARK_RECORDS=benchmarks/examples/evaluated-records.json` and `PRIMER_BENCHMARK_OUT=benchmarks/examples/results` in your shell. Run the existing Studio and Primer3 runners described in [the benchmark protocol](../README.md), then run `python benchmarks/scripts/select_examples.py`. Do not overwrite the original benchmark records. For a new acquisition, use `fetch_example_pool.py`; NCBI records may change.
