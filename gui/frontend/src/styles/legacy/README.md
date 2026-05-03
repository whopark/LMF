# Legacy Comparison CSS

이 폴더의 CSS 클래스들은 현재 어떤 JSX 컴포넌트에서도 참조되지 않는 것으로 확인되었습니다.
(검증 시점: 2026-05-03, `grep className=` over `gui/frontend/src/**/*.jsx`)

남겨둔 이유:
- 안전 — 누락된 참조가 있을 가능성을 0%로 단정하기 어렵습니다.
- 추적 — App.css 분할 작업의 범위를 reorganization으로 한정.

후속 작업으로 다음을 수행하면 안전하게 모두 제거 가능합니다:

```bash
# 각 파일별로 모든 클래스를 grep해서 0건이면 삭제
grep -rE 'className.*?\b(change-card|change-content|comparison-row|compare-container|change-item-doc|sbs-NONE)\b' gui/frontend/src
```

해당 폴더를 import하는 곳:
- `gui/frontend/src/App.css` (현재 import 인덱스)

## 파일 분할 근거

| 파일 | 클래스 패밀리 | 줄 수 |
|---|---|---|
| `comparison-card.css` | `change-card`, `change-*-badge`, `change-before/after`, `change-content` | ~140 |
| `comparison-doc.css` | `change-card-title`, `comparison-row`, `tag-before`/`tag-after`/`tag-new`/`tag-deleted`, `desc-before`/`desc-after`, `desc-detail`, `change-line`, `changes-list-simple` | ~270 |
| `comparison-panels.css` | `compare-container`, `compare-panel`, `compare-year-badge`, `change-badge`, `change-item-doc`, `tag-*-doc` | ~280 |
