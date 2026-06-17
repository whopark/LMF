"""SPEC-PDF-001 · flat_v2 records -> PG normalized rows (pure logic, no DB).

Transforms per .autopus/specs/SPEC-DB-001/mapping.md + SPEC-PDF-001:
- classification '' -> None (NULL, unresolved)
- score: numeric -> int, non-numeric/blank -> None
- dedup (common_key, year): shared content base = min(area_code) row; divergent -> *_override
- CHECK-violating combos (C+score, B/R+null) are normalized to satisfy the constraint
  AND reported (load-all policy, no silent drop) -- see resolve_anomaly.
"""
import json

CLASS_NAMES = {"C": "핵심", "R": "필요", "B": "기본"}


def load_records(path):
    with open(path, encoding="utf-8") as f:
        d = json.load(f)
    return d if isinstance(d, list) else d.get("items", [])


def norm_score(v):
    if isinstance(v, bool):
        return None
    if isinstance(v, int):
        return v
    if isinstance(v, str) and v.strip().lstrip("-").isdigit():
        return int(v.strip())
    return None


def norm_class(v):
    v = (v or "").strip()
    return v if v in ("C", "R", "B") else None


def classify_anomaly(cls, score):
    """CHECK-violating combo type, else None."""
    if cls == "C" and score is not None:
        return "core_with_score"      # ck_core_no_score
    if cls in ("B", "R") and score is None:
        return "scored_missing"       # ck_scored_has_score
    return None


def resolve_anomaly(kind, cls, score):
    """Constraint-satisfying normalization (load-all). Returns (cls, score)."""
    if kind == "core_with_score":
        return cls, None              # 핵심: 배점 제거
    if kind == "scored_missing":
        return None, score            # B/R 무배점 -> 미해결(NULL 분류)
    return cls, score


def _blocks(r):
    b = r.get("blocks")
    return json.dumps(b, ensure_ascii=False) if b else None


def transform(records):
    """Return (content_rows: dict, item_rows: list, anomalies: list, dup_keys: list)."""
    groups = {}
    for r in records:
        groups.setdefault((r["common_key"], r["year"]), []).append(r)

    content_rows, item_rows, anomalies, dup_keys = {}, [], [], []
    seen = set()
    for (ck, year), rs in groups.items():
        rs_sorted = sorted(rs, key=lambda r: r["area_code"])
        base = rs_sorted[0]
        base_q = base.get("question")
        base_d = base.get("description") or None
        content_rows[(ck, year)] = {
            "common_key": ck, "year": year,
            "sub_category": (base.get("sub_category") or None),
            "sub_category_order": base.get("sub_category_order") or 0,
            "question": base_q, "description": base_d, "blocks": _blocks(base),
        }
        for r in rs_sorted:
            pk = (r["area_code"], r["item_number"], year)   # PK (area_code, item_number, year): 분할분야 충돌 0
            if pk in seen:                       # AC-5 duplicate (area, item_number, year)
                dup_keys.append(pk)
                anomalies.append((r["item_number"], r["area_code"], "duplicate_key", str(pk)))
                continue
            seen.add(pk)
            cls = norm_class(r.get("classification"))
            score = norm_score(r.get("score"))
            kind = classify_anomaly(cls, score)
            if kind:                             # AC-3/AC-5 quarantine-via-report
                anomalies.append((r["item_number"], r["area_code"], kind,
                                  f"class={cls} score={score}"))
                cls, score = resolve_anomaly(kind, cls, score)
            rev = r.get("revision") or {}
            lm = r.get("last_modified") or {}
            q, d = r.get("question"), (r.get("description") or None)
            item_rows.append({
                "area_code": r["area_code"], "common_key": ck, "year": year,
                "item_number": r["item_number"],   # 소스 원본 저장 (생성컬럼 폐기, 분할분야 parity)
                "item_order": r.get("item_order"),
                "classification": cls, "score": score,
                "na_available": bool(r.get("na_available")),
                "field_specific_description": r.get("field_specific_description"),
                "question_override": q if q != base_q else None,
                "description_override": d if d != base_d else None,
                "rev_status": (rev.get("status") or "none"),
                "locked": bool(rev.get("locked")), "revised": bool(rev.get("revised")),
                "last_modified_user": lm.get("user"), "last_modified_at": lm.get("at"),
                "source": json.dumps(r.get("source"), ensure_ascii=False) if r.get("source") else None,
            })
    return content_rows, item_rows, anomalies, dup_keys


def seed_rows(records):
    """Return reference seed sets: areas, classifications, sub_categories."""
    areas = {}
    subcats = {}
    for r in records:
        areas.setdefault(r["area_code"], r.get("area_name") or "")
        name = (r.get("sub_category") or "").strip()
        if name:
            order = r.get("sub_category_order") or 0
            subcats[name] = min(subcats.get(name, order), order)
    return {
        "areas": sorted(areas.items()),
        "classifications": list(CLASS_NAMES.items()),
        "sub_categories": sorted(subcats.items(), key=lambda kv: (kv[1], kv[0])),
    }


def item_number_mismatch(records):
    """AC-13: rows where area_code||'.'||common_key (PG generated) != source item_number."""
    out = []
    for r in records:
        gen = f"{r['area_code']}.{r['common_key']}"
        if gen != r["item_number"]:
            out.append((r["item_number"], gen))
    return out
