#!/usr/bin/env python3
"""
ETL v9 validation: reports item counts and potential integrity issues.

Usage:
  python validate_etl.py [--input checklist_items_flat.json]
  python validate_etl.py --compare-source checklist_items_final.json
"""
import json
import argparse
from collections import defaultdict
from pathlib import Path


INPUT_DEFAULT = Path(__file__).parent / "checklist_items_flat.json"
SOURCE_DEFAULT = Path(__file__).parent / "checklist_items_final.json"


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def report_flat(items):
    by_year_area = defaultdict(lambda: defaultdict(int))
    unknown_class = []
    missing_question = []
    duplicate_keys = defaultdict(list)

    for item in items:
        year = item.get("year")
        area = item.get("area_code", "??")
        by_year_area[year][area] += 1
        if not item.get("classification"):
            unknown_class.append(item.get("item_number"))
        if not item.get("question"):
            missing_question.append(item.get("item_number"))
        key = (item.get("item_number"), item.get("year"))
        duplicate_keys[key].append(True)

    duplicates = {k: len(v) for k, v in duplicate_keys.items() if len(v) > 1}

    print("=" * 60)
    print(f"Total flat items: {len(items)}")
    print()
    print("Items per year:")
    for year in sorted(by_year_area.keys()):
        total = sum(by_year_area[year].values())
        areas = len(by_year_area[year])
        print(f"  {year}: {total:5d} items across {areas} areas")
    print()
    print(f"Unknown classification: {len(unknown_class)} items")
    if len(unknown_class) <= 10:
        for n in unknown_class:
            print(f"  - {n}")
    elif unknown_class:
        print(f"  (first 10): {unknown_class[:10]}")
    print()
    print(f"Missing question: {len(missing_question)} items")
    print(f"Duplicate (item_number, year) keys: {len(duplicates)}")
    if duplicates:
        for k, cnt in list(duplicates.items())[:5]:
            print(f"  - {k}: {cnt}x")
    print("=" * 60)
    return len(unknown_class) == 0 and len(missing_question) == 0 and len(duplicates) == 0


def compare_with_source(flat_items, source_items):
    """Compare flat output counts against source counts."""
    flat_by_year = defaultdict(int)
    source_by_year = defaultdict(int)
    for item in flat_items:
        flat_by_year[item.get("year")] += 1
    for item in source_items:
        source_by_year[item.get("metadata", {}).get("year")] += 1

    print("\nSource vs Flat comparison (by year):")
    print(f"  {'Year':<6} {'Source':>8} {'Flat':>8} {'Diff':>8}")
    all_years = sorted(set(list(flat_by_year.keys()) + list(source_by_year.keys())))
    total_diff = 0
    for year in all_years:
        src = source_by_year.get(year, 0)
        flt = flat_by_year.get(year, 0)
        diff = flt - src
        total_diff += abs(diff)
        flag = " ⚠" if diff != 0 else ""
        print(f"  {year:<6} {src:>8} {flt:>8} {diff:>+8}{flag}")
    print(f"  {'TOTAL':<6} {sum(source_by_year.values()):>8} "
          f"{sum(flat_by_year.values()):>8} {total_diff:>+8}")
    return total_diff == 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", default=str(INPUT_DEFAULT))
    parser.add_argument("--compare-source", default=None,
                        help="Compare against source JSON to check count parity")
    args = parser.parse_args()

    if not Path(args.input).exists():
        print(f"[validate_etl] File not found: {args.input}")
        print("  Run: python etl_v9.py first")
        return

    flat_items = load_json(args.input)
    ok = report_flat(flat_items)

    if args.compare_source:
        source_items = load_json(args.compare_source)
        count_ok = compare_with_source(flat_items, source_items)
        ok = ok and count_ok

    print("\n[validate_etl]", "PASS ✓" if ok else "ISSUES FOUND — see above")


if __name__ == "__main__":
    main()
