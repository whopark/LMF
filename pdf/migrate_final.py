import os
import re
import json
from datetime import datetime, timezone
import pdfplumber
from pymongo import MongoClient, ASCENDING
from pymongo.errors import BulkWriteError

# ── Configuration ─────────────────────────────────────────────────────────────
PDF_DIR  = r"E:\LMF_all\pdf"
MONGO_URI = os.environ.get("MONGO_URI", "mongodb://127.0.0.1:27017/")
DB_NAME   = "lab_accreditation"
COL_NAME  = "checklist_items"

BULLET_CHAR = "\uf09f"   # Private-use bullet used in this PDF

TYPE_MAP = {
    "핵심C": "Core",
    "필요R": "Required",
    "기본B": "Basic",
}

SECTION_HEADERS = {
    "심사범위":              re.compile(r"^\d*\s*심사범위"),
    "질관리: 일반":          re.compile(r"^\d*\s*질관리\s*:\s*일반"),
    "질관리: 검사단계":      re.compile(r"^\d*\s*질관리\s*:\s*검사단계"),
    "질관리: 검사전후단계":  re.compile(r"^\d*\s*질관리\s*:\s*검사전후단계"),
    "일반기구 및 장비":      re.compile(r"^\d*\s*일반기구"),
    "검사수행 및 장비 운용": re.compile(r"^\d*\s*검사수행"),
    "인력":                  re.compile(r"^\d*\s*인력$"),
    "시설 및 환경":          re.compile(r"^\d*\s*시설"),
    "안전":                  re.compile(r"^\d*\s*안전$"),
    "검사실이전":            re.compile(r"^\d*\s*검사실이전"),
}

ITEM_HEADER_RE = re.compile(
    r"^(?:(핵심\s*C|필요\s*R|기본\s*B)\s+)?([\d]{2}\.?[\d]{3}\.?[\d]{3})\.?\s+(.*)"
)
SCORE_RE       = re.compile(r"[\(（]\s*(\d+)\s*(?:점\s*예정)?[\)）]")
SCORE_NOTE_RE  = re.compile(r"권장")
NOISE_RE       = re.compile(
    r"\b(문항|예\s*\(필수\)|\(필수\)|배점|아니오|해당\s*없음|없음|예\s+아니오|예$)\b"
)

# ── PDF extraction ─────────────────────────────────────────────────────────────
def extract_pages(pdf_path: str) -> list:
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            if i < 6: # Skip cover/intro pages
                continue
            text = page.extract_text() or ""
            lines = text.splitlines()
            pages.append({"page": i, "lines": lines})
    return pages

# ── Section tracker ───────────────────────────────────────────────────────────
def detect_section(line: str, current: str) -> str:
    stripped = line.strip()
    for name, pat in SECTION_HEADERS.items():
        if pat.match(stripped):
            return name
    return current

# ── Per-item parser ───────────────────────────────────────────────────────────
def parse_item_block(lines: list, item_type: str, item_number: str) -> dict:
    q_parts    = []
    desc_lines = []
    score      = None
    score_note = None
    has_na     = False
    in_desc    = False

    for line in lines:
        stripped = line.strip()
        if "해당없음" in stripped or "해당 없음" in stripped:
            has_na = True
        if score is None:
            sm = SCORE_RE.search(stripped)
            if sm:
                score = int(sm.group(1))
        if SCORE_NOTE_RE.search(stripped):
            score_note = "권장"

        if re.match(r"^설명\s*$", stripped):
            in_desc = True
            continue
        if stripped.startswith("설명 " + BULLET_CHAR) or stripped.startswith("설명 "):
            in_desc = True
            inline = re.sub(r"^설명\s*", "", stripped).strip()
            if inline:
                desc_lines.append(inline)
            continue

        if in_desc:
            desc_lines.append(stripped)
        else:
            if stripped.startswith(BULLET_CHAR):
                in_desc = True
                desc_lines.append(stripped)
            else:
                q_parts.append(stripped)

    question = " ".join(q_parts)
    question = SCORE_RE.sub("", question)
    question = NOISE_RE.sub("", question)
    
    if item_type:
        question = re.sub(
            r"^(핵심\s*C|필요\s*R|기본\s*B)\s+" + re.escape(item_number) + r"\.?\s*", "", question
        )
    else:
        question = re.sub(r"^" + re.escape(item_number) + r"\.?\s*", "", question)
        
    question = re.sub(r"\s{2,}", " ", question).strip()

    cleaned = []
    for dl in desc_lines:
        dl = dl.replace(BULLET_CHAR, "•").strip()
        if dl:
            cleaned.append(dl)
    description = "\n".join(cleaned).strip()

    return {
        "score":       score,
        "score_note":  score_note,
        "has_na":      has_na,
        "question":    question,
        "description": description,
    }

# ── Main parser ───────────────────────────────────────────────────────────────
def parse_all_items(pages: list, source: str, classification_map: dict) -> list:
    all_lines = []
    for p in pages:
        for line in p["lines"]:
            all_lines.append((p["page"], line))

    item_starts = []
    current_section = "심사범위"
    section_at = []

    for idx, (pg, line) in enumerate(all_lines):
        current_section = detect_section(line, current_section)
        section_at.append(current_section)
        m = ITEM_HEADER_RE.match(line.strip())
        if m:
            itype = m.group(1).replace(" ", "") if m.group(1) else None
            inumber = m.group(2)
            item_starts.append((idx, pg, itype, inumber))

    items = []
    area_name = source.replace("\\", "/").split("/")[0]

    for si, (start_idx, start_pg, item_type, item_number) in enumerate(item_starts):
        end_idx     = item_starts[si + 1][0] if si + 1 < len(item_starts) else len(all_lines)
        block_lines = [line for (_, line) in all_lines[start_idx:end_idx]]
        section     = section_at[start_idx]
        parsed      = parse_item_block(block_lines, item_type, item_number)

        # 중분류 (Sub-category) mapping
        sub_cat = "기타"
        m_code = re.search(r"\d{2}\.(\d{3})\.\d{3}", item_number)
        if m_code:
            middle_code = m_code.group(1)
            sub_cat = classification_map.get(area_name, {}).get(middle_code, "기타")

        items.append({
            "area": area_name,
            "sub_category": sub_cat,
            "about_item": {
                "item_number":  item_number,
                "item_type":    item_type,
                "item_type_en": TYPE_MAP.get(item_type, "Unknown") if item_type else "Unknown",
                "score":        parsed["score"],
                "score_note":   parsed["score_note"],
                "has_na":       parsed["has_na"],
                "question":     parsed["question"],
                "description":  parsed["description"],
                "section":      section,
            },
            "metadata": {
                "page":         start_pg,
                "source":       source,
                "year":         int(re.search(r'\b(20\d{2}|19\d{2})\b', source).group(1)) if re.search(r'\b(20\d{2}|19\d{2})\b', source) else None,
                "created_at":   datetime.now(timezone.utc).isoformat(),
            }
        })

    return items

# ── MongoDB upload ─────────────────────────────────────────────────────────────
def upload_to_mongodb(items: list, uri: str) -> None:
    print(f"\n🔌 Connecting to MongoDB …")
    client = MongoClient(uri, serverSelectionTimeoutMS=10_000)
    client.admin.command("ping")
    print("✅ Connected!")

    col = client[DB_NAME][COL_NAME]
    
    # Clear existing items for a fresh migration (or you can use delete_many selective)
    print(f"🗑️ Clearing existing documents in {DB_NAME}.{COL_NAME} …")
    col.delete_many({})
    
    col.create_index([("area", ASCENDING), ("metadata.year", ASCENDING), ("about_item.item_number", ASCENDING)], unique=True)

    print(f"📤 Inserting {len(items)} documents …")
    try:
        result = col.insert_many(items, ordered=False)
        print(f"✅ Inserted {len(result.inserted_ids)} documents.")
    except BulkWriteError as bwe:
        inserted = bwe.details.get("nInserted", 0)
        dups     = len([e for e in bwe.details.get("writeErrors", []) if e.get("code") == 11000])
        print(f"⚠️  Inserted {inserted} new, skipped {dups} duplicates.")
    finally:
        client.close()

# ── Main ───────────────────────────────────────────────────────────────────────
def main():
    # Load classification map
    map_path = os.path.join(PDF_DIR, "classification_map.json")
    if not os.path.exists(map_path):
        print(f"❌ classification_map.json not found at {map_path}")
        return
    
    with open(map_path, "r", encoding="utf-8") as f:
        classification_map = json.load(f)
    print(f"✅ Loaded classification map with {len(classification_map)} areas.")

    all_items = []
    print(f"📂 Searching for PDF files in {PDF_DIR} …")
    pdf_files = []
    for root, dirs, files in os.walk(PDF_DIR):
        for file in files:
            if file.lower().endswith(".pdf"):
                pdf_files.append(os.path.join(root, file))
                
    print(f"   → Found {len(pdf_files)} PDF files.")

    for pdf_path in pdf_files:
        source_name = os.path.relpath(pdf_path, PDF_DIR)
        print(f"\n📄 Reading PDF: {source_name} …")
        try:
            pages = extract_pages(pdf_path)
            items = parse_all_items(pages, source_name, classification_map)
            print(f"   → {len(items)} items parsed")
            all_items.extend(items)
        except Exception as e:
            print(f"   ❌ Error processing {source_name}: {e}")

    if not all_items:
        print("No items parsed. Exiting.")
        return

    # ── De-duplicate items ──────────────────────────────────────────────────
    unique_items = {}
    dups_count = 0
    for item in all_items:
        key = (item["area"], item["metadata"]["year"], item["about_item"]["item_number"])
        if key in unique_items:
            dups_count += 1
            # Prefer the one with a description if the current one has none
            if not unique_items[key]["about_item"]["description"] and item["about_item"]["description"]:
                unique_items[key] = item
        else:
            unique_items[key] = item
            
    final_items = list(unique_items.values())
    print(f"✅ De-duplicated: Removed {dups_count} duplicate items. Final count: {len(final_items)}")

    out_json = os.path.join(PDF_DIR, "checklist_items_final.json")
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(final_items, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Parsed data saved → {out_json}")

    placeholder = "mongodb+srv://user:password@cluster.mongodb.net/"
    if not MONGO_URI or MONGO_URI.strip("/") == placeholder.strip("/"):
        print("\n⚠️  MONGO_URI not configured — DRY-RUN mode (no upload).")
    else:
        upload_to_mongodb(final_items, MONGO_URI)
        print("\n🎉 Migration complete!")

if __name__ == "__main__":
    main()
