#!/usr/bin/env python3
"""
ETL v9: checklist_items_final.json → flat Item documents for checklist_items collection.

Usage:
  python etl_v9.py [--input checklist_items_final.json] [--output checklist_items_flat.json]
  python etl_v9.py --corrections manual_corrections.json
"""
import json
import argparse
import re
from collections import defaultdict
from pathlib import Path


INPUT_DEFAULT = Path(__file__).parent / "checklist_items_final.json"
OUTPUT_DEFAULT = Path(__file__).parent / "checklist_items_flat.json"


def clean_text(text):
    """Normalize whitespace, bullets, and quotation marks per 심사점검표 spec."""
    if not text:
        return ""
    # H1: Normalize all bullet variants to ∙ (U+2219, BULLET OPERATOR).
    for ch in ("•", "⋅", "·"):  # U+2022, U+22C5, U+00B7
        text = text.replace(ch, "∙")  # U+2219
    # Normalize curly/typographic quotation marks → straight quotes matching 심사점검표.
    # Double: " " → " / ' ' → '
    text = text.replace("“", '"').replace("”", '"')  # " "
    text = text.replace("‘", "'").replace("’", "'")  # ' '
    # Full-width quotation marks → ASCII
    text = text.replace("＂", '"').replace("＇", "'")
    # Normalize multiple spaces/tabs to single space
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()


def parse_area(area_str):
    """'01 검사실운영' → ('01', '검사실운영')"""
    parts = area_str.strip().split(" ", 1)
    code = parts[0]
    name = parts[1] if len(parts) > 1 else area_str
    return code, name


def infer_classification(score, has_na, item_type):
    """Infer C/R/B classification from available signals."""
    # Explicit item_type takes priority.
    # H8: Source data uses compound forms ("기본B", "필요R", "핵심C") — added here.
    if item_type:
        t = str(item_type).strip()
        if t in ("C", "핵심", "Core", "핵심C"):
            return "C"
        if t in ("R", "필요", "Required", "필수", "필요R"):
            return "R"
        if t in ("B", "기본", "Basic", "권장", "기본B"):
            return "B"
    # Null score without NA strongly implies 핵심(C)
    if score is None and not has_na:
        return "C"
    return ""


def compute_common_key(item_number):
    """Extract common_key from standard item_number format 'NN.NNN.NNN' → 'NNN.NNN'.

    H2: Uses regex instead of length-based slicing to handle non-standard formats
    (e.g. '08.제공.001') safely — returns '' for those instead of garbled result.
    """
    m = re.match(r"^\d{2}\.(\d{3}\.\d{3})$", item_number or "")
    return m.group(1) if m else ""


def compute_ordering(source_items):
    """
    Assign sub_category_order and item_order to a list of source items.

    sub_category_order: based on minimum 중분류 code (middle 3 digits) per sub_category.
    item_order: position within sub_category sorted by 일련번호 (last 3 digits).

    Returns list of dicts with added ordering fields (preserves all original fields).
    """
    # Extract 중분류 code (middle 3 digits, positions 3-5 in "NN.NNN.NNN")
    def mid_code(item_number):
        m = re.search(r"^\d{2}\.(\d{3})\.", item_number or "")
        return m.group(1) if m else "999"

    def serial_code(item_number):
        m = re.search(r"\d{3}$", item_number or "")
        return m.group(0) if m else "999"

    # Find minimum 중분류 code per sub_category
    subcat_min = defaultdict(lambda: "999")
    for src in source_items:
        subcat = src.get("sub_category") or src.get("about_item", {}).get("section", "Unknown")
        num = src.get("about_item", {}).get("item_number", "")
        code = mid_code(num)
        if code < subcat_min[subcat]:
            subcat_min[subcat] = code

    # Rank sub_categories by their minimum code
    sorted_subcats = sorted(subcat_min.keys(), key=lambda s: subcat_min[s])
    subcat_rank = {s: i + 1 for i, s in enumerate(sorted_subcats)}

    # Sort items within each sub_category by serial code
    by_subcat = defaultdict(list)
    for src in source_items:
        subcat = src.get("sub_category") or src.get("about_item", {}).get("section", "Unknown")
        by_subcat[subcat].append(src)

    for subcat, items in by_subcat.items():
        items.sort(key=lambda s: serial_code(s.get("about_item", {}).get("item_number", "")))

    # Assign ordering — expose at top level for direct dict access
    result = []
    for subcat, items in by_subcat.items():
        s_order = subcat_rank[subcat]
        for i_order, src in enumerate(items, start=1):
            enriched = dict(src)
            enriched["sub_category_order"] = s_order
            enriched["item_order"] = i_order
            # Hoist item_number to top level for convenience
            enriched["item_number"] = src.get("about_item", {}).get("item_number", "")
            result.append(enriched)

    return result


def transform_item(source, sub_category_order, item_order):
    """Transform one source item to flat Item document."""
    about = source.get("about_item", {})
    meta = source.get("metadata", {})

    area_str = source.get("area", "")
    area_code, area_name = parse_area(area_str)
    item_number = about.get("item_number", "")
    score_raw = about.get("score")
    has_na = bool(about.get("has_na", False))
    item_type = about.get("item_type")

    # Attempt numeric coercion for score
    score = None
    if score_raw is not None:
        try:
            score = int(float(score_raw))
        except (TypeError, ValueError):
            score = None

    return {
        "item_number": item_number,
        "area_code": area_code,
        "common_key": compute_common_key(item_number),
        "year": int(meta.get("year", 0)),
        "area_name": area_name,
        "sub_category": source.get("sub_category") or about.get("section", "Unknown"),
        "sub_category_order": sub_category_order,
        "item_order": item_order,
        "question": clean_text(about.get("question", "")),
        "description": clean_text(about.get("description", "")),
        "score": score,
        "classification": infer_classification(score, has_na, item_type),
        "na_available": has_na,
        "revision": {"status": "none", "locked": False, "revised": False},
        "source": {
            "filename": meta.get("source", ""),
            "page": int(meta.get("page", 0)),
        },
    }


def apply_manual_corrections(items, corrections_path):
    """
    Merge manual corrections into the transformed items list.

    corrections.json format:
    [
      { "item_number": "01.010.090", "year": 2026,
        "patch": { "classification": "R", "sub_category": "심사범위" } },
      { "_new": true, "item_number": "08.제공.001", "year": 2026, ... full item fields ... }
    ]
    """
    if not corrections_path or not Path(corrections_path).exists():
        return items

    with open(corrections_path, encoding="utf-8") as f:
        corrections = json.load(f)

    key_to_idx = {
        (item["item_number"], item["year"]): idx
        for idx, item in enumerate(items)
    }

    new_items = []
    skipped_comments = 0
    unmatched_patches = []

    for corr in corrections:
        # H6: Skip template comment-only objects explicitly
        if all(k.startswith("_comment") for k in corr.keys()):
            skipped_comments += 1
            continue

        if corr.get("_new"):
            # Warn about TO BE FILLED placeholders to prevent dummy data entering DB
            q = corr.get("question", "")
            if "TO BE FILLED" in str(q).upper():
                print(f"[corrections] WARNING: _new item '{corr.get('item_number')}' "
                      f"has placeholder question - remove before import!")
            new_items.append(corr)
            continue

        # Patch existing item
        key = (corr.get("item_number"), corr.get("year"))
        if key in key_to_idx:
            items[key_to_idx[key]].update(corr.get("patch", {}))
        elif key != (None, None):
            unmatched_patches.append(key)

    if skipped_comments:
        print(f"[corrections] Skipped {skipped_comments} _comment template object(s)")
    if unmatched_patches:
        print(f"[corrections] WARNING: {len(unmatched_patches)} patch(es) had no matching item: "
              f"{unmatched_patches[:5]}")

    return items + new_items


def transform_all(source_items, corrections_path=None):
    """Transform all source items to flat documents."""
    # Group by (year, area) for independent ordering per document
    groups = defaultdict(list)
    for src in source_items:
        meta = src.get("metadata", {})
        area_str = src.get("area", "")
        groups[(meta.get("year"), area_str)].append(src)

    flat_items = []
    for (year, area), items in sorted(groups.items()):
        enriched = compute_ordering(items)
        for src in enriched:
            doc = transform_item(src, src["sub_category_order"], src["item_order"])
            flat_items.append(doc)

    if corrections_path:
        flat_items = apply_manual_corrections(flat_items, corrections_path)

    return flat_items


def main():
    parser = argparse.ArgumentParser(description="ETL v9: flat JSON → checklist_items")
    parser.add_argument("--input", default=str(INPUT_DEFAULT))
    parser.add_argument("--output", default=str(OUTPUT_DEFAULT))
    parser.add_argument("--corrections", default=None,
                        help="Path to manual_corrections.json")
    args = parser.parse_args()

    print(f"[etl_v9] Loading {args.input}")
    with open(args.input, encoding="utf-8") as f:
        source_items = json.load(f)
    print(f"[etl_v9] Loaded {len(source_items)} source items")

    flat = transform_all(source_items, args.corrections)
    print(f"[etl_v9] Transformed to {len(flat)} flat items")

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(flat, f, ensure_ascii=False, indent=2)
    print(f"[etl_v9] Saved → {args.output}")

    # Summary
    by_year = defaultdict(int)
    by_area = defaultdict(int)
    unknown_class = 0
    for item in flat:
        by_year[item["year"]] += 1
        by_area[item["area_code"]] += 1
        if not item["classification"]:
            unknown_class += 1

    print(f"\n[etl_v9] Year counts: {dict(sorted(by_year.items()))}")
    print(f"[etl_v9] Area counts: {len(by_area)} areas")
    print(f"[etl_v9] Unknown classification: {unknown_class}/{len(flat)}")


if __name__ == "__main__":
    main()
