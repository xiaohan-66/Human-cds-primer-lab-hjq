# Benchmark results

Fixed panel: 60 distinct human genes, one versioned RefSeq transcript per gene.

| Arm | Genes with candidates | Returned pairs | Errors | No candidate |
|---|---:|---:|---:|---:|
| studio_exact | 38/60 | 176 | 3 | 19 |
| primer3_exact | 25/60 | 104 | 0 | 35 |
| studio_adaptive | 57/60 | 285 | 3 | 0 |

Independent coordinate/sequence/basic-constraint checks: 565 returned pairs; 0 failures. Tm checks use each engine’s reported values, not an independent thermodynamic truth.

**These are candidate-yield measurements, not specificity accuracy or wet-lab success.** Primer3 retains its default structural filters and uses a different Tm implementation; Studio ranks warnings rather than enforcing the same hard exclusions. Adaptive Studio is a separate task and must not be compared directly with exact-CDS Primer3.

Primer-BLAST: **not run**. No agreement, precision, recall, or calibrated A–D thresholds are claimed. The review CSV provides a traceable queue, not completed validation.

## Rejected biological cases

- MYC / NM_002467.6: `CDS 需为至少 60 bp、以 ATG 开始且长度为 3 的倍数的明确 DNA 序列。`
- VEGFA / NM_003376.6: `CDS 需为至少 60 bp、以 ATG 开始且长度为 3 的倍数的明确 DNA 序列。`
- GPX1 / NM_000581.4: `CDS 含内部终止密码子或特殊翻译注释，本版暂不自动设计。`

All attempts remain in per-gene.csv, including failures. This fixed convenience panel is not a random or representative sample of the human transcriptome.

See [protocol](../README.md) for task matching, timing limitations and reproduction.
