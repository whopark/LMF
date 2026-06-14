import React, { useState, useEffect, useMemo } from 'react';
import { useFilterContext } from '../contexts/FilterContext.jsx';
import SideBySideItem from './SideBySideItem.jsx';

// Perf: cap how many SideBySideItem (heavy framer-motion + DiffText) mount at once.
// Rendering the full year-diff (~1,500 items) synchronously froze the main thread.
const PAGE_SIZE = 50;

function CompareView({ loading, changesData, compareYear, compareArea }) {
  const { selectedItemObjects } = useFilterContext();
  // G-Y3: 화면 A에서 선택한 개정대상이 있으면 그 문항만 자동 필터 (없으면 전체)
  const selectedNumbers = useMemo(
    () => selectedItemObjects.map(o => o.about_item?.item_number).filter(Boolean),
    [selectedItemObjects]
  );
  const filterActive = selectedNumbers.length > 0;
  const allChanges = changesData?.changes || [];
  const visibleChanges = useMemo(
    () => (filterActive ? allChanges.filter(c => selectedNumbers.includes(c.item_number)) : allChanges),
    [allChanges, filterActive, selectedNumbers]
  );
  const counts = {
    total: visibleChanges.length,
    new: visibleChanges.filter(c => c.change_type === 'NEW').length,
    modified: visibleChanges.filter(c => c.change_type === 'MODIFIED').length,
    deleted: visibleChanges.filter(c => c.change_type === 'DELETED').length,
  };

  // Client-side pagination — bounds mounted nodes to PAGE_SIZE regardless of diff size.
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(visibleChanges.length / PAGE_SIZE));
  // Reset to first page whenever the underlying result set changes.
  useEffect(() => { setPage(1); }, [changesData, filterActive, selectedNumbers.length]);
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pageItems = visibleChanges.slice(start, start + PAGE_SIZE);

  const pager = visibleChanges.length > PAGE_SIZE ? (
    <div className="pagination" style={{ alignItems: 'center', gap: '1rem' }}>
      <button className="select-input" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)}>이전</button>
      <span style={{ fontSize: '0.85rem', color: '#64748b', whiteSpace: 'nowrap' }}>
        {safePage} / {pageCount} 페이지 · {start + 1}–{start + pageItems.length} / {visibleChanges.length}건
      </span>
      <button className="select-input" disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)}>다음</button>
    </div>
  ) : null;

  return (
    <>
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>연도별 변경 사항 비교</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {compareYear ? `${compareYear - 1}년 → ${compareYear}년 변경 내역` : '비교할 년도를 선택하세요'}
            {compareArea && ` (${compareArea})`}
            {filterActive && ` · 화면 A 선택 ${selectedNumbers.length}개 필터`}
          </p>
        </div>
        {changesData && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>변경: <strong style={{ color: '#38bdf8' }}>{counts.total}</strong></span>
            <span>신규: <strong style={{ color: '#38bdf8' }}>{counts.new}</strong></span>
            <span>수정: <strong style={{ color: '#f8fafc' }}>{counts.modified}</strong></span>
            <span>삭제: <strong style={{ color: '#f87171' }}>{counts.deleted}</strong></span>
          </div>
        )}
      </header>
      {loading ? (
        <div className="loader-container"><div className="loader">변경 사항 분석 중...</div></div>
      ) : visibleChanges.length > 0 ? (
        <div className="sbs-container">
          <div className="sbs-header">
            <div className="sbs-header-panel left"><span className="sbs-year-badge prev">{changesData.previousYear}년</span></div>
            <div className="sbs-header-panel right"><span className="sbs-year-badge curr">{changesData.targetYear}년</span></div>
          </div>
          {pager}
          <div className="sbs-items">
            {pageItems.map((change, i) => (
              <SideBySideItem key={change.item_number} change={change} idx={i} />
            ))}
          </div>
          {pager}
        </div>
      ) : !compareYear ? (
        <div className="placeholder-text">왼쪽 사이드바에서 비교할 년도를 선택하세요.</div>
      ) : filterActive ? (
        <div className="placeholder-text">화면 A에서 선택한 문항 중 {compareYear - 1}→{compareYear}년 변경된 항목이 없습니다.</div>
      ) : changesData ? (
        <div className="placeholder-text">선택한 기간에 변경된 문항이 없습니다. (해당 연도 데이터가 아직 없을 수 있습니다)</div>
      ) : (
        <div className="placeholder-text">해당 연도 데이터를 불러올 수 없습니다.</div>
      )}
    </>
  );
}

export default CompareView;
