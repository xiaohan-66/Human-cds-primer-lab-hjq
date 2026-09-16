# Official Primer-BLAST review

60-gene frozen panel; 57 available Studio adaptive lead pairs submitted to the official NCBI Primer-BLAST service. Three genes without Studio candidates stay in the denominator.

| Observation | Count |
|---|---:|
| Completed official reports | 57 |
| Expected accession product detected | 57 |
| Reports with potentially unintended products | 49 |
| No Studio candidate | 3 |
| Unresolved requests / reports | 0 |

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
