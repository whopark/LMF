\pset border 2
\echo '== [V1] AC-1 total rows: item_content=6570 / checklist_item=9984 =='
SELECT
  (SELECT count(*) FROM item_content)   AS item_content,
  (SELECT count(*) FROM checklist_item) AS checklist_item;

\echo '== [V2] no-loss: checklist_item must == source 9984 =='
SELECT count(*) AS loaded, (count(*) = 9984) AS no_loss_ok FROM checklist_item;

\echo '== [V3] AC-9 year distribution (expect 2020:1597 2021:1250 2022:1414 2023:1187 2024:1415 2025:1486 2026:1635) =='
SELECT year, count(*) AS n FROM checklist_item GROUP BY year ORDER BY year;

\echo '== [V4] AC-3 ck_core_no_score: C rows with score (must be 0) =='
SELECT count(*) AS core_with_score FROM checklist_item WHERE classification='C' AND score IS NOT NULL;

\echo '== [V5] AC-5 PK (area_code,item_number,year) duplicates (must be 0) =='
SELECT count(*) AS dup_groups FROM (
  SELECT area_code,item_number,year FROM checklist_item
  GROUP BY area_code,item_number,year HAVING count(*)>1
) d;

\echo '== [V6] split-area collision RESOLVED: (area 36, ck 301.340, 2020) both logical 30 & 36 coexist =='
SELECT area_code, item_number, field_code, common_key, year
FROM checklist_item
WHERE area_code='36' AND common_key='301.340' AND year=2020
ORDER BY item_number;

\echo '== [V7] field_code generated col: area 36 (clinical micro) logical-field distribution =='
SELECT field_code, count(*) AS n
FROM checklist_item WHERE area_code='36'
GROUP BY field_code ORDER BY field_code;

\echo '== [V8] anomaly row 21.405.120/2025 now loaded under BOTH areas 21 & 23 (was PK-blocked) =='
SELECT area_code, item_number, year
FROM checklist_item WHERE item_number='21.405.120' AND year=2025
ORDER BY area_code;

\echo '== [V9] FK integrity: checklist_item without matching item_content (orphans must be 0) =='
SELECT count(*) AS fk_orphans
FROM checklist_item ci
LEFT JOIN item_content ic ON ic.common_key=ci.common_key AND ic.year=ci.year
WHERE ic.common_key IS NULL;

\echo '== [V10] item_number fully populated (NULL must be 0) =='
SELECT count(*) AS item_number_null FROM checklist_item WHERE item_number IS NULL;

\echo '== [V11] split-area scope: rows where area_code <> field_code (logical != physical) =='
SELECT count(*) AS split_rows FROM checklist_item WHERE area_code <> field_code;

\echo '== [V12] distinct logical field_code vs physical area_code =='
SELECT
  (SELECT count(DISTINCT field_code) FROM checklist_item) AS distinct_field_code,
  (SELECT count(DISTINCT area_code)  FROM checklist_item) AS distinct_area_code;

\echo '== [V13] classification distribution (all years) =='
SELECT COALESCE(classification,'(null)') AS cls, count(*) AS n
FROM checklist_item GROUP BY classification ORDER BY n DESC;
