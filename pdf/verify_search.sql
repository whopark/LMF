\pset border 2
-- SPEC-DB-001 Phase 6 · 검색/연도추적 parity canonical query set (T6.1/T6.3).
-- Search is implemented in repositories/pg/itemRepo.js (search_field). This file documents the
-- canonical queries + the ILIKE-vs-tsvector recall decision for Korean keyword search.

\echo '== [S1] item_number 부분검색 (trgm/ILIKE) — 번호검색 parity (AC-7) =='
SELECT count(DISTINCT item_number) AS hits_405 FROM checklist_item WHERE item_number ILIKE '%405%';

\echo '== [S2] 키워드 question ILIKE (substring, 한국어 교착어 안전) =='
SELECT count(*) AS ilike_hits
FROM checklist_item ci
LEFT JOIN item_content ic ON ic.common_key = ci.common_key AND ic.year = ci.year
WHERE COALESCE(ci.question_override, ic.question) ILIKE '%검사실%';

\echo '== [S3] 동일 키워드 tsvector simple @@ — 한국어 형태소 미지원(D5)으로 재현율 낮음 =='
SELECT count(*) AS tsvector_hits
FROM checklist_item ci
JOIN item_content ic ON ic.common_key = ci.common_key AND ic.year = ci.year
WHERE ic.search @@ plainto_tsquery('simple', '검사실');

\echo '== [S4] edit_type 검색 조인 (item_revision; 쓰기 전 0) =='
SELECT count(*) AS edit_type_hits FROM checklist_item
WHERE item_number IN (SELECT DISTINCT item_number FROM item_revision WHERE edit_type_code ILIKE '%MODIFY%');

\echo '== [S5] 수정자/수정일자 필터 (last_modified; 적재 직후 0) =='
SELECT
  (SELECT count(*) FROM checklist_item WHERE last_modified_user IS NOT NULL) AS has_modifier,
  (SELECT count(*) FROM checklist_item WHERE last_modified_at IS NOT NULL) AS has_modified_at;

\echo '== [S6] 연도 diff building blocks: 2026 vs 2025 (NEW/DELETED 후보) =='
SELECT
  (SELECT count(*) FROM checklist_item WHERE year = 2026) AS y2026,
  (SELECT count(*) FROM checklist_item WHERE year = 2025) AS y2025,
  (SELECT count(*) FROM checklist_item a WHERE a.year = 2026
     AND NOT EXISTS (SELECT 1 FROM checklist_item b WHERE b.year = 2025 AND b.item_number = a.item_number)) AS new_in_2026,
  (SELECT count(*) FROM checklist_item b WHERE b.year = 2025
     AND NOT EXISTS (SELECT 1 FROM checklist_item a WHERE a.year = 2026 AND a.item_number = b.item_number)) AS deleted_from_2025;

\echo '== [S7] 공통 item_number 교집합 (MODIFIED 후보 = 양년도 존재) =='
SELECT count(*) AS common_item_numbers FROM (
  SELECT item_number FROM checklist_item WHERE year = 2026
  INTERSECT
  SELECT item_number FROM checklist_item WHERE year = 2025
) c;
