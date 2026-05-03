# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Lab Accreditation Intelligence Platform (우수검사실 종합검증 분석 시스템)** - A data pipeline and analysis dashboard for Korean laboratory accreditation verification reports (2020-2026). Parses PDF accreditation checklists, stores in MongoDB, and provides trend analysis.

## Common Commands

```bash
# Run the dashboard analysis (generates charts to dashboard_output/)
python dashboard.py

# Parse PDFs and extract structured data (v4 parser - final version)
python import_verification_reports_v4.py

# Import parsed data to MongoDB
python import_to_mongodb.py

# Install dependencies
pip install -r requirements.txt
```

## Architecture

### Data Pipeline Flow
```
PDF Files (07 종합검증/*.pdf)
    ↓ pymupdf4llm
import_verification_reports_v4.py → verification_reports_v4.json
    ↓ pymongo
import_to_mongodb.py → MongoDB (verification_reports collection)
    ↓
dashboard.py → Analysis charts + reports
```

### Key Components

1. **PDF Parser** (`import_verification_reports_v4.py`): Extracts checklist items with item codes (`07.xxx.xxx`), sections, categories (Core/Required/Basic), scores, and results from Korean PDF documents using `pymupdf4llm`.

2. **Dashboard** (`dashboard.py`): Pandas-based analysis generating compliance trends, weakest sections, and problematic items. Outputs PNG charts to `dashboard_output/`.

3. **Web Dashboard** (`web_dashboard/index.html`): Static HTML version for interactive viewing.

### Data Model (MongoDB)
- Collection: `verification_reports`
- Key fields: `year`, `checklist_items[]` (item_code, section, category, max_points, awarded_points, result, remarks)
- Indexes: year, item_code, section, category

### Checklist Item Structure
```python
{
    "item_code": "07.405.420",      # Standard code format
    "section": "질관리: 검사전후단계",
    "category": "Required (R)",      # Core (C) | Required (R) | Basic (B)
    "max_points": 2,
    "awarded_points": 0,
    "result": "아니오",              # 예 | 아니오 | 해당없음
    "remarks": "전문의 직접 작성 미흡"
}
```

## Key Dependencies

- **PDF Processing**: `pymupdf4llm`, `PyMuPDF`
- **Database**: `pymongo` (MongoDB)
- **Analysis**: `pandas`, `matplotlib`
- **Medical Imaging** (broader project): `monai`, `pydicom`, `SimpleITK`

## Data Files

- `verification_reports_v4.json`: Parsed PDF data (primary data source)
- `checklist_items_final.json`: Flattened checklist items
- `classification_map.json`: Category mappings
