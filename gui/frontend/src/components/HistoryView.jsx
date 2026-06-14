import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getDisplayData, API_BASE } from '../utils/helpers.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import CompareView from './CompareView.jsx';
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

function TrackView({ loading, historyArea, selectedHistoryNumber, historyItems, setSelectedItem }) {
  // trackMode: 'compare' = 1:1 직전 연도 vs 최신, 'timeline' = 전체 연도 나열
  const [trackMode, setTrackMode] = useState('compare');
  const [revisionTarget, setRevisionTarget] = useState(null);
  const { authHeader } = useAuth();
  const [verbatimReason, setVerbatimReason] = useState('');

  const sortedItems = [...historyItems].sort((a, b) => b.metadata.year - a.metadata.year);
  const latest = sortedItems[0];
  const previous = sortedItems[1];

  // G-Y4: 최신 Revision.reason(verbatim) 조회 → ComparisonTable에 전달 (화면=Export 동일 소스)
  useEffect(() => {
    if (!selectedHistoryNumber) { setVerbatimReason(''); return; }
    axios.get(`${API_BASE}/revisions`, {
      params: { item_number: selectedHistoryNumber, limit: 1 },
      headers: authHeader(),
    })
      .then(res => setVerbatimReason(res.data?.revisions?.[0]?.reason || ''))
      .catch(() => setVerbatimReason(''));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHistoryNumber]);

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
            <ComparisonTable latest={latest} previous={previous} reason={verbatimReason} />
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

function ComparisonTable({ latest, previous, reason }) {
  const latestDisplay = getDisplayData(latest);
  const prevDisplay = previous ? getDisplayData(previous) : null;
  // G-Y4/G-Y5: 배점·분류 비교 데이터 (Item.about_item)
  const prevScore = previous?.about_item?.score;
  const currScore = latest.about_item?.score;
  const prevType = previous?.about_item?.item_type || '';
  const currType = latest.about_item?.item_type || '';
  const scoreText = s => (s !== null && s !== undefined ? `${s}점` : '');

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
      {/* G-Y4/G-Y5: 배점 */}
      <div className="track-compare-row" style={{ marginTop: '0.5rem' }}>
        <div className="track-compare-col prev" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>배점: {scoreText(prevScore) || '—'}</div>
        <div className="track-compare-col curr" style={{ fontSize: '0.85rem' }}>
          배점: {previous ? <DiffText oldText={scoreText(prevScore)} newText={scoreText(currScore)} /> : (scoreText(currScore) || '—')}
        </div>
      </div>
      {/* G-Y4/G-Y5: 분류 */}
      <div className="track-compare-row">
        <div className="track-compare-col prev" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>분류: {prevType || '—'}</div>
        <div className="track-compare-col curr" style={{ fontSize: '0.85rem' }}>
          분류: {previous ? <DiffText oldText={prevType} newText={currType} /> : (currType || '—')}
        </div>
      </div>
      {/* G-A1: 분야특이 설명 (SC-Y4 6필드) */}
      {(latest.about_item?.field_specific_description || previous?.about_item?.field_specific_description) && (
        <div className="track-compare-row">
          <div className="track-compare-col prev" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>분야특이: {previous?.about_item?.field_specific_description || '—'}</div>
          <div className="track-compare-col curr" style={{ fontSize: '0.85rem' }}>
            분야특이: {previous
              ? <DiffText oldText={previous.about_item?.field_specific_description || ''} newText={latest.about_item?.field_specific_description || ''} />
              : (latest.about_item?.field_specific_description || '—')}
          </div>
        </div>
      )}
      {/* G-A1: 해당없음 (SC-Y4 6필드) */}
      <div className="track-compare-row">
        <div className="track-compare-col prev" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>해당없음: {previous ? (previous.na_available ? '적용' : '없음') : '—'}</div>
        <div className="track-compare-col curr" style={{ fontSize: '0.85rem' }}>해당없음: {latest.na_available ? '적용' : '없음'}</div>
      </div>
      {/* G-Y4: verbatim 수정사유 (화면 = Export 동일 소스, SC-Y2) */}
      {reason && (
        <div className="track-compare-row" style={{ marginTop: '0.5rem' }}>
          <div className="track-compare-col prev" style={{ fontSize: '0.85rem', color: '#94a3b8' }}>수정사유</div>
          <div className="track-compare-col curr" style={{ fontSize: '0.85rem' }}>{reason}</div>
        </div>
      )}
    </div>
  );
}

export default HistoryView;
