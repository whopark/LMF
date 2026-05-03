# MongoDB Schema for 종합검증 (Comprehensive Verification) PDFs

## 1. Main Collection: `verification_reports`

```json
{
  "_id": ObjectId,
  "year": 2026,
  "document_type": "우수검사실_신임인증_종합검증",
  "title": "우수검사실 신임인증 심사점검표",
  "file_path": "/mnt/d/LMF_all/pdf/07 종합검증/2026.pdf",
  "extracted_at": ISODate("2026-05-01T19:00:00Z"),
  "total_pages": 13,
  "overall_score": 948,
  "max_score": 1000,
  "compliance_rate": 94.8,
  "final_result": "합격",                    // "합격", "1년 인증", "재심사 필요", etc.

  "change_log": [
    {
      "type": "수정",
      "item_code": "07.010.020",
      "description": "설명 수정"
    }
  ],

  "sections": [
    {
      "name": "1. 심사범위",
      "page_start": 5,
      "score": 28,
      "max_score": 30
    }
  ],

  "checklist_items": [
    {
      "item_code": "07.300.420",
      "section": "3. 질관리: 검사단계",
      "category": "Required (R)",
      "description": "검사실은 정확한 검사를 위하여 내부정도관리 프로그램을 올바르게 이용하고 있는가?",
      "max_points": 24,
      "awarded_points": 22,
      "result": "예",
      "remarks": "6개 분야 감점 점수 합산 후 계산",
      "page": 8,
      "explanation": "Full guidance text from PDF..."
    }
  ],

  "full_markdown": "...",                     // Optional: full converted markdown
  "raw_text": "...",                          // For full-text search
  "metadata": {
    "producer": "Acrobat Distiller 25.0",
    "creation_date": "2026-01-19"
  }
}
```

## 2. Master Checklist Collection (Optional but Recommended): `checklist_master`

Stores the official checklist per year for comparison.

```json
{
  "year": 2026,
  "version": "2026.01",
  "total_items": 58,
  "items": [
    {
      "item_code": "07.010.020",
      "section": "1. 심사범위",
      "category": "Core (C)",
      "description": "...",
      "max_points": 10,
      "guidance": "..."
    }
  ]
}
```

## Indexes (Recommended)

```javascript
db.verification_reports.createIndex({ year: 1 });
db.verification_reports.createIndex({ "checklist_items.item_code": 1 });
db.verification_reports.createIndex({ "checklist_items.category": 1 });
db.verification_reports.createIndex({ "checklist_items.section": 1 });
db.verification_reports.createIndex({ full_markdown: "text" });
```

## Benefits of this Schema
- Easy trend analysis across years
- Strong querying on specific checklist items
- Supports both structured data and full text search
- Clean separation between master checklist and actual yearly scores/remarks
