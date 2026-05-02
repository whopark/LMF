import React from 'react';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';
import { getDisplayData, getTagClass } from '../utils/helpers.jsx';

function DashboardView({
  items,
  loading,
  searchTerm,
  setSearchTerm,
  page,
  setPage,
  totalPages,
  setSelectedItem
}) {
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
            {items.map(item => {
              const display = getDisplayData(item);
              return (
                <motion.div
                  key={item._id}
                  className="item-card"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedItem(item)}
                >
                  <div className="item-header">
                    <span className="item-id">{item.about_item.item_number}</span>
                    <span className={`item-type-tag ${getTagClass(item.about_item.item_type)}`}>
                      {item.about_item.item_type || '정보'}
                    </span>
                  </div>
                  <h3 className="item-question">{display.question}</h3>
                  <div className="item-footer">
                    <span>{item.area} › {item.sub_category}</span>
                    <span>{item.metadata.year}년</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
        <div className="pagination">
          <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="select-input">이전</button>
          <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="select-input">다음</button>
        </div>
      </section>
    </>
  );
}

export default DashboardView;
