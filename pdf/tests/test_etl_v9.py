"""Tests for ETL v9 transform logic."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import pytest
from etl_v9 import transform_item, compute_ordering, infer_classification, clean_text


# ---------- Fixtures ----------

def make_source(
    area="01 검사실운영",
    item_number="01.010.020",
    sub_category="심사범위",
    question="검사실에서 시행하는 모든 검사 분야에 대해 인증심사를 받는가?",
    description="",
    item_type=None,
    score=None,
    has_na=False,
    year=2024,
    page=9,
    source_file="01 검사실운영\\2024.pdf",
):
    return {
        "area": area,
        "sub_category": sub_category,
        "about_item": {
            "item_number": item_number,
            "item_type": item_type,
            "item_type_en": "Unknown" if item_type is None else item_type,
            "score": score,
            "score_note": None,
            "has_na": has_na,
            "question": question,
            "description": description,
            "section": sub_category,
        },
        "metadata": {
            "page": page,
            "source": source_file,
            "year": year,
            "created_at": "2026-06-12T00:00:00Z",
        },
    }


# ---------- transform_item ----------

class TestTransformItem:
    def test_area_code_extracted(self):
        out = transform_item(make_source(area="01 검사실운영"), sub_category_order=1, item_order=1)
        assert out["area_code"] == "01"

    def test_area_name_extracted(self):
        out = transform_item(make_source(area="01 검사실운영"), sub_category_order=1, item_order=1)
        assert out["area_name"] == "검사실운영"

    def test_common_key_computed(self):
        out = transform_item(make_source(item_number="01.010.020"), sub_category_order=1, item_order=1)
        assert out["common_key"] == "010.020"

    def test_common_key_consistent_across_areas(self):
        out1 = transform_item(make_source(area="01 검사실운영", item_number="01.010.020"), 1, 1)
        out2 = transform_item(make_source(area="90 분자진단검사", item_number="90.010.020"), 1, 1)
        assert out1["common_key"] == out2["common_key"] == "010.020"

    def test_na_available_mapped(self):
        out_true = transform_item(make_source(has_na=True), 1, 1)
        out_false = transform_item(make_source(has_na=False), 1, 1)
        assert out_true["na_available"] is True
        assert out_false["na_available"] is False

    def test_source_stored(self):
        out = transform_item(make_source(page=9, source_file="01 검사실운영\\2024.pdf"), 1, 1)
        assert out["source"]["page"] == 9
        assert "2024.pdf" in out["source"]["filename"]

    def test_sub_category_order_assigned(self):
        out = transform_item(make_source(), sub_category_order=3, item_order=2)
        assert out["sub_category_order"] == 3
        assert out["item_order"] == 2

    def test_year_preserved(self):
        out = transform_item(make_source(year=2020), 1, 1)
        assert out["year"] == 2020

    def test_question_preserved(self):
        q = "이것은 테스트 질문인가?"
        out = transform_item(make_source(question=q), 1, 1)
        assert out["question"] == q

    def test_score_none_preserved(self):
        out = transform_item(make_source(score=None), 1, 1)
        assert out["score"] is None

    def test_score_numeric_preserved(self):
        out = transform_item(make_source(score=10), 1, 1)
        assert out["score"] == 10

    def test_revision_defaults(self):
        out = transform_item(make_source(), 1, 1)
        assert out["revision"]["status"] == "none"
        assert out["revision"]["locked"] is False
        assert out["revision"]["revised"] is False


# ---------- compute_ordering ----------

class TestComputeOrdering:
    def test_items_sorted_by_middle_code(self):
        items = [
            make_source(item_number="01.300.001", sub_category="정도관리"),
            make_source(item_number="01.010.001", sub_category="심사범위"),
            make_source(item_number="01.202.001", sub_category="질관리 일반"),
        ]
        result = compute_ordering(items)
        # 심사범위 (010) < 질관리 일반 (202) < 정도관리 (300)
        orders = {r["sub_category"]: r["sub_category_order"] for r in result}
        assert orders["심사범위"] < orders["질관리 일반"] < orders["정도관리"]

    def test_item_order_within_sub_category(self):
        items = [
            make_source(item_number="01.010.040", sub_category="심사범위"),
            make_source(item_number="01.010.020", sub_category="심사범위"),
            make_source(item_number="01.010.060", sub_category="심사범위"),
        ]
        result = compute_ordering(items)
        by_num = {r["item_number"]: r["item_order"] for r in result}
        assert by_num["01.010.020"] < by_num["01.010.040"] < by_num["01.010.060"]


# ---------- infer_classification ----------

class TestInferClassification:
    def test_null_score_no_na_is_core(self):
        assert infer_classification(score=None, has_na=False, item_type=None) == "C"

    def test_numeric_score_unknown(self):
        # Without more info, numeric score is R or B — leave blank
        result = infer_classification(score=10, has_na=False, item_type=None)
        assert result in ("R", "B", "")

    def test_explicit_type_overrides(self):
        assert infer_classification(score=None, has_na=False, item_type="핵심") == "C"
        assert infer_classification(score=5, has_na=False, item_type="필요") == "R"
        assert infer_classification(score=5, has_na=False, item_type="기본") == "B"


# ---------- clean_text ----------

class TestCleanText:
    def test_strips_leading_trailing_whitespace(self):
        assert clean_text("  hello  ") == "hello"

    def test_normalizes_bullet_u2022_to_u2219(self):
        # H1 regression: • (U+2022) must become ∙ (U+2219 BULLET OPERATOR), not ⋅ (U+22C5)
        result = clean_text("• 첫 번째 항목")
        assert "∙" in result          # must have U+2219
        assert "•" not in result      # must not have U+2022
        assert "⋅" not in result  # must not have wrong U+22C5

    def test_normalizes_all_bullet_variants(self):
        # All three variants should all become ∙ U+2219
        for ch in ("•", "⋅", "·"):
            result = clean_text(f"{ch} 항목")
            assert "∙" in result, f"Expected ∙ after normalizing {repr(ch)}"

    def test_none_returns_empty(self):
        assert clean_text(None) == ""

    def test_preserves_content(self):
        text = "검사실 조직도가 있는가?"
        assert clean_text(text) == text


class TestComputeCommonKey:
    def test_standard_format(self):
        # H2 regression: regex-based, not length-based slicing
        from etl_v9 import compute_common_key
        assert compute_common_key("01.010.090") == "010.090"
        assert compute_common_key("90.010.090") == "010.090"

    def test_nonstandard_returns_empty(self):
        from etl_v9 import compute_common_key
        # e.g. manual correction items with non-numeric segments
        assert compute_common_key("08.제공.001") == ""
        assert compute_common_key("") == ""
        assert compute_common_key(None) == ""

    def test_common_key_consistent_across_areas(self):
        from etl_v9 import compute_common_key
        assert compute_common_key("01.010.020") == compute_common_key("90.010.020")
