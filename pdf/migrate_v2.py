#!/usr/bin/env python3
"""
LMF Laboratory Accreditation Checklist Parser v2
Improved, cross-platform, configurable version.

Replaces migrate_final.py and upload_clean.py with better architecture,
logging, CLI, and robustness.
"""

import os
import re
import json
import logging
import argparse
import yaml
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, List, Any

import pdfplumber
from pymongo import MongoClient, ASCENDING
from pymongo.errors import BulkWriteError
from tqdm import tqdm

# ====================== CONFIGURATION ======================

# Resolve defaults relative to this script so it works on Windows, WSL, and Linux.
SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_CONFIG_PATH = SCRIPT_DIR / "config.yaml"
DEFAULT_PDF_DIR = SCRIPT_DIR
DEFAULT_DB_NAME = "lab_accreditation"
DEFAULT_COLLECTION = "checklist_items"
DEFAULT_MONGO_URI = "mongodb://127.0.0.1:27017/"

# Private use bullet character used in PDFs
BULLET_CHAR = "\uf09f"

TYPE_MAP = {
    "핵심C": "Core",
    "필요R": "Required",
    "기본B": "Basic",
}

SECTION_HEADERS = {
    "심사범위": re.compile(r"^\d*\s*심사범위"),
    "질관리: 일반": re.compile(r"^\d*\s*질관리\s*:\s*일반"),
    "질관리: 검사단계": re.compile(r"^\d*\s*질관리\s*:\s*검사단계"),
    "질관리: 검사전후단계": re.compile(r"^\d*\s*질관리\s*:\s*검사전후단계"),
    "일반기구 및 장비": re.compile(r"^\d*\s*일반기구"),
    "검사수행 및 장비 운용": re.compile(r"^\d*\s*검사수행"),
    "인력": re.compile(r"^\d*\s*인력$"),
    "시설 및 환경": re.compile(r"^\d*\s*시설"),
    "안전": re.compile(r"^\d*\s*안전$"),
    "검사실이전": re.compile(r"^\d*\s*검사실이전"),
}

ITEM_HEADER_RE = re.compile(
    r"^(?:(핵심\s*C|필요\s*R|기본\s*B)\s+)?([\d]{2}\.?[\d]{3}\.?[\d]{3})\.?\s+(.*)"
)
SCORE_RE = re.compile(r"[\(（]\s*(\d+)\s*(?:점\s*예정)?[\)）]")
SCORE_NOTE_RE = re.compile(r"권장")
NOISE_RE = re.compile(
    r"\b(문항|예\s*\(필수\)|\(필수\)|배점|아니오|해당\s*없음|없음|예\s+아니오|예$)\b"
)


# ====================== LOGGING SETUP ======================

def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s | %(levelname)s | %(message)s",
        datefmt="%H:%M:%S"
    )
    return logging.getLogger(__name__)


# ====================== CORE PARSER ======================

def extract_pages(pdf_path: Path, skip_first_pages: int = 5) -> List[Dict]:
    """Extract text from PDF, skipping front matter."""
    pages = []
    with pdfplumber.open(pdf_path) as pdf:
        for i, page in enumerate(pdf.pages, start=1):
            if i <= skip_first_pages:
                continue
            text = page.extract_text() or ""
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            pages.append({"page": i, "lines": lines})
    return pages


def detect_section(line: str, current: str) -> str:
    for name, pattern in SECTION_HEADERS.items():
        if pattern.match(line):
            return name
    return current


def parse_item_block(lines: List[str], item_type: str | None, item_number: str) -> Dict:
    """Parse the content of a single checklist item."""
    q_parts: List[str] = []
    desc_lines: List[str] = []
    score = None
    score_note = None
    has_na = False
    in_desc = False

    for line_text in lines:
        stripped = line_text.strip()
        if not stripped:
            continue

        if "해당없음" in stripped or "해당 없음" in stripped:
            has_na = True

        # Extract score
        if score is None:
            sm = SCORE_RE.search(stripped)
            if sm:
                score = int(sm.group(1))

        if SCORE_NOTE_RE.search(stripped):
            score_note = "권장"

        # Description section detection
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

    # Clean question text
    question = " ".join(q_parts)
    question = SCORE_RE.sub("", question)
    question = NOISE_RE.sub("", question)

    if item_type:
        question = re.sub(
            r"^(핵심\s*C|필요\s*R|기본\s*B)\s+" + re.escape(item_number) + r"\.?\s*",
            "", question
        )
    else:
        question = re.sub(r"^" + re.escape(item_number) + r"\.?\s*", "", question)

    question = re.sub(r"\s{2,}", " ", question).strip()

    # Clean description
    cleaned = []
    for dl in desc_lines:
        cleaned_text = dl.replace(BULLET_CHAR, "•").strip()
        if cleaned_text:
            cleaned.append(cleaned_text)
    description = "\n".join(cleaned).strip()

    return {
        "score": score,
        "score_note": score_note,
        "has_na": has_na,
        "question": question,
        "description": description,
    }


def parse_all_items(
    pages: List[Dict], source: str, classification_map: Dict
) -> List[Dict]:
    """Parse all checklist items from a PDF."""
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

        m = ITEM_HEADER_RE.match(line)
        if m:
            itype = m.group(1).replace(" ", "") if m.group(1) else None
            inumber = m.group(2)
            item_starts.append((idx, pg, itype, inumber))

    items = []
    # Extract area from path (first folder name)
    area_name = Path(source).parts[0] if Path(source).parts else source

    for si, (start_idx, start_pg, item_type, item_number) in enumerate(item_starts):
        end_idx = item_starts[si + 1][0] if si + 1 < len(item_starts) else len(all_lines)
        block_lines = [line for (_, line) in all_lines[start_idx:end_idx]]
        section = section_at[start_idx]

        parsed = parse_item_block(block_lines, item_type, item_number)

        # Determine sub-category
        sub_cat = "기타"
        m_code = re.search(r"\d{2}\.(\d{3})\.\d{3}", item_number)
        if m_code:
            middle_code = m_code.group(1)
            sub_cat = classification_map.get(area_name, {}).get(middle_code, "기타")

        # Extract year from filename
        year_match = re.search(r"(20\d{2}|19\d{2})", source)
        year = int(year_match.group(1)) if year_match else None

        items.append({
            "area": area_name,
            "sub_category": sub_cat,
            "about_item": {
                "item_number": item_number,
                "item_type": item_type,
                "item_type_en": TYPE_MAP.get(item_type, "Unknown") if item_type else "Unknown",
                "score": parsed["score"],
                "score_note": parsed["score_note"],
                "has_na": parsed["has_na"],
                "question": parsed["question"],
                "description": parsed["description"],
                "section": section,
            },
            "metadata": {
                "page": start_pg,
                "source": source,
                "year": year,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        })

    return items


# ====================== MONGODB ======================

def upload_to_mongodb(items: List[Dict], mongo_uri: str, db_name: str, collection: str):
    """Upload parsed items to MongoDB using a staging collection + atomic swap.

    The previous data is preserved until the new dataset is fully written.
    If the process crashes mid-insert, the live collection is untouched.
    """
    logger = logging.getLogger(__name__)
    logger.info("Connecting to MongoDB...")

    client = MongoClient(mongo_uri, serverSelectionTimeoutMS=10000)
    try:
        client.admin.command("ping")
        logger.info("✅ MongoDB connected")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        client.close()
        raise

    db = client[db_name]
    staging_name = f"{collection}__staging"
    backup_name = f"{collection}__backup"

    try:
        # 1. Drop any leftover staging collection from a prior failed run
        if staging_name in db.list_collection_names():
            logger.info(f"Dropping stale staging collection {staging_name}...")
            db.drop_collection(staging_name)

        staging = db[staging_name]

        logger.info("Creating compound index on staging (area, year, item_number)...")
        staging.create_index([
            ("area", ASCENDING),
            ("metadata.year", ASCENDING),
            ("about_item.item_number", ASCENDING)
        ], unique=True)

        # 2. Insert into staging — live collection is still intact
        logger.info(f"Inserting {len(items)} documents into staging...")
        inserted_count = 0
        try:
            result = staging.insert_many(items, ordered=False)
            inserted_count = len(result.inserted_ids)
            logger.info(f"✅ Inserted {inserted_count} documents into staging.")
        except BulkWriteError as bwe:
            inserted_count = bwe.details.get("nInserted", 0)
            dups = len([e for e in bwe.details.get("writeErrors", []) if e.get("code") == 11000])
            logger.warning(f"Staging: inserted {inserted_count} new items, skipped {dups} duplicates.")

        if inserted_count == 0:
            raise RuntimeError("No documents written to staging — refusing to swap.")

        # 3. Atomic swap: backup live -> rename staging into live
        live_exists = collection in db.list_collection_names()

        if backup_name in db.list_collection_names():
            db.drop_collection(backup_name)

        if live_exists:
            logger.info(f"Backing up {collection} -> {backup_name}...")
            db[collection].rename(backup_name)

        logger.info(f"Promoting staging -> {collection}...")
        staging.rename(collection)

        # 4. Drop the backup only after a successful swap
        if live_exists:
            db.drop_collection(backup_name)

        logger.info(f"✅ Swap complete. Live collection now has {db[collection].count_documents({})} documents.")
    finally:
        client.close()


# ====================== MAIN ======================

def load_config(path: Path) -> Dict[str, Any]:
    """Load YAML config if it exists; return empty dict otherwise."""
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}
    if not isinstance(data, dict):
        raise ValueError(f"Config at {path} must be a YAML mapping, got {type(data).__name__}")
    return data


def main():
    # First pass: parse just --config so we know which file to load.
    pre = argparse.ArgumentParser(add_help=False)
    pre.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH)
    pre_args, remaining = pre.parse_known_args()

    cfg = load_config(pre_args.config)

    # Precedence: CLI > env > config file > built-in defaults
    parser = argparse.ArgumentParser(
        description="LMF Checklist PDF Parser & Uploader",
        parents=[pre],
    )
    parser.add_argument("--pdf-dir", type=Path,
                        default=Path(cfg.get("pdf_dir", DEFAULT_PDF_DIR)),
                        help="Root directory containing PDF folders")
    parser.add_argument("--years", type=int, nargs="*",
                        default=cfg.get("default_years"),
                        help="Only process specific years (e.g. 2025 2026)")
    parser.add_argument("--upload", action="store_true",
                        help="Upload to MongoDB after parsing")
    parser.add_argument("--mongo-uri", type=str,
                        default=os.environ.get("MONGO_URI",
                                               cfg.get("mongo_uri", DEFAULT_MONGO_URI)),
                        help="MongoDB connection URI")
    parser.add_argument("--db-name", type=str,
                        default=cfg.get("db_name", DEFAULT_DB_NAME),
                        help="MongoDB database name")
    parser.add_argument("--collection", type=str,
                        default=cfg.get("collection", DEFAULT_COLLECTION),
                        help="MongoDB collection name")
    parser.add_argument("--verbose", "-v", action="store_true",
                        help="Enable debug logging")
    parser.add_argument("--skip-pages", type=int,
                        default=cfg.get("skip_first_pages", 5),
                        help="Number of front pages to skip (default: 5)")
    args = parser.parse_args()

    logger = setup_logging(args.verbose)
    if cfg:
        logger.info(f"Loaded config from {pre_args.config}")

    pdf_dir = args.pdf_dir
    if not pdf_dir.exists():
        logger.error(f"Directory not found: {pdf_dir}")
        return 1

    # Load classification map
    map_path = pdf_dir / "classification_map.json"
    if not map_path.exists():
        logger.error(f"classification_map.json not found at {map_path}")
        return 1

    with open(map_path, "r", encoding="utf-8") as f:
        classification_map = json.load(f)
    logger.info(f"Loaded classification map with {len(classification_map)} areas.")

    # Find all PDFs
    pdf_files = []
    for root, _, files in os.walk(pdf_dir):
        for file in files:
            if file.lower().endswith(".pdf"):
                pdf_files.append(Path(root) / file)

    logger.info(f"Found {len(pdf_files)} PDF files.")

    # Filter by year if requested
    if args.years:
        pdf_files = [p for p in pdf_files if any(str(y) in p.name for y in args.years)]
        logger.info(f"Filtered to {len(pdf_files)} PDFs matching requested years.")

    all_items = []

    for pdf_path in tqdm(pdf_files, desc="Parsing PDFs"):
        rel_path = pdf_path.relative_to(pdf_dir)
        logger.debug(f"Processing {rel_path}")

        try:
            pages = extract_pages(pdf_path, args.skip_pages)
            items = parse_all_items(pages, str(rel_path), classification_map)
            logger.info(f"  → Parsed {len(items)} items from {rel_path}")
            all_items.extend(items)
        except Exception as e:
            logger.error(f"Failed to process {rel_path}: {e}", exc_info=args.verbose)

    if not all_items:
        logger.error("No items were parsed. Exiting.")
        return 1

    # Deduplication
    unique_items = {}
    dups_count = 0
    for item in all_items:
        key = (
            item["area"],
            item["metadata"].get("year"),
            item["about_item"]["item_number"]
        )
        if key in unique_items:
            dups_count += 1
            if (not unique_items[key]["about_item"].get("description") and 
                item["about_item"].get("description")):
                unique_items[key] = item
        else:
            unique_items[key] = item

    final_items = list(unique_items.values())
    logger.info(f"Deduplicated: Removed {dups_count} duplicates. Final count: {len(final_items)}")

    # Save JSON
    output_path = pdf_dir / "checklist_items_final.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(final_items, f, ensure_ascii=False, indent=2)

    logger.info(f"✅ Data saved to {output_path}")

    # Upload if requested
    if args.upload:
        try:
            upload_to_mongodb(
                final_items,
                args.mongo_uri,
                args.db_name,
                args.collection
            )
            logger.info("🎉 Migration and upload completed successfully!")
        except Exception as e:
            logger.error(f"Upload failed: {e}")
            return 1
    else:
        logger.info("Run with --upload to also load data into MongoDB.")

    return 0


if __name__ == "__main__":
    exit(main())
