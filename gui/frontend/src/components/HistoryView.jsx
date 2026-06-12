import React, { useState } from 'react';
import { getDisplayData } from '../utils/helpers.jsx';
import SideBySideItem from './SideBySideItem.jsx';
import DiffText from './DiffText.jsx';
import RevisionPanel from './RevisionPanel.jsx';

function HistoryView({
  historySubMode,
  loading,
  changesData,
  compareYear,
  compareArea,
  historyArea,
  selectedHistoryNumber,
  historyItems,
  setSelectedItem
}) {
  return (
    <section className="history-view">
      {historySubMode === 'compare' ? (
        <CompareView loading={loading} changesData={changesData} compareYear={compareYear} compareArea={compareArea} />
      ) : (
        <TrackView
          loading={loading}
          historyArea={historyArea}
          selectedHistoryNumber={selectedHistoryNumber}
          historyItems={historyItems}
          setSelectedItem={setSelectedItem}
        />
      )}
    </section>
  );
}

function CompareView({ loading, changesData, compareYear, compareArea }) {
  return (
    <>
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>연도별 변경 사항 비교</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {compareYear ? `${compareYear - 1}년 → ${compareYear}년 변경 내역` : '비교할 년도를 선택하세요'}
            {compareArea && ` (${compareArea})`}
          </p>
        </div>
        {changesData && (
          <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: '#94a3b8' }}>
            <span>변경: <strong style={{ color: '#38bdf8' }}>{changesData.totalChanges}</strong></span>
            <span>신규: <strong style={{ color: '#38bdf8' }}>{changesData.newItems}</strong></span>
            <span>수정: <strong style={{ color: '#f8fafc' }}>{changesData.modifiedItems}</strong></span>
            <span>삭제: <strong style={{ color: '#f87171' }}>{changesData.deletedItems}</strong></span>
          </div>
        )}
      </header>
      {loading ? (
        <div className="loader-container"><div className="loader">변경 사항 분석 중...</div></div>
      ) : changesData && changesData.changes.length > 0 ? (
        <div className="sbs-container">
          <div className="sbs-header">
            <div className="sbs-header-panel left"><span className="sbs-year-badge prev">{changesData.previousYear}년</span></div>
            <div className="sbs-header-panel right"><span className="sbs-year-badge curr">{changesData.targetYear}년</span></div>
          </div>
          <div className="sbs-items">
            {changesData.changes.map((change, idx) => (
              <SideBySideItem key={`${change.item_number}-${idx}`} change={change} idx={idx} />
            ))}
          </div>
        </div>
      ) : compareYear ? (
        <div className="placeholder-text">선택한 기간에 변경된 문항이 없습니다.</div>
      ) : (
        <div className="placeholder-text">왼쪽 사이드바에서 비교할 년도를 선택하세요.</div>
      )}
    </>
  );
}

function TrackView({ loading, historyArea, selectedHistoryNumber, historyItems, setSelectedItem }) {
  // trackMode: 'compare' = 1:1 직전 연도 vs 최신, 'timeline' = 전체 연도 나열
  const [trackMode, setTrackMode] = useState('compare');
  const [revisionTarget, setRevisionTarget] = useState(null);

  const sortedItems = [...historyItems].sort((a, b) => b.metadata.year - a.metadata.year);
  const latest = sortedItems[0];
  const previous = sortedItems[1];

  return (
    <>
      <header className="header" style={{ marginBottom: '1.5rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>문항 연도별 변화 추적</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {historyArea} › {selectedHistoryNumber || '문항 번호를 선택하세요'}
          </p>
        </div>
        {historyItems.length > 0 && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className={`select-input ${trackMode === 'compare' ? 'active-mode' : ''}`}
              style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
              onClick={() => setTrackMode('compare')}>1:1 비교</button>
            <button className={`select-input ${trackMode === 'timeline' ? 'active-mode' : ''}`}
              style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
              onClick={() => setTrackMode('timeline')}>5년 이력</button>
          </div>
        )}
      </header>

      {loading ? (
        <div className="loader-container"><div className="loader">데이터 로드 중...</div></div>
      ) : !selectedHistoryNumber ? (
        <div className="placeholder-text">왼쪽 사이드바에서 문항 번호를 선택하여 연도별 변화를 확인하세요.</div>
      ) : trackMode === 'compare' && latest ? (
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          <div style={{ flex: 1 }}>
            <ComparisonTable latest={latest} previous={previous} />
          </div>
          {latest && (
            <div style={{ width: '280px', flexShrink: 0 }}>
              <RevisionPanel item={revisionTarget || latest} onRevisionSaved={() => setRevisionTarget(null)} />
            </div>
          )}
        </div>
      ) : (
        <div className="history-timeline">
          {sortedItems.map(item => {
            const display = getDisplayData(item);
            return (
              <div key={item._id} className="history-entry">
                <div className="history-year">{item.metadata.year}</div>
                <div className="review-table-container history-card" onClick={() => { setSelectedItem(item); setRevisionTarget(item); }}>
                  <div className="history-card-header">
                    <span style={{ fontWeight: 600 }}>{item.about_item.item_number}</span>
                    <span style={{ marginLeft: '1rem' }}>{display.question}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ComparisonTable({ latest, previous }) {
  const latestDisplay = getDisplayData(latest);
  const prevDisplay = previous ? getDisplayData(previous) : null;

  return (
    <div className="track-comparison-table">
      <div className="track-compare-header">
        <div className="track-compare-col prev">{previous ? `${previous.metadata.year}년 (이전)` : '이전 연도 없음'}</div>
        <div className="track-compare-col curr">{latest.metadata.year}년 (최신)</div>
      </div>
      <div className="track-compare-row">
        <div className="track-compare-col prev">{prevDisplay?.question || '—'}</div>
        <div className="track-compare-col curr">
          {prevDisplay
            ? <DiffText oldText={prevDisplay.question} newText={latestDisplay.question} />
            : latestDisplay.question}
        </div>
      </div>
      {(latestDisplay.description || prevDisplay?.description) && (
        <div className="track-compare-row" style={{ marginTop: '0.5rem' }}>
          <div className="track-compare-col prev" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            {prevDisplay?.description || '—'}
          </div>
          <div className="track-compare-col curr" style={{ fontSize: '0.85rem' }}>
            {prevDisplay
              ? <DiffText oldText={prevDisplay.description} newText={latestDisplay.description} />
              : latestDisplay.description}
          </div>
        </div>
      )}
    </div>
  );
}

export default HistoryView;
