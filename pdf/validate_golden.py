#!/usr/bin/env python3
"""
Golden sample validator: compare ETL v9 flat output against source items.

Usage:
  python validate_golden.py \
    --source checklist_items_final.json \
    --input checklist_items_flat.json \
    [--per-area 10] \
    [--output reports/golden-YYYYMMDD.md]

Exit codes:
  0  All golden samples pass
  1  One or more mismatches found (details in --output report)
  2  Input file not found or parse error
"""
import argparse
import json
import sys
from pathlib import Path
from datetime import datetime


def _load_json(path, label):
    p = Path(path)
    if not p.exists():
        print(f"ERROR: {label} not found: {p}", file=sys.stderr)
        sys.exit(2)
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: {label} JSON parse error: {e}", file=sys.stderr)
        sys.exit(2)


def main():
    parser = argparse.ArgumentParser(description="Golden sample ETL validation")
    parser.add_argument(
        "--source",
        default=str(Path(__file__).parent / "checklist_items_final.json"),
        help="Source JSON (checklist_items_final.json)",
    )
    parser.add_argument(
        "--input",
        default=str(Path(__file__).parent / "checklist_items_flat.json"),
        help="ETL flat output JSON (checklist_items_flat.json)",
    )
    parser.add_argument(
        "--per-area",
        type=int,
        default=10,
        dest="per_area",
        help="Number of samples per area (default: 10)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Output markdown report path (default: stdout summary only)",
    )
    args = parser.parse_args()

    # Late import so sys.path is already set
    from golden import select_samples, compare_items, render_report

    source_items = _load_json(args.source, "source")
    flat_items = _load_json(args.input, "flat output")

    print(f"Loaded {len(source_items):,} source items, {len(flat_items):,} flat items")

    samples = select_samples(source_items, per_area=args.per_area)
    print(f"Selected {len(samples)} golden samples ({args.per_area}/area)")

    passed, mismatches = compare_items(samples, flat_items)

    mismatch_items = len({(m.item_number, m.year) for m in mismatches})
    total = passed + mismatch_items
    print(f"Result: {passed}/{total} passed, {mismatch_items} items with mismatches")

    report_md = render_report(source_items, flat_items, passed, mismatches, args.per_area)

    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report_md, encoding="utf-8")
        print(f"Report written: {out_path}")
    else:
        # Print compact summary to stdout
        if mismatches:
            print("\n--- Mismatch summary ---")
            for m in mismatches[:20]:
                print(f"  [{m.mismatch_type}] {m.item_number} year={m.year} field={m.field}")
            if len(mismatches) > 20:
                print(f"  ... and {len(mismatches) - 20} more")

    if mismatch_items > 0:
        print(f"\nFAIL: {mismatch_items} item(s) with mismatches. Use --output to save full report.")
        sys.exit(1)

    print("\nPASS: All golden samples match.")


if __name__ == "__main__":
    main()
