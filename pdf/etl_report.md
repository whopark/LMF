# SPEC-PDF-001 · ETL Report

- source records: 1635
- item_content rows: 1026 | checklist_item rows: 1635
- loaded + quarantined = 1635 (== source: True)
- item_number mismatch (AC-13): 0

## 이상치(드롭 0, 정규화+리포트)
- scored_missing: 5

## Parity (현 PG 상태)
- item_content=1026 checklist_item=1635
- classification NULL=5 '' =0 C_with_score=0
- by year: 2026:1635

## 이상치 샘플(최대 20)
- 01.010.070 [01] scored_missing class=B score=None
- 09.010.070 [09] scored_missing class=B score=None
- 01.702.070 [01] scored_missing class=B score=None
- 01.702.200 [01] scored_missing class=B score=None
- 01.703.070 [01] scored_missing class=B score=None
