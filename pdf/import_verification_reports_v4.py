import pymupdf4llm
import re
import json
from pathlib import Path
from datetime import datetime
from typing import List, Dict

PDF_FOLDER = Path("/mnt/d/LMF_all/pdf/07 종합검증")
OUTPUT_JSON = Path("/mnt/d/LMF_all/pdf/verification_reports_v4.json")

def extract_structured_items(md_text: str, year: int) -> List[Dict]:
    """v4: Final major upgrade - Strong focus on score, result, and remarks extraction."""
    items = []
    current_section = "Unknown"
    current_subsection = ""
    lines = md_text.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line or line.startswith('---') or '**==> picture' in line:
            i += 1
            continue

        # Enhanced Section Detection
        if re.search(r'^\d+\s*[.]?\s*[가-힣]+', line) or any(k in line for k in ['심사범위', '질관리', '정도관리', '인력', '전문의', '종합의견']):
            current_section = re.sub(r'^\d+\s*[.]?\s*', '', line).strip()[:40]
            if re.search(r'^\d', line):
                current_subsection = current_section
            i += 1
            continue

        # Item code detection
        item_match = re.search(r'(07\.\d{3}\.\d{3})', line)
        if item_match:
            item_code = item_match.group(1)
            
            # Category
            category = None
            for offset in range(0, 10):
                if i + offset < len(lines):
                    check = lines[i + offset].lower()
                    if any(k in check for k in ['핵심c', 'core', 'c)', '핵심문항']):
                        category = "Core (C)"
                        break
                    if any(k in check for k in ['필요r', 'required', 'r)', '필요문항']):
                        category = "Required (R)"
                        break
                    if any(k in check for k in ['기본b', 'basic', 'b)', '기본문항']):
                        category = "Basic (B)"
                        break

            # Max Points
            points_match = re.search(r'배점\s*\((\d+)\)', line)
            if not points_match:
                for offset in range(10):
                    if i + offset < len(lines):
                        points_match = re.search(r'배점\s*\((\d+)\)', lines[i+offset])
                        if points_match:
                            break
            max_points = int(points_match.group(1)) if points_match else None

            # Description
            desc_part = re.sub(r'.*?07\.\d{3}\.\d{3}\s*', '', line, flags=re.DOTALL).strip()
            description = desc_part if len(desc_part) > 5 else "N/A"

            # === Score / Result Extraction (v4 focus) ===
            awarded_points = None
            result = None
            remarks = None

            # Look for result (예, 아니오, 해당없음)
            result_match = re.search(r'(예|아니오|해당 ?없음)', line)
            if result_match:
                result = result_match.group(1)

            # Awarded points - multiple patterns
            score_match = re.search(r'(\d{1,3})\s*점', line)
            if score_match:
                awarded_points = int(score_match.group(1))
            elif max_points and result in ('예', '해당없음'):
                awarded_points = max_points

            # Look in next lines for score/result if not found
            if awarded_points is None or result is None:
                for offset in range(1, 6):
                    if i + offset < len(lines):
                        nxt = lines[i + offset]
                        if re.search(r'(예|아니오)', nxt):
                            if not result:
                                result = re.search(r'(예|아니오)', nxt).group(1)
                        score2 = re.search(r'(\d+)\s*점', nxt)
                        if score2 and not awarded_points:
                            awarded_points = int(score2.group(1))

            # Remarks & Explanation
            explanation = []
            remarks_parts = []
            i += 1
            while i < len(lines):
                nxt = lines[i].strip()
                if re.search(r'07\.\d{3}\.\d{3}', nxt) or re.match(r'^#{1,3}', nxt):
                    break
                if nxt and not nxt.startswith('**'):
                    explanation.append(nxt)
                    if any(w in nxt for w in ['감점','개선','권고','미비','특이사항','주의','권장','0점','8점']):
                        remarks_parts.append(nxt)
                i += 1

            explanation_text = " ".join(explanation).strip()
            remarks = " | ".join(remarks_parts[:4]) if remarks_parts else None

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
    print(f"Processing {pdf_path.name} → v4 parser (final)")
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
        "processed_by": "Hermes Agent v4 - Final Score & Section Parser"
    }
    return doc


def main():
    pdf_files = sorted(PDF_FOLDER.glob("*.pdf"))
    all_docs = [process_pdf(pdf) for pdf in pdf_files]
    
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(all_docs, f, ensure_ascii=False, indent=2)
    
    print(f"\n🎉 v4 Parser completed successfully!")
    print(f"Output saved to: {OUTPUT_JSON}")
    print("\nThis is the final version with best score/result and section extraction.")


if __name__ == "__main__":
    main()
