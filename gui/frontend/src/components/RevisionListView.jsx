import React from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { useFilterContext } from '../contexts/FilterContext.jsx';
import { formatScore } from '../utils/helpers.jsx';

const STATUS_LABEL = { none: '미시작', draft: '수정중', review: '검토중', final: '최종' };
const STATUS_CSS = { none: 'status-none', draft: 'status-draft', review: 'status-review', final: 'status-final' };

/**
 * 화면 A — Selected items for revision.
 * Shows items checked in the dashboard, with "비교·개정" navigation to 화면 B.
 */
function RevisionListView({ selectedItems = [], onNavigateToRevision }) {
  return (
    <div className="revision-list-view">
      <header className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ClipboardList size={24} />
          <div>
            <h2 style={{ margin: 0 }}>개정 대상 문항 목록 (화면 A)</h2>
            <p style={{ color: '#64748b', fontSize: '0.875rem', margin: 0 }}>
              {selectedItems.length}개 문항 선택됨
            </p>
          </div>
        </div>
      </header>

      {selectedItems.length === 0 ? (
        <div className="placeholder-text">
          선택된 문항이 없습니다. 대시보드에서 문항을 체크박스로 선택하세요.
        </div>
      ) : (
        <div className="revision-item-list">
          {selectedItems.map(item => (
            <RevisionListRow
              key={item._id}
              item={item}
              onNavigate={() => onNavigateToRevision && onNavigateToRevision(item)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RevisionListRow({ item, onNavigate }) {
  const ai = item.about_item;
  const status = item.revision?.status || 'none';

  return (
    <div className="revision-list-row">
      <div className="revision-row-info">
        <span className="item-id">{ai?.item_number}</span>
        <span className={`revision-status-badge ${STATUS_CSS[status] || 'status-none'}`}>
          {STATUS_LABEL[status] || status}
        </span>
        {item.revision?.revised && <span className="badge-revised">REVISED</span>}
      </div>

      <div className="revision-row-question">{ai?.question}</div>

      <div className="revision-row-meta">
        <span>{item.area} › {item.sub_category}</span>
        <span style={{ marginLeft: '1rem' }}>{item.metadata?.year}년</span>
        <span style={{ marginLeft: '1rem' }}>{formatScore(ai?.score, ai?.item_type)}</span>
      </div>

      <button
        className="btn-revision-navigate select-input"
        onClick={onNavigate}
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: 'auto', padding: '0.3rem 0.8rem' }}
      >
        비교·개정 <ArrowRight size={14} />
      </button>
    </div>
  );
}

export default RevisionListView;
