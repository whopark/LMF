"""Diagnose split-area PK collisions + item_number mismatches in flat_v2 (read-only)."""
import json
import os
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(HERE, "checklist_items_flat_v2.json"), encoding="utf-8") as f:
    d = json.load(f)
recs = d if isinstance(d, list) else d.get("items", [])

print(f"== total records: {len(recs)} ==")
print("by year:", dict(sorted(Counter(r.get("year") for r in recs).items())))

# distinct area_code + area_name
areas = {}
for r in recs:
    areas[r["area_code"]] = r.get("area_name") or ""
print(f"\n== distinct area_code: {len(areas)} ==")
for ac in sorted(areas):
    print(f"  {ac}: {areas[ac]}")

# item_number prefix vs area_code
mism = [r for r in recs if f"{r['area_code']}.{r['common_key']}" != r["item_number"]]
print(f"\n== item_number mismatch (area.key != item_number): {len(mism)} ==")
# group by (area_code, item_number prefix)
pref = Counter((r["area_code"], r["item_number"].split(".")[0]) for r in mism)
print("  (area_code, item_number_prefix) -> count:")
for (ac, p), c in sorted(pref.items()):
    print(f"    area={ac} prefix={p}: {c}")
print("  samples:")
for r in mism[:8]:
    print(f"    area={r['area_code']} ck={r['common_key']} item_number={r['item_number']} year={r.get('year')}")

# PK collisions on (area_code, common_key, year)
pk = defaultdict(list)
for r in recs:
    pk[(r["area_code"], r["common_key"], r["year"])].append(r)
collisions = {k: v for k, v in pk.items() if len(v) > 1}
print(f"\n== PK collisions (area_code, common_key, year) count>1: {len(collisions)} ==")
col_by_area = Counter(k[0] for k in collisions)
print("  collisions by area_code:", dict(sorted(col_by_area.items())))
print("  samples (showing item_numbers in each colliding group):")
for k, v in list(collisions.items())[:6]:
    print(f"    {k}: n={len(v)} item_numbers={[x['item_number'] for x in v]}")

# would (item_number, year) be unique?
ink = defaultdict(list)
for r in recs:
    ink[(r["item_number"], r["year"])].append(r)
in_coll = {k: v for k, v in ink.items() if len(v) > 1}
print(f"\n== alt PK (item_number, year) count>1: {len(in_coll)} ==")
for k, v in list(in_coll.items())[:6]:
    print(f"    {k}: n={len(v)} areas={[x['area_code'] for x in v]}")

# distinct (item_number, year) total
print(f"\n== distinct (item_number, year): {len(ink)} | distinct (common_key,year): "
      f"{len({(r['common_key'], r['year']) for r in recs})} ==")
