# -*- coding: utf-8 -*-
"""Build the FINAL 2026 set and a full flat_v2.json for import.

Strategy (evidence-based, zero-regression on uncertain fields):
  - questions/descriptions/classification/score/revised : from re-parse (PDF authoritative, fixes 해당-leak)
  - na_available : COMMON items -> carry over existing DB value (PDF can't encode it reliably)
                   NEW items     -> heuristic: description mentions 해당없음
  - 제공서비스 placeholders (14) + any other only-old real items: preserved from existing
Outputs:
  checklist_items_2026_final.json   (2026 only)
  checklist_items_flat_v2.json      (ALL years; non-2026 existing + final 2026) -> import-items.js input
"""
import sys, io, json, os
from collections import Counter
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

HERE = os.path.dirname(os.path.abspath(__file__))
new = json.load(open(os.path.join(HERE, 'checklist_items_2026_reparsed.json'), encoding='utf-8'))
old_all = json.load(open(os.path.join(HERE, 'checklist_items_flat.json'), encoding='utf-8'))
old_2026 = [x for x in old_all if x['year'] == 2026]
non_2026 = [x for x in old_all if x['year'] != 2026]
omap = {}
for x in old_2026: omap.setdefault(x['item_number'], x)
nset = set(i['item_number'] for i in new)
oset = set(omap)

# --- validate desc-based na heuristic against existing common items ---
def has_na_text(d): return '해당없음' in (d or '')
common = nset & oset
tp=fp=fn=tn=0
for i in new:
    k = i['item_number']
    if k not in omap: continue
    pred = has_na_text(i['description'])
    act  = bool(omap[k]['na_available'])
    if pred and act: tp+=1
    elif pred and not act: fp+=1
    elif not pred and act: fn+=1
    else: tn+=1
print("=== desc-based na heuristic vs existing (common items) ===")
print(f"  TP={tp} FP={fp} FN={fn} TN={tn}")
prec = tp/(tp+fp) if tp+fp else 0
rec  = tp/(tp+fn) if tp+fn else 0
print(f"  precision={prec:.2f} recall={rec:.2f}  (existing na true={tp+fn})")

# --- build final 2026 ---
final = []
new_na_true = 0
for i in new:
    k = i['item_number']
    rec_item = dict(i)
    if k in omap:
        rec_item['na_available'] = bool(omap[k]['na_available'])      # carry over (zero regression)
    else:
        rec_item['na_available'] = has_na_text(i['description'])       # new item heuristic
        if rec_item['na_available']: new_na_true += 1
    final.append(rec_item)

# preserve only-old items not present in re-parse (placeholders + any real)
only_old = sorted(oset - nset)
preserved = []
for k in only_old:
    preserved.append(omap[k])
    final.append(omap[k])

# sort by item_number for stable order
final.sort(key=lambda r: r['item_number'])

json.dump(final, open(os.path.join(HERE, 'checklist_items_2026_final.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=2)

full = non_2026 + final
json.dump(full, open(os.path.join(HERE, 'checklist_items_flat_v2.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=2)

print("\n=== FINAL 2026 ===")
print("  re-parse items:", len(new), " + preserved only-old:", len(preserved), " = final 2026:", len(final))
print("  preserved only-old:", only_old)
print("  na true (final 2026):", sum(1 for x in final if x['na_available']),
      f"  [carried {sum(1 for x in final if x['item_number'] in omap and x['na_available'])} + new {new_na_true} + preserved]")
print("  classification:", dict(Counter(x['classification'] for x in final if x.get('classification'))))
print("  new items recovered (PDF, not in old):", len(nset - oset))

print("\n=== FULL flat_v2 ===")
print("  non-2026:", len(non_2026), " + 2026:", len(final), " = total:", len(full))
print("  existing total was:", len(old_all), " -> delta:", len(full) - len(old_all))
by_year = Counter(x['year'] for x in full)
print("  by year:", dict(sorted(by_year.items())))
