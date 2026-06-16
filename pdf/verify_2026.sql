\pset border 2
\echo '== [V1] row counts (2026) =='
SELECT
  (SELECT count(*) FROM item_content   WHERE year=2026) AS item_content,
  (SELECT count(*) FROM checklist_item WHERE year=2026) AS checklist_item;

\echo '== [V2] no-loss: checklist_item(2026) must == source 1635 =='
SELECT count(*) AS loaded_2026,
       (count(*) = 1635) AS no_loss_ok
FROM checklist_item WHERE year=2026;

\echo '== [V3] AC-3 CHECK ck_core_no_score: C rows with a score (must be 0) =='
SELECT count(*) AS core_with_score_violations
FROM checklist_item WHERE year=2026 AND classification='C' AND score IS NOT NULL;

\echo '== [V4] AC-4 dedup: common_key 010.090 / 2026 -> areas vs content rows =='
SELECT
  (SELECT count(*) FROM checklist_item WHERE year=2026 AND common_key='010.090') AS areas,
  (SELECT count(*) FROM item_content   WHERE year=2026 AND common_key='010.090') AS content_rows,
  (SELECT count(DISTINCT question) FROM item_content WHERE year=2026 AND common_key='010.090') AS distinct_q;

\echo '== [V5] AC-5 UNIQUE: duplicate (area,common_key,year) rows (must be 0) =='
SELECT count(*) AS dup_groups FROM (
  SELECT area_code, common_key, year FROM checklist_item WHERE year=2026
  GROUP BY area_code, common_key, year HAVING count(*) > 1
) d;

\echo '== [V6] AC-13 item_number parity: generated == area_code.common_key (mismatch must be 0) =='
SELECT count(*) AS item_number_mismatch
FROM checklist_item
WHERE year=2026 AND item_number <> (area_code || '.' || common_key);

\echo '== [V7] FK integrity: every 2026 checklist_item has a matching item_content (orphans must be 0) =='
SELECT count(*) AS fk_orphans
FROM checklist_item ci
LEFT JOIN item_content ic
  ON ic.common_key = ci.common_key AND ic.year = ci.year
WHERE ci.year=2026 AND ic.common_key IS NULL;

\echo '== [V8] dedup factor: total items vs shared content =='
SELECT
  (SELECT count(*) FROM checklist_item WHERE year=2026) AS items,
  (SELECT count(*) FROM item_content   WHERE year=2026) AS content,
  (SELECT count(*) FROM checklist_item WHERE year=2026)
   - (SELECT count(*) FROM item_content WHERE year=2026) AS duplication_removed;

\echo '== [V9] classification distribution (2026) =='
SELECT COALESCE(classification,'(null)') AS cls, count(*) AS n
FROM checklist_item WHERE year=2026
GROUP BY classification ORDER BY n DESC;

\echo '== [V10] seed reference tables =='
SELECT
  (SELECT count(*) FROM area)            AS area,
  (SELECT count(*) FROM classification)  AS classification,
  (SELECT count(*) FROM sub_category)    AS sub_category;

\echo '== [V11] sample rows (sanity) =='
SELECT area_code, common_key, item_number, classification, score
FROM checklist_item WHERE year=2026
ORDER BY item_number LIMIT 5;
