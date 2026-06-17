# SPEC-PDF-001 · ETL Report

- source records: 9984
- item_content rows: 6570 | checklist_item rows: 9984
- loaded + quarantined = 9984 (== source: True)
- split-area rows (area_code != item_number prefix, 정상 보존): 1760

## 이상치(드롭 0, 정규화+리포트)
- core_with_score: 10
- scored_missing: 81

## Parity (현 PG 상태)
- item_content=6570 checklist_item=9984
- classification NULL=1682 '' =0 C_with_score=0
- by year: 2020:1597, 2021:1250, 2022:1414, 2023:1187, 2024:1415, 2025:1486, 2026:1635

## 이상치 샘플(최대 20)
- 01.201.015 [01] scored_missing class=B score=None
- 01.203.020 [01] scored_missing class=B score=None
- 08.701.010 [08] scored_missing class=B score=None
- 43.602.403 [46] scored_missing class=B score=None
- 70.611.702 [70] scored_missing class=B score=None
- 80.607.802 [80] scored_missing class=B score=None
- 80.607.804 [80] scored_missing class=B score=None
- 80.607.806 [80] scored_missing class=B score=None
- 80.607.808 [80] scored_missing class=B score=None
- 80.607.810 [80] scored_missing class=B score=None
- 80.607.812 [80] scored_missing class=B score=None
- 80.607.814 [80] scored_missing class=B score=None
- 80.607.816 [80] scored_missing class=B score=None
- 80.607.818 [80] scored_missing class=B score=None
- 80.607.820 [80] scored_missing class=B score=None
- 80.607.822 [80] scored_missing class=B score=None
- 80.607.824 [80] scored_missing class=B score=None
- 80.607.828 [80] scored_missing class=B score=None
- 80.607.830 [80] scored_missing class=B score=None
- 08.701.010 [08] scored_missing class=B score=None
