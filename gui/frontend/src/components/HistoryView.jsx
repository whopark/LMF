import React from 'react';
import { motion } from 'framer-motion';
import { getDisplayData, getTagClass, formatDescription } from '../utils/helpers.jsx';

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
      </header>

      {loading ? (
        <div className="loader-container"><div className="loader">변경 사항 분석 중...</div></div>
      ) : changesData && changesData.changes.length > 0 ? (
        <div className="compare-container">
          <div className="compare-header">
            <div className="compare-header-left">
              <span className="compare-year-badge before">{changesData.previousYear}년 (수정전)</span>
            </div>
            <div className="compare-header-right">
              <span className="compare-year-badge after">{changesData.targetYear}년 (수정후)</span>
            </div>
          </div>

          <div className="compare-panels">
            {changesData.changes.map((change, idx) => (
              <ChangeItem key={`${change.item_number}-${idx}`} change={change} idx={idx} />
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

function ChangeItem({ change, idx }) {
  const prev = change.previous;
  const curr = change.current;

  return (
    <motion.div
      className="compare-item"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02 }}
    >
      <div className="compare-item-header">
        <span className="item-number">문항 {change.item_number}</span>
        <span className={`change-badge ${change.change_type.toLowerCase()}`}>
          {change.change_type === 'NEW' ? '신규' : change.change_type === 'DELETED' ? '삭제' : '수정'}
        </span>
      </div>

      <div className="compare-body">
        <div className={`compare-panel left ${change.change_type === 'NEW' ? 'empty' : ''}`}>
          {prev ? (
            <>
              {prev.item_type && <div className="panel-field"><span className="field-label">문항유형:</span> {prev.item_type}</div>}
              {prev.score !== undefined && <div className="panel-field"><span className="field-label">배점:</span> {prev.score}점</div>}
              {prev.question && <div className="panel-question">{prev.question}</div>}
              {prev.description && (
                <div className="panel-desc">
                  <ul className="bullet-list">{formatDescription(prev.description)}</ul>
                </div>
              )}
            </>
          ) : (
            <div className="panel-empty">-</div>
          )}
        </div>

        <div className={`compare-panel right ${change.change_type === 'DELETED' ? 'empty' : ''}`}>
          {curr ? (
            <>
              {curr.item_type && prev && curr.item_type !== prev.item_type && (
                <div className="panel-field changed"><span className="field-label">문항유형:</span> {curr.item_type}</div>
              )}
              {curr.score !== undefined && prev && curr.score !== prev.score && (
                <div className="panel-field changed"><span className="field-label">배점:</span> {curr.score}점</div>
              )}
              {curr.question && (!prev || curr.question !== prev.question) && (
                <div className="panel-question changed">{curr.question}</div>
              )}
              {curr.description && (!prev || curr.description !== prev.description) && (
                <div className="panel-desc changed">
                  <ul className="bullet-list">{formatDescription(curr.description)}</ul>
                </div>
              )}
              {change.change_type === 'NEW' && (
                <>
                  {curr.item_type && <div className="panel-field"><span className="field-label">문항유형:</span> {curr.item_type}</div>}
                  {curr.score !== undefined && <div className="panel-field"><span className="field-label">배점:</span> {curr.score}점</div>}
                  {curr.question && <div className="panel-question">{curr.question}</div>}
                  {curr.description && (
                    <div className="panel-desc">
                      <ul className="bullet-list">{formatDescription(curr.description)}</ul>
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="panel-empty">-</div>
          )}
        </div>
      </div>

      <div className="compare-footer">
        <span className="reason-label">수정사유:</span> {change.summary}
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
                    <ul className="bullet-list">
                      {formatDescription(display.description)}
                    </ul>
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
