# -*- coding: utf-8 -*-
"""
parse_pdf_2026.py — Re-parse the 14 official 2026 심사점검표 PDFs into the canonical
flat.json schema, NON-DESTRUCTIVELY (writes a separate JSON; does not touch MongoDB).

Content fields (authoritative, extracted directly from PDF item tables):
  item_number, classification (C/R/B), score, na_available, question, description, revision.revised
Structural metadata (sub_category name + order) is reused from the existing
checklist_items_flat.json 중분류-code convention to stay consistent with the rest
of the DB and avoid fragile heading parsing.

Usage:
  python parse_pdf_2026.py [--out checklist_items_2026_reparsed.json]
"""
import sys, io, os, re, json, glob, argparse
from collections import Counter, defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import pdfplumber

HERE = os.path.dirname(os.path.abspath(__file__))
EXISTING_FLAT = os.path.join(HERE, 'checklist_items_flat.json')

ITEMNO = re.compile(r'^\s*(핵심C|기본B|필요R)\s+(\d{2}\.\d{3}\.\d{3})\.?\s+(.*)$', re.S)
ITEMNO_ANY = re.compile(r'\d{2}\.\d{3}\.\d{3}')
LABEL2CLASS = {'핵심C': 'C', '기본B': 'B', '필요R': 'R'}
BULLET = '∙'  # ∙ BULLET OPERATOR

# filename(area-prefix) -> area_name. Multi-area files (30-36, 40-46) share one name.
FILE_AREA_NAME = {
    '01': '검사실운영', '07': '종합검증', '08': '현장검사', '09': '수탁검사',
    '10': '진단혈액', '21': '임상화학', '23': '요검경', '30': '임상미생물',
    '40': '수혈의학', '50': '진단면역', '60': '유세포검사', '70': '조직적합성검사',
    '80': '세포유전검사', '90': '분자진단검사',
}


def norm_space(s):
    return re.sub(r'\s+', ' ', s).strip()


def norm_bullets(s):
    if s is None:
        return ''
    s = s.replace('', BULLET)   # PDF private-use bullet glyph
    s = s.replace('•', BULLET)   # •
    s = s.replace('⋅', BULLET)   # ⋅
    return s.strip()


def parse_score(answer_cell):
    """Return (score:int|None, is_essential:bool). answer_cell e.g. '예\\n(필수)','배점\\n(8)'."""
    c = (answer_cell or '').replace('\n', ' ')
    if '필수' in c:
        return None, True
    if '권장' in c or '예정' in c:
        return None, False
    m = re.search(r'\((\d+)', c)
    if m:
        return int(m.group(1)), False
    m2 = re.search(r'(\d+)', c)
    if m2:
        return int(m2.group(1)), False
    return None, False


def build_subcat_map():
    """From existing flat.json build (area_name, middlecode)->(sub_category, order) and
    a global middlecode->sub_category fallback."""
    data = json.load(open(EXISTING_FLAT, encoding='utf-8'))
    by_area_order = defaultdict(dict)   # area_name -> {sub_category: order}
    pair = {}                            # (area_name, middlecode) -> sub_category
    glob_mid = {}                        # middlecode -> sub_category (most common)
    glob_counter = defaultdict(Counter)
    # preserve order info
    area_seen = defaultdict(list)
    for x in data:
        inum = x.get('item_number', '')
        m = re.match(r'^\d{2}\.(\d{3})\.\d{3}$', inum)
        if not m:
            continue
        mid = m.group(1)
        an = x.get('area_name', '')
        sc = x.get('sub_category', '') or ''
        order = x.get('sub_category_order')
        if sc:
            pair[(an, mid)] = sc
            glob_counter[mid][sc] += 1
            if order is not None and sc not in by_area_order[an]:
                by_area_order[an][sc] = order
    for mid, cnt in glob_counter.items():
        glob_mid[mid] = cnt.most_common(1)[0][0]
    return pair, glob_mid, by_area_order


def parse_revised_set(pdf):
    """Collect item_numbers listed under '수정' or '신규' in 변경내역 summary pages."""
    revised = set()
    for page in pdf.pages[:8]:
        txt = page.extract_text() or ''
        if '변경내역' not in txt and '수정유형' not in txt:
            continue
        for line in txt.splitlines():
            m = ITEMNO_ANY.search(line)
            if m:
                revised.add(m.group(0))
    return revised


def is_item_table(tbl):
    if not tbl or len(tbl) < 1:
        return False
    r0 = tbl[0]
    if not r0 or (r0[0] or '').strip() != '문항':
        return False
    return bool(r0[1]) and bool(ITEMNO.match(r0[1]))


BULLET_CHARS = ('∙', '•', '⋅', '·', '-')
NOTE_CHARS = ('※',)
HEADING_CHARS = ('■', '□', '▶', '▷', '●', '○', '◆', '◇')


def find_description(tbl):
    for row in tbl[1:]:
        if row and (row[0] or '').strip() == '설명':
            return row[1] if len(row) > 1 else ''
    return ''


def parse_blocks(desc_text):
    """Convert flat description text into structured blocks list.

    Types: 'text', 'bullet', 'note' (※ prefix), 'heading' (■/□/▶ prefix).
    Table blocks are not reconstructed here (PDF tables are separate objects).
    """
    if not desc_text:
        return []
    lines = [l.strip() for l in desc_text.split('\n') if l.strip()]
    if not lines:
        return []
    blocks = []
    current_bullets = []
    current_text = []

    def flush_text():
        if current_text:
            blocks.append({'type': 'text', 'content': ' '.join(current_text)})
            current_text.clear()

    def flush_bullets():
        if current_bullets:
            blocks.append({'type': 'bullet', 'content': list(current_bullets)})
            current_bullets.clear()

    for line in lines:
        if any(line.startswith(b) for b in BULLET_CHARS):
            flush_text()
            current_bullets.append(line.lstrip(''.join(BULLET_CHARS)).strip())
        elif any(line.startswith(n) for n in NOTE_CHARS):
            flush_text()
            flush_bullets()
            blocks.append({'type': 'note', 'content': line.lstrip(''.join(NOTE_CHARS)).strip()})
        elif any(line.startswith(h) for h in HEADING_CHARS):
            flush_text()
            flush_bullets()
            blocks.append({'type': 'heading', 'content': line.lstrip(''.join(HEADING_CHARS)).strip()})
        else:
            flush_bullets()
            current_text.append(line)

    flush_text()
    flush_bullets()
    return blocks


def parse_file(path, subcat_pair, subcat_glob, area_order_map):
    fname = os.path.basename(path)
    code2 = fname[:2]
    area_name = FILE_AREA_NAME.get(code2, '')
    items = []
    seen_numbers = set()
    with pdfplumber.open(path) as pdf:
        revised_set = parse_revised_set(pdf)
        for pi, page in enumerate(pdf.pages):
            for tbl in page.extract_tables():
                if not is_item_table(tbl):
                    continue
                r0 = tbl[0]
                m = ITEMNO.match(r0[0 + 1])
                classification = LABEL2CLASS[m.group(1)]
                item_number = m.group(2)
                if item_number in seen_numbers:
                    continue  # duplicate table render guard
                question = norm_space(m.group(3))
                # answer cell = first non-empty cell after index 1 that isn't 아니오/해당없음
                answer_cell = r0[2] if len(r0) > 2 else ''
                row_join = ' '.join((c or '') for c in r0)
                na_available = ('해당' in row_join and '없음' in row_join)
                score, essential = parse_score(answer_cell)
                desc = norm_bullets(find_description(tbl))
                blocks = parse_blocks(desc)

                area_code = item_number[:2]
                middle = item_number[3:6]
                common_key = item_number[3:]
                sub_category = (subcat_pair.get((area_name, middle))
                                or subcat_glob.get(middle) or '기타')
                order = area_order_map.get(area_name, {}).get(sub_category)
                items.append({
                    'item_number': item_number,
                    'area_code': area_code,
                    'common_key': common_key,
                    'year': 2026,
                    'area_name': area_name,
                    'sub_category': sub_category,
                    'sub_category_order': order if order is not None else 99,
                    'item_order': None,  # filled later
                    'question': question,
                    'description': desc,
                    'blocks': blocks,
                    'score': score,
                    'classification': classification,
                    'na_available': na_available,
                    'revision': {
                        'status': 'none',
                        'locked': False,
                        'revised': item_number in revised_set,
                    },
                    'source': {'filename': fname, 'page': pi + 1},
                })
                seen_numbers.add(item_number)
    # item_order within (area_code, sub_category) by appearance
    counters = defaultdict(int)
    for it in items:
        key = (it['area_code'], it['sub_category'])
        counters[key] += 1
        it['item_order'] = counters[key]
    return items, len(revised_set)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(HERE, 'checklist_items_2026_reparsed.json'))
    args = ap.parse_args()

    subcat_pair, subcat_glob, area_order_map = build_subcat_map()
    pdfs = sorted(glob.glob(os.path.join(HERE, '*_2026.pdf')))
    print(f"[parse] {len(pdfs)} PDFs found")
    all_items = []
    per_file = []
    for p in pdfs:
        items, nrev = parse_file(p, subcat_pair, subcat_glob, area_order_map)
        per_file.append((os.path.basename(p), len(items), nrev,
                         sorted(set(i['area_code'] for i in items))))
        all_items.extend(items)
        print(f"  {os.path.basename(p):32s} items={len(items):4d}  revised={nrev:3d}  "
              f"area_codes={sorted(set(i['area_code'] for i in items))}")

    json.dump(all_items, open(args.out, 'w', encoding='utf-8'),
              ensure_ascii=False, indent=2)
    print(f"\n[parse] wrote {len(all_items)} items -> {os.path.basename(args.out)}")
    # quick dist
    print("[parse] classification:", dict(Counter(i['classification'] for i in all_items)))
    print("[parse] score null:", sum(1 for i in all_items if i['score'] is None))
    print("[parse] na true:", sum(1 for i in all_items if i['na_available']))
    print("[parse] revised true:", sum(1 for i in all_items if i['revision']['revised']))
    print("[parse] sub_category '기타' (unmapped):",
          sum(1 for i in all_items if i['sub_category'] == '기타'))


if __name__ == '__main__':
    main()
