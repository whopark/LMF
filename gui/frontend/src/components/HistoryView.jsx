import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { getDisplayData, getTagClass, formatDescription, API_BASE } from '../utils/helpers.jsx';

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
        <CompareView
          loading={loading}
          changesData={changesData}
          compareYear={compareYear}
          compareArea={compareArea}
        />
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
            <div className="sbs-header-panel left">
              <span className="sbs-year-badge prev">{changesData.previousYear}년</span>
            </div>
            <div className="sbs-header-panel right">
              <span className="sbs-year-badge curr">{changesData.targetYear}년</span>
            </div>
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

function buildDiffLines(prev, curr) {
  const lines = [];

  if (prev?.item_type && curr?.item_type && prev.item_type !== curr.item_type) {
    lines.push({ field: '문항유형', prev: prev.item_type, curr: curr.item_type });
  }
  if (prev?.score !== undefined && curr?.score !== undefined && prev.score !== curr.score) {
    lines.push({ field: '배점', prev: `${prev.score}점`, curr: `${curr.score}점` });
  }
  if (prev?.question && curr?.question && prev.question !== curr.question) {
    lines.push({ field: '질문', prev: prev.question, curr: curr.question });
  }
  if (prev?.description && curr?.description && prev.description !== curr.description) {
    const prevSet = prev.description.split('\n').map(l => l.trim().replace(/^[•\-\*]\s*/, '')).filter(l => l);
    const currSet = curr.description.split('\n').map(l => l.trim().replace(/^[•\-\*]\s*/, '')).filter(l => l);

    const removed = prevSet.filter(l => l.length > 5 && !currSet.includes(l));
    const added = currSet.filter(l => l.length > 5 && !prevSet.includes(l));

    removed.forEach(l => lines.push({ field: '설명', prev: l, curr: null, type: 'removed' }));
    added.forEach(l => lines.push({ field: '설명', prev: null, curr: l, type: 'added' }));
  }
  return lines;
}

function SideBySideItem({ change, idx }) {
  const prev = change.previous;
  const curr = change.current;
  const isNew = change.change_type === 'NEW';
  const isDeleted = change.change_type === 'DELETED';

  const badgeClass = isNew ? 'new' : isDeleted ? 'deleted' : 'modified';
  const badgeText = isNew ? '신규' : isDeleted ? '삭제' : '수정';

  const diffLines = (!isNew && !isDeleted) ? buildDiffLines(prev, curr) : [];

  const [reason, setReason] = useState(null);
  const [reasonLoading, setReasonLoading] = useState(false);

  const generateReason = async () => {
    setReasonLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/llm/reason`, {
        previous: prev,
        current: curr,
        changeType: change.change_type,
        summary: change.summary,
      });
      setReason(res.data.reason);
    } catch (err) {
      setReason('수정사유 생성에 실패했습니다.');
    } finally {
      setReasonLoading(false);
    }
  };

  return (
    <motion.div
      className="sbs-item"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02 }}
    >
      <div className="sbs-item-header">
        <span className="sbs-item-number">{change.item_number}</span>
        <span className={`sbs-badge ${badgeClass}`}>{badgeText}</span>
        <span className="sbs-area">{change.area}</span>
        <span className="sbs-summary">{change.summary}</span>
      </div>

      <div className="sbs-body">
        {/* NEW item: only right panel */}
        {isNew && (
          <>
            <div className="sbs-panel left empty">
              <div className="sbs-empty-label">해당 없음</div>
            </div>
            <div className="sbs-panel right">
              {curr?.item_type && <div className="sbs-field"><span className="sbs-field-label">유형</span> <span className="sbs-text-added">{curr.item_type}</span></div>}
              {curr?.score != null && <div className="sbs-field"><span className="sbs-field-label">배점</span> <span className="sbs-text-added">{curr.score}점</span></div>}
              {curr?.question && <div className="sbs-question added">{curr.question}</div>}
              {curr?.description && <div className="sbs-desc added">{curr.description}</div>}
            </div>
          </>
        )}

        {/* DELETED item: only left panel */}
        {isDeleted && (
          <>
            <div className="sbs-panel left">
              {prev?.item_type && <div className="sbs-field"><span className="sbs-field-label">유형</span> <span className="sbs-text-removed">{prev.item_type}</span></div>}
              {prev?.score != null && <div className="sbs-field"><span className="sbs-field-label">배점</span> <span className="sbs-text-removed">{prev.score}점</span></div>}
              {prev?.question && <div className="sbs-question removed">{prev.question}</div>}
              {prev?.description && <div className="sbs-desc removed">{prev.description}</div>}
            </div>
            <div className="sbs-panel right empty">
              <div className="sbs-empty-label">삭제됨</div>
            </div>
          </>
        )}

        {/* MODIFIED item: both panels, only show diffs */}
        {!isNew && !isDeleted && (
          <>
            <div className="sbs-panel left">
              {diffLines.map((d, i) => (
                <div key={i} className="sbs-diff-row">
                  <span className="sbs-field-label">{d.field}</span>
                  {d.prev ? (
                    <span className="sbs-text-removed">{d.prev}</span>
                  ) : (
                    <span className="sbs-text-none">—</span>
                  )}
                </div>
              ))}
            </div>
            <div className="sbs-panel right">
              {diffLines.map((d, i) => (
                <div key={i} className="sbs-diff-row">
                  <span className="sbs-field-label">{d.field}</span>
                  {d.curr ? (
                    <span className="sbs-text-added">{d.curr}</span>
                  ) : (
                    <span className="sbs-text-none">—</span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="sbs-reason-bar">
        {reason ? (
          <div className="sbs-reason-text">{reason}</div>
        ) : (
          <button
            className="sbs-reason-btn"
            onClick={generateReason}
            disabled={reasonLoading}
          >
            {reasonLoading ? '분석 중...' : '🤖 수정사유 생성'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

function TrackView({ loading, historyArea, selectedHistoryNumber, historyItems, setSelectedItem }) {
  return (
    <>
      <header className="header" style={{ marginBottom: '2rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>문항 연도별 변화 추적</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            {historyArea} › {selectedHistoryNumber || '문항 번호를 선택하세요'}
          </p>
        </div>
      </header>

      {loading ? (
        <div className="loader-container"><div className="loader">데이터 로드 중...</div></div>
      ) : (
        <div className="history-timeline">
          {historyItems.map(item => {
            const display = getDisplayData(item);
            return (
              <div key={item._id} className="history-entry">
                <div className="history-year">{item.metadata.year}</div>
                <div className="review-table-container history-card" onClick={() => setSelectedItem(item)}>
                  <div className="history-card-header">
                    <span className={`badge-core ${getTagClass(item.about_item.item_type)}`}>{item.about_item.item_type || '정보'}</span>
                    <span style={{ fontWeight: 600 }}>{item.about_item.item_number}</span>
                    <span style={{ marginLeft: '1rem' }}>{display.question}</span>
                  </div>
                  <div className="history-card-body">
                    <div className="description-content">
                      {formatDescription(display.description)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!selectedHistoryNumber && <div className="placeholder-text">왼쪽 사이드바에서 문항 번호를 선택하여 연도별 변화를 확인하세요.</div>}
        </div>
      )}
    </>
  );
}

export default HistoryView;
