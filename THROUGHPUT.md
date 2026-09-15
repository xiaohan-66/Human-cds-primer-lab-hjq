# 50-target workbench

Repeat optimization (enabled by default): when any selected flanking-mode candidate contains ≥4 identical bases or a dinucleotide repeated ≥4 times, search clean candidates in the original window, then expand each side by 50, 100, 200 and up to 500 bp, capped at transcript boundaries. Length, Tm, ΔTm and complete CDS requirements remain unchanged. Existing clean candidates are retained in comparison; high structural risk is not newly introduced when the original preferred pair was not high risk. Exact CDS mode never moves boundaries. Persisted search metadata and CSV report the actual window and whether replacement succeeded. Historical results require explicit redesign.

Independent Site based on the existing batch lab. The original single-gene and 10-target sites are unchanged.

Each batch accepts 1–50 unique targets and produces at most five distinct qualified primer pairs per target. All existing scientific filters and primer-pair BLAST engine 2.0 remain in place. Known MANE/RefSeq Select annotations can select the transcript automatically; ambiguous targets require confirmation and do not block other targets.

The browser drives one durable claimed item at a time. Closing the page stops dispatch; any in-flight request may finish. Return to the saved batch and press Continue. Pause takes effect after the in-flight target. Expired leases remain recoverable. Batch data belongs to the current session/account and is not shared with the older Site.

Incremental step responses include one hydrated item and lightweight statuses. Full batch reads hydrate one compressed transcript payload at a time and omit sequence strings. A final full refresh reconciles work performed in another tab. Detail pagination shows 10 targets; exports and BLAST selection still use all batch items. Failed searches can be requeued together without redoing successful targets or relaxing primer filters.

BLAST remains optional and limited to 50 pairs per submission: one preferred pair for each of 50 genes. Selecting up to 250 pairs is permitted for official parameter export, but cannot be submitted as one BLAST task. Public NCBI searches retain their existing rate gate, cache and retry policy; throughput does not mean simultaneous upstream calls.

Validation includes a 50-item local HTTP load test cycling five real transcript fixtures (SRPK1, SRSF4, SUMO2, TARDBP, TRIM37), yielding 250 candidate pairs, resume at item 25, persistence, CSV completeness, and rejection of a 51st input. This validates queue and UI data flow; it is not 50 distinct genes tested experimentally or 50 new remote BLAST results. Input/ownership, compact reads, state merge and annotated transcript selection have automated coverage.
