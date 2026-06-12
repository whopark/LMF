import React from 'react';
import { Search, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import { getTagClass, formatScore, API_BASE } from '../utils/helpers.jsx';
import { useFilterContext } from '../contexts/FilterContext.jsx';

const CLASS_LABEL = { C: '핵심', R: '필요', B: '기본' };
const CLASS_CSS = { C: 'badge-core', R: 'badge-required', B: 'badge-basic' };

const SEARCH_FIELDS = [
  { value: '', label: '전체 필드' },
  { value: 'item_number', label: '문항번호' },
  { value: 'question', label: '문항 키워드' },
  { value: 'description', label: '설명 키워드' },
];

function buildExportUrl(base, params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  const apiKey = import.meta.env?.VITE_API_KEY || '';
  if (apiKey) q.set('apiKey', apiKey);
  return `${base}?${q.toString()}`;
}

function DashboardView({ items, loading, setSelectedItem }) {
  const {
    searchTerm, setSearchTerm, searchField, setSearchField,
    page, setPage, totalPages,
    selectedItemIds, toggleItemSelection,
    selectedYear, selectedArea,
  } = useFilterContext();

  const exportParams = { year: selectedYear, area: selectedArea };

  return (
    <>
      <header className="header">
        <div className="search-container" style={{ flex: 1, display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <Search className="search-icon" />
          <select
            className="select-input"
            style={{ width: '120px', fontSize: '0.8rem', padding: '0.35rem 0.5rem' }}
            value={searchField}
            onChange={e => { setSearchField(e.target.value); setPage(1); }}
          >
            {SEARCH_FIELDS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
          <input
            type="text"
            className="search-input"
            style={{ flex: 1 }}
            placeholder={searchField === 'item_number' ? '문항번호 검색 (예: 01.010)' :
              searchField === 'question' ? '문항 키워드 검색...' :
              searchField === 'description' ? '설명 키워드 검색...' :
              '문항번호, 질문 또는 설명 검색...'}
            value={searchTerm}
            onChange={e => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.875rem', color: '#64748b' }}>
            {page} / {totalPages}
          </span>
          <ExportMenu exportParams={exportParams} />
        </div>
      </header>

      <section className="items-list">
        {loading ? (
          <div className="loader-container"><div className="loader">검색 중...</div></div>
        ) : (
          <div className="items-grid">
            {items.map(item => (
              <ItemCard
                key={item._id}
                item={item}
                checked={Boolean(selectedItemIds[item._id])}
                onCheck={e => { e.stopPropagation(); toggleItemSelection(item); }}
                onClick={() => setSelectedItem(item)}
              />
            ))}
          </div>
        )}
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="select-input">이전</button>
          <button disabled={page === totalPages || totalPages === 0} onClick={() => setPage(p => p + 1)} className="select-input">다음</button>
        </div>
      </section>
    </>
  );
}

function ExportMenu({ exportParams }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div style={{ position: 'relative' }}>
      <button
        className="select-input"
        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', width: 'auto', padding: '0.35rem 0.75rem' }}
        onClick={() => setOpen(o => !o)}
      >
        <Download size={14} /> 내보내기
      </button>
      {open && (
        <div className="export-dropdown" style={{
          position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem',
          background: '#1e293b', border: '1px solid #334155', borderRadius: '0.5rem',
          padding: '0.5rem', zIndex: 50, minWidth: '180px',
        }}>
          <a
            href={buildExportUrl(`${API_BASE}/export/items.xlsx`, exportParams)}
            download="items.xlsx"
            style={{ display: 'block', padding: '0.4rem 0.75rem', color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}
            onClick={() => setOpen(false)}
          >
            📊 문항 목록 (.xlsx)
          </a>
          <a
            href={buildExportUrl(`${API_BASE}/export/revisions.xlsx`, exportParams)}
            download="revisions.xlsx"
            style={{ display: 'block', padding: '0.4rem 0.75rem', color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}
            onClick={() => setOpen(false)}
          >
            📋 개정 이력 (.xlsx)
          </a>
          <a
            href={buildExportUrl(`${API_BASE}/export/revisions.docx`, exportParams)}
            download="revisions.docx"
            style={{ display: 'block', padding: '0.4rem 0.75rem', color: '#94a3b8', textDecoration: 'none', fontSize: '0.85rem' }}
            onClick={() => setOpen(false)}
          >
            📄 개정 보고서 (.docx)
          </a>
          <div
            style={{ borderTop: '1px solid #334155', margin: '0.25rem 0' }}
          />
          <button
            style={{ display: 'block', padding: '0.4rem 0.75rem', color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', width: '100%', textAlign: 'left' }}
            onClick={() => { window.print(); setOpen(false); }}
          >
            🖨️ PDF로 저장 (인쇄)
          </button>
        </div>
      )}
    </div>
  );
}

function ItemCard({ item, checked, onCheck, onClick }) {
  const ai = item.about_item;
  const cls = ai?.item_type || '';
  const isRevised = item.revision?.revised;
  const isCommon = Boolean(item.common_key);
  const descPreview = ai?.description
    ? (ai.description.length > 80 ? ai.description.slice(0, 80) + '…' : ai.description)
    : null;

  return (
    <motion.div className="item-card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onClick={onClick}>
      <div className="item-header">
        <input type="checkbox" checked={checked} onChange={onCheck} onClick={e => e.stopPropagation()}
          style={{ cursor: 'pointer', marginRight: '0.4rem' }} />
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="item-id">{ai?.item_number}</span>
          {isRevised && <span className="badge-revised">REVISED</span>}
          {isCommon && <span className="badge-common">공통</span>}
          {cls && CLASS_LABEL[cls] && (
            <span className={CLASS_CSS[cls] || 'badge-required'}>{CLASS_LABEL[cls]}</span>
          )}
        </div>
        <span className="item-score-tag">{formatScore(ai?.score, cls)}</span>
      </div>
      <h3 className="item-question">{ai?.question}</h3>
      {descPreview && <p className="item-description-preview">{descPreview}</p>}
      <div className="item-footer">
        <span>{item.area} › {item.sub_category}</span>
        <span>{item.metadata?.year}년</span>
      </div>
    </motion.div>
  );
}

export default DashboardView;
