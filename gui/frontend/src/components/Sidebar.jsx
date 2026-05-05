import React from 'react';
import { HelpCircle, LayoutTemplate, History, Calendar, Map, Tag, ChevronRight, GitCompare } from 'lucide-react';
import { useFilterContext } from '../contexts/FilterContext';

function Sidebar() {
  const {
    viewMode,
    setViewMode,
    totalCount,
    resetFilters,
  } = useFilterContext();

  return (
    <aside className="sidebar">
      <div className="logo">
        <HelpCircle size={32} />
        <span>LMF Accreditation</span>
      </div>

      <div className="mode-toggle" style={{ marginBottom: '2rem' }}>
        <button
          className={`select-input ${viewMode === 'dashboard' ? 'active-mode' : ''}`}
          style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          onClick={() => setViewMode('dashboard')}
        >
          <LayoutTemplate size={18} /> 대시보드 리스트
        </button>
        <button
          className={`select-input ${viewMode === 'history' ? 'active-mode' : ''}`}
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}
          onClick={() => setViewMode('history')}
        >
          <History size={18} /> 문항 연도별 추적
        </button>
      </div>

      <div className="filter-section">
        {viewMode === 'dashboard' ? (
          <DashboardFilters />
        ) : (
          <HistoryFilters />
        )}
      </div>

      {viewMode === 'dashboard' && (
        <div className="stats-card">
          총 문항 수
          <span>{totalCount.toLocaleString()}</span>
        </div>
      )}

      <button
        className="select-input"
        style={{ marginTop: '1rem', color: '#94a3b8', borderStyle: 'dashed' }}
        onClick={resetFilters}
      >
        필터 초기화
      </button>
    </aside>
  );
}

function DashboardFilters() {
  const {
    filters,
    selectedArea,
    setSelectedArea,
    selectedYear,
    setSelectedYear,
    selectedSubCat,
    setSelectedSubCat,
    setPage,
  } = useFilterContext();

  return (
    <>
      <div className="filter-group">
        <label className="filter-label"><Map size={14} style={{ marginRight: 6 }} /> 대분류 (Area)</label>
        <select
          className="select-input"
          value={selectedArea}
          onChange={(e) => { setSelectedArea(e.target.value); setPage(1); }}
        >
          <option value="">전체 대분류</option>
          {filters.areas.map(a => (
            <option key={a.code} value={a.code}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label"><Calendar size={14} style={{ marginRight: 6 }} /> 심사 년도</label>
        <select
          className="select-input"
          value={selectedYear}
          onChange={(e) => { setSelectedYear(e.target.value); setPage(1); }}
        >
          <option value="">모든 년도</option>
          {filters.years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label"><Tag size={14} style={{ marginRight: 6 }} /> 중분류 (Category)</label>
        <select
          className="select-input"
          value={selectedSubCat}
          onChange={(e) => { setSelectedSubCat(e.target.value); setPage(1); }}
        >
          <option value="">전체 중분류</option>
          {filters.subCategories.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </>
  );
}

function HistoryFilters() {
  const {
    historySubMode,
    setHistorySubMode,
  } = useFilterContext();

  return (
    <>
      <div className="filter-group" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className={`select-input ${historySubMode === 'compare' ? 'active-mode' : ''}`}
            style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
            onClick={() => setHistorySubMode('compare')}
          >
            <GitCompare size={14} style={{ marginRight: 4 }} /> 연도별 비교
          </button>
          <button
            className={`select-input ${historySubMode === 'track' ? 'active-mode' : ''}`}
            style={{ flex: 1, fontSize: '0.75rem', padding: '0.5rem' }}
            onClick={() => setHistorySubMode('track')}
          >
            <History size={14} style={{ marginRight: 4 }} /> 문항 추적
          </button>
        </div>
      </div>

      {historySubMode === 'compare' ? (
        <CompareFilters />
      ) : (
        <TrackFilters />
      )}
    </>
  );
}

function CompareFilters() {
  const {
    filters,
    compareYear,
    setCompareYear,
    compareArea,
    setCompareArea,
    changesData,
  } = useFilterContext();

  return (
    <>
      <div className="filter-group">
        <label className="filter-label"><Calendar size={14} style={{ marginRight: 6 }} /> 비교 년도 선택</label>
        <select
          className="select-input"
          value={compareYear}
          onChange={(e) => setCompareYear(e.target.value)}
        >
          <option value="">년도 선택...</option>
          {filters.years.filter(y => y > Math.min(...filters.years)).map(y => (
            <option key={y} value={y}>{y}년 (vs {y - 1}년)</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label"><Map size={14} style={{ marginRight: 6 }} /> 대분류 필터 (선택)</label>
        <select
          className="select-input"
          value={compareArea}
          onChange={(e) => setCompareArea(e.target.value)}
        >
          <option value="">전체 분야</option>
          {filters.areas.map(a => (
            <option key={a.code} value={a.code}>{a.name}</option>
          ))}
        </select>
      </div>

      {changesData && (
        <div className="stats-card" style={{ marginTop: '1rem' }}>
          <div style={{ marginBottom: '0.5rem' }}>변경 사항 요약</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.8rem' }}>
            <span style={{ color: '#38bdf8' }}>+ 신규: {changesData.newItems}건</span>
            <span style={{ color: '#f8fafc' }}>● 수정: {changesData.modifiedItems}건</span>
            <span style={{ color: '#ef4444' }}>- 삭제: {changesData.deletedItems}건</span>
          </div>
          <span style={{ marginTop: '0.5rem' }}>총 {changesData.totalChanges}건</span>
        </div>
      )}
    </>
  );
}

function TrackFilters() {
  const {
    filters,
    historyArea,
    setHistoryArea,
    itemNumbers,
    selectedHistoryNumber,
    setSelectedHistoryNumber,
  } = useFilterContext();

  return (
    <>
      <div className="filter-group">
        <label className="filter-label"><Map size={14} style={{ marginRight: 6 }} /> 대분류 선택</label>
        <select
          className="select-input"
          value={historyArea}
          onChange={(e) => setHistoryArea(e.target.value)}
        >
          <option value="">분야 선택...</option>
          {filters.areas.map(a => (
            <option key={a.code} value={a.code}>{a.name}</option>
          ))}
        </select>
      </div>

      <div className="filter-group">
        <label className="filter-label"><ChevronRight size={14} style={{ marginRight: 6 }} /> 문항 번호 선택</label>
        <div className="item-number-list">
          {itemNumbers.length > 0 ? (
            itemNumbers.map(num => (
              <div
                key={num}
                className={`item-number-option ${selectedHistoryNumber === num ? 'selected' : ''}`}
                onClick={() => setSelectedHistoryNumber(num)}
              >
                {num}
              </div>
            ))
          ) : (
            <div style={{ padding: '1rem', color: '#64748b', fontSize: '0.8rem' }}>
              {historyArea ? '사용 가능한 문항이 없습니다.' : '분야를 먼저 선택하세요.'}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default Sidebar;
