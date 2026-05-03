import pymupdf4llm
import re
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict

PDF_FOLDER = Path("/mnt/d/LMF_all/pdf/07 종합검증")
OUTPUT_JSON = Path("/mnt/d/LMF_all/pdf/verification_reports_improved.json")

def extract_structured_items(md_text: str, year: int) -> List[Dict]:
    """Improved parser focusing on score/result extraction, category, section, and table handling."""
    items = []
    current_section = ""
    current_subsection = ""
    lines = md_text.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith('---') or line.startswith('**'):
            i += 1
            continue

        # Section detection
        if re.search(r'^(#{1,3}|\d+\s+)[가-힣]+', line):
            current_section = re.sub(r'^#{1,3}\s*', '', line).strip()
            if re.search(r'^\d+\.', current_section):
                current_subsection = current_section
            i += 1
            continue

        # Main item detection
        item_match = re.search(r'(07\.\d{3}\.\d{3})', line)
        if item_match:
            item_code = item_match.group(1)
            
            # Category
            category = None
            for offset in range(6):
                if i + offset < len(lines):
                    check = lines[i + offset].lower()
                    if any(k in check for k in ['핵심c', 'core', 'c)']):
                        category = "Core (C)"
                        break
                    if any(k in check for k in ['필요r', 'required', 'r)']):
                        category = "Required (R)"
                        break
                    if any(k in check for k in ['기본b', 'basic', 'b)']):
                        category = "Basic (B)"
                        break

            # Max Points
            points_match = re.search(r'배점\s*\((\d+)\)', line)
            if not points_match:
                for offset in range(6):
                    if i + offset < len(lines):
                        points_match = re.search(r'배점\s*\((\d+)\)', lines[i+offset])
                        if points_match: 
                            break
            max_points = int(points_match.group(1)) if points_match else None

            # Description
            desc_part = re.sub(r'.*?07\.\d{3}\.\d{3}\s*', '', line, flags=re.DOTALL).strip()
            description = desc_part if len(desc_part) > 8 else (lines[i+1].strip() if i+1 < len(lines) else "N/A")

            # Score / Result extraction
            awarded_points = None
            result = None
            remarks = None

            result_match = re.search(r'(예|아니오|해당없음|해당 없음)', line)
            if result_match:
                result = result_match.group(1)

            score_match = re.search(r'(\d+)\s*점', line)
            if score_match:
                awarded_points = int(score_match.group(1))
            elif max_points and result == "예":
                awarded_points = max_points

            # Explanation + remarks
            explanation = []
            remarks_parts = []
            i += 1
            while i < len(lines):
                nxt = lines[i].strip()
                if re.search(r'07\.\d{3}\.\d{3}', nxt) or re.match(r'^#{1,3}', nxt):
                    break
                if nxt:
                    explanation.append(nxt)
                    if any(word in nxt for word in ['감점', '개선', '권고', '미비', '특이사항', '주의']):
                        remarks_parts.append(nxt)
                i += 1

            explanation_text = " ".join(explanation).strip()
            if remarks_parts:
                remarks = " | ".join(remarks_parts[:3])

            items.append({
                "item_code": item_code,
                "section": current_section,
                "subsection": current_subsection,
                "category": category,
                "description": description[:180],
                "max_points": max_points,
                "awarded_points": awarded_points,
                "result": result,
                "remarks": remarks,
                "explanation": explanation_text[:700] + ("..." if len(explanation_text) > 700 else ""),
                "page": None
            })
            continue

        i += 1
    return items


def process_pdf(pdf_path: Path) -> Dict:
    print(f"Processing {pdf_path.name} with improved parser...")
    year = int(pdf_path.stem)
    md_text = pymupdf4llm.to_markdown(str(pdf_path))
    
    items = extract_structured_items(md_text, year)
    
    doc = {
        "year": year,
        "document_type": "우수검사실_신임인증_종합검증",
        "title": "우수검사실 신임인증 심사점검표",
        "file_path": str(pdf_path),
        "extracted_at": datetime.now().isoformat(),
        "total_pages": 13,
        "overall_score": None,
        "max_score": 1000,
        "final_result": None,
        "checklist_items": items,
        "full_markdown": md_text[:8000],
        "processed_by": "Hermes Agent v2 (improved parser)"
    }
    return doc


def main():
    pdf_files = sorted(PDF_FOLDER.glob("*.pdf"))
    all_docs = [process_pdf(pdf) for pdf in pdf_files]
    
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(all_docs, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Improved parser completed!")
    print(f"Generated {len(all_docs)} documents → {OUTPUT_JSON}")
    print("Key improvements:")
    print("  • Much better category (Core/Required/Basic) detection")
    print("  • Robust awarded_points & result (예/아니오) extraction")
    print("  • Better section/subsection hierarchy")
    print("  • Remarks detection from context")
    print("\nFile ready for MongoDB import.")


if __name__ == "__main__":
    main()
