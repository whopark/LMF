import React from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { getTagClass, formatScore } from '../utils/helpers.jsx';
import { useFilterContext } from '../contexts/FilterContext.jsx';

const CLASS_LABEL = { C: '핵심', R: '필요', B: '기본' };
const CLASS_CSS = { C: 'badge-core', R: 'badge-required', B: 'badge-basic' };

function DashboardView({ items, loading, setSelectedItem }) {
  // Use context directly — fixes "setSearchTerm is not a function" bug
  const { searchTerm, setSearchTerm, page, setPage, totalPages } = useFilterContext();

  return (
    <>
      <header className="header">
        <div className="search-container">
          <Search className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="문항번호, 질문 또는 설명 검색..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
          />
        </div>
        <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
          페이지 {page} / {totalPages}
        </div>
      </header>

      <section className="items-list">
        {loading ? (
          <div className="loader-container"><div className="loader">검색 중...</div></div>
        ) : (
          <div className="items-grid">
            {items.map(item => (
              <ItemCard key={item._id} item={item} onClick={() => setSelectedItem(item)} />
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

function ItemCard({ item, onClick }) {
  const ai = item.about_item;
  const cls = ai?.item_type || '';
  const isRevised = item.revision?.revised;
  const isCommon = Boolean(item.common_key);
  const descPreview = ai?.description
    ? (ai.description.length > 80 ? ai.description.slice(0, 80) + '…' : ai.description)
    : null;

  return (
    <motion.div
      className="item-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
    >
      <div className="item-header">
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span className="item-id">{ai?.item_number}</span>
          {isRevised && <span className="badge-revised">REVISED</span>}
          {isCommon && <span className="badge-common">공통</span>}
          {cls && CLASS_LABEL[cls] && (
            <span className={CLASS_CSS[cls] || 'badge-required'}>
              {CLASS_LABEL[cls]}
            </span>
          )}
        </div>
        <span className="item-score-tag">
          {formatScore(ai?.score, cls)}
        </span>
      </div>

      <h3 className="item-question">{ai?.question}</h3>

      {descPreview && (
        <p className="item-description-preview">{descPreview}</p>
      )}

      <div className="item-footer">
        <span>{item.area} › {item.sub_category}</span>
        <span>{item.metadata?.year}년</span>
      </div>
    </motion.div>
  );
}

export default DashboardView;
