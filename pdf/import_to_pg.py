"""SPEC-PDF-001 · flat_v2.json -> PostgreSQL loader (import_to_mongodb.py의 PG 대응).

Dry-run is the default (REQ-4). Pass --commit to persist.
Batch transactions with per-batch savepoints (REQ-8): an unexpected error rolls back
only that batch and is reported; idempotent ON CONFLICT upserts allow safe re-runs.

Usage:
  PG_URL=postgresql://postgres:***@127.0.0.1:5435/lab_accreditation \
    python import_to_pg.py            # dry-run
    python import_to_pg.py --commit   # persist
"""
import argparse
import os
import sys

import psycopg

import pg_load

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_INPUT = os.path.join(HERE, "checklist_items_flat_v2.json")
DEFAULT_REPORT = os.path.join(HERE, "etl_report.md")


def _batched(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def seed(cur, seeds):
    cur.executemany(
        "INSERT INTO area(area_code,name) VALUES(%s,%s) "
        "ON CONFLICT(area_code) DO UPDATE SET name=EXCLUDED.name",
        seeds["areas"])
    cur.executemany(
        "INSERT INTO classification(code,name) VALUES(%s,%s) "
        "ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name",
        seeds["classifications"])
    cur.execute("SELECT name FROM sub_category")
    existing = {row[0] for row in cur.fetchall()}
    todo = [(n, o) for (n, o) in seeds["sub_categories"] if n not in existing]
    if todo:
        cur.executemany(
            "INSERT INTO sub_category(name,display_order) VALUES(%s,%s)", todo)
    cur.execute("SELECT id,name FROM sub_category")
    return {name: sid for sid, name in cur.fetchall()}


def load_batches(conn, cur, sql, rows, errors, label):
    """executemany per batch inside a savepoint; report failures without aborting all."""
    ok = 0
    for batch in _batched(rows, 500):
        try:
            with conn.transaction():           # savepoint (REQ-8 batch rollback)
                cur.executemany(sql, batch)
            ok += len(batch)
        except Exception as e:                  # noqa: BLE001
            errors.append(f"{label} batch({len(batch)}): {type(e).__name__}: {e}")
    return ok


CONTENT_SQL = (
    "INSERT INTO item_content(common_key,year,sub_category_id,question,description,blocks) "
    "VALUES(%(common_key)s,%(year)s,%(sub_category_id)s,%(question)s,%(description)s,%(blocks)s) "
    "ON CONFLICT(common_key,year) DO UPDATE SET "
    "sub_category_id=EXCLUDED.sub_category_id,question=EXCLUDED.question,"
    "description=EXCLUDED.description,blocks=EXCLUDED.blocks")

ITEM_SQL = (
    "INSERT INTO checklist_item(area_code,common_key,year,item_order,classification,score,"
    "na_available,field_specific_description,question_override,description_override,"
    "rev_status,locked,revised,last_modified_user,last_modified_at,source) "
    "VALUES(%(area_code)s,%(common_key)s,%(year)s,%(item_order)s,%(classification)s,%(score)s,"
    "%(na_available)s,%(field_specific_description)s,%(question_override)s,%(description_override)s,"
    "%(rev_status)s,%(locked)s,%(revised)s,%(last_modified_user)s,%(last_modified_at)s,%(source)s) "
    "ON CONFLICT(area_code,common_key,year) DO UPDATE SET "
    "item_order=EXCLUDED.item_order,classification=EXCLUDED.classification,score=EXCLUDED.score,"
    "na_available=EXCLUDED.na_available,field_specific_description=EXCLUDED.field_specific_description,"
    "question_override=EXCLUDED.question_override,description_override=EXCLUDED.description_override,"
    "rev_status=EXCLUDED.rev_status,locked=EXCLUDED.locked,revised=EXCLUDED.revised,"
    "last_modified_user=EXCLUDED.last_modified_user,last_modified_at=EXCLUDED.last_modified_at,"
    "source=EXCLUDED.source")


def _one(cur, s):
    cur.execute(s)
    return cur.fetchone()[0]


def parity(cur):
    out = {
        "item_content": _one(cur, "SELECT count(*) FROM item_content"),
        "checklist_item": _one(cur, "SELECT count(*) FROM checklist_item"),
        "class_null": _one(cur, "SELECT count(*) FROM checklist_item WHERE classification IS NULL"),
        "class_empty": _one(cur, "SELECT count(*) FROM checklist_item WHERE classification=''"),
        "core_with_score": _one(cur, "SELECT count(*) FROM checklist_item WHERE classification='C' AND score IS NOT NULL"),
    }
    cur.execute("SELECT year,count(*) FROM checklist_item GROUP BY year ORDER BY year")
    out["by_year"] = cur.fetchall()
    return out


def write_report(path, src_n, content_n, item_n, anomalies, dup_keys, mism, par):
    from collections import Counter
    by_type = Counter(a[2] for a in anomalies)
    lines = ["# SPEC-PDF-001 · ETL Report", "",
             f"- source records: {src_n}",
             f"- item_content rows: {content_n} | checklist_item rows: {item_n}",
             f"- loaded + quarantined = {item_n + len(dup_keys)} (== source: {item_n + len(dup_keys) == src_n})",
             f"- item_number mismatch (AC-13): {len(mism)}",
             "", "## 이상치(드롭 0, 정규화+리포트)"]
    for k, c in sorted(by_type.items()):
        lines.append(f"- {k}: {c}")
    lines += ["", "## Parity (현 PG 상태)",
              f"- item_content={par['item_content']} checklist_item={par['checklist_item']}",
              f"- classification NULL={par['class_null']} '' ={par['class_empty']} "
              f"C_with_score={par['core_with_score']}",
              "- by year: " + ", ".join(f"{y}:{c}" for y, c in par["by_year"])]
    if anomalies[:20]:
        lines += ["", "## 이상치 샘플(최대 20)"] + [f"- {a[0]} [{a[1]}] {a[2]} {a[3]}" for a in anomalies[:20]]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--commit", action="store_true", help="persist (default: dry-run)")
    ap.add_argument("--input", default=DEFAULT_INPUT)
    ap.add_argument("--report", default=DEFAULT_REPORT)
    ap.add_argument("--pg-url", default=os.environ.get("PG_URL"))
    ap.add_argument("--year", type=int, help="load only this year (e.g. 2026)")
    args = ap.parse_args()
    if not args.pg_url:
        sys.exit("ERROR: PG_URL not set (env or --pg-url)")

    records = pg_load.load_records(args.input)
    if args.year:
        records = [r for r in records if r.get("year") == args.year]
        print(f"[filter] year={args.year} -> {len(records)} records")
    seeds = pg_load.seed_rows(records)
    content_rows, item_rows, anomalies, dup_keys = pg_load.transform(records)
    mism = pg_load.item_number_mismatch(records)
    print(f"[{'COMMIT' if args.commit else 'DRY RUN'}] source={len(records)} "
          f"content={len(content_rows)} items={len(item_rows)} "
          f"anomalies={len(anomalies)} dup={len(dup_keys)} num_mismatch={len(mism)}")

    errors = []
    conn = psycopg.connect(args.pg_url, client_encoding="UTF8")
    try:
        cur = conn.cursor()
        name2id = seed(cur, seeds)                       # opens txn
        content = [{**v, "sub_category_id": name2id.get(v["sub_category"])} for v in content_rows.values()]
        c_ok = load_batches(conn, cur, CONTENT_SQL, content, errors, "item_content")
        i_ok = load_batches(conn, cur, ITEM_SQL, item_rows, errors, "checklist_item")
        par = parity(cur)
        write_report(args.report, len(records), c_ok, i_ok, anomalies, dup_keys, mism, par)
        if args.commit:
            conn.commit()
            print(f"COMMITTED · content={c_ok} items={i_ok} errors={len(errors)}")
        else:
            conn.rollback()
            print(f"DRY RUN rolled back · would-load content={c_ok} items={i_ok} errors={len(errors)}")
        print(f"parity: item_content={par['item_content']} checklist_item={par['checklist_item']} "
              f"class_null={par['class_null']} · report -> {os.path.relpath(args.report)}")
        for e in errors[:5]:
            print("  ERR:", e)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
