#!/usr/bin/env python3
"""
Import script for 종합검증 PDF → MongoDB
Uses pymupdf4llm for high-quality markdown extraction + structured parsing.
"""

import pymupdf4llm
import re
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict

PDF_FOLDER = Path("/mnt/d/LMF_all/pdf/07 종합검증")
OUTPUT_JSON = Path("/mnt/d/LMF_all/pdf/verification_reports.json")

def extract_structured_items(md_text: str, year: int) -> List[Dict]:
    """Improved parser with better score, result, category, and section detection."""
    items = []
    current_section = ""
    current_subsection = ""
    lines = md_text.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue

        # === Section / Subsection Detection ===
        section_match = re.match(r'^(#{1,3}\s*)?(\d+\s*[.가-힣:]+)', line)
        if section_match:
            current_section = section_match.group(2).strip()
            if re.search(r'1\.|2\.|3\.', current_section):
                current_subsection = current_section
            i += 1
            continue

        # === Item Code Detection (main pattern) ===
        item_match = re.search(r'(07\.\d{3}\.\d{3})', line)
        if item_match:
            item_code = item_match.group(1)
            
            # --- Category Detection (much more robust) ---
            category = None
            category_line = line
            for j in range(4):  # check next few lines too
                if i + j < len(lines):
                    check = lines[i + j].strip()
                    if any(k in check for k in ['핵심C', 'Core', 'C\\)', '핵심문항']):
                        category = "Core (C)"
                        break
                    if any(k in check for k in ['필요R', 'Required', 'R\\)', '필요문항']):
                        category = "Required (R)"
                        break
                    if any(k in check for k in ['기본B', 'Basic', 'B\\)', '기본문항']):
                        category = "Basic (B)"
                        break
            
            # --- Max Points (배점) ---
            points_match = re.search(r'배점\s*\((\d+)\)', line)
            if not points_match:
                for j in range(5):
                    if i + j < len(lines):
                        points_match = re.search(r'배점\s*\((\d+)\)', lines[i+j])
                        if points_match:
                            break
            max_points = int(points_match.group(1)) if points_match else None

            # --- Description ---
            desc_part = re.sub(r'^.*?07\.\d{3}\.\d{3}\s*', '', line).strip()
            description = desc_part if desc_part and len(desc_part) > 5 else "N/A"

            # --- Awarded Score & Result (예/아니오) ---
            awarded_points = None
            result = None
            remarks_lines = []
            
            # Look for scoring patterns like "예 (10점)", "아니오", "감점", etc.
            score_result_match = re.search(r'(예|아니오|해당없음)\s*(?:\((\d+)\s*점?\))?', line)
            if score_result_match:
                result = score_result_match.group(1)
                if score_result_match.group(2):
                    awarded_points = int(score_result_match.group(2))

            # --- Collect full explanation + remarks ---
            explanation = []
            i += 1
            while i < len(lines):
                nxt_line = lines[i].strip()
                if re.search(r'07\.\d{3}\.\d{3}', nxt_line) or re.match(r'^#{1,3}', nxt_line):
                    break
                if nxt_line:
                    explanation.append(nxt_line)
                    # Try to extract remarks from common patterns
                    if any(k in nxt_line for k in ['감점', '특이사항', '개선', '권고', '미비']):
                        remarks_lines.append(nxt_line)
                i += 1

            explanation_text = " ".join(explanation).strip()
            remarks = " | ".join(remarks_lines) if remarks_lines else None

            items.append({
                "item_code": item_code,
                "section": current_section,
                "subsection": current_subsection,
                "category": category,
                "description": description[:220],
                "max_points": max_points,
                "awarded_points": awarded_points,
                "result": result,
                "remarks": remarks,
                "explanation": explanation_text[:650] + ("..." if len(explanation_text) > 650 else ""),
                "page": None
            })
            continue

        i += 1
    return items


def process_pdf(pdf_path: Path) -> Dict:
    """Convert one PDF to MongoDB document."""
    print(f"Processing {pdf_path.name}...")
    
    year = int(pdf_path.stem)
    md_text = pymupdf4llm.to_markdown(pdf_path)
    
    items = extract_structured_items(md_text, year)
    
    doc = {
        "year": year,
        "document_type": "우수검사실_신임인증_종합검증",
        "title": "우수검사실 신임인증 심사점검표",
        "file_path": str(pdf_path),
        "extracted_at": datetime.utcnow().isoformat(),
        "total_pages": len(pymupdf4llm.to_markdown(pdf_path).split('\f')),  # rough
        "overall_score": None,
        "max_score": 1000,
        "final_result": None,
        "checklist_items": items,
        "full_markdown": md_text,
        "processed_by": "Hermes Agent + pymupdf4llm"
    }
    return doc


def main():
    pdf_files = sorted(PDF_FOLDER.glob("*.pdf"))
    all_docs = []
    
    for pdf in pdf_files:
        doc = process_pdf(pdf)
        all_docs.append(doc)
    
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(all_docs, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Success! Created {len(all_docs)} documents.")
    print(f"Output saved to: {OUTPUT_JSON}")
    print("\nYou can now import this JSON into MongoDB using mongoimport or pymongo.")


if __name__ == "__main__":
    main()
