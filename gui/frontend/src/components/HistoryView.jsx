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

  // Build list of specific changes for inline display
  const buildChangeLines = () => {
    const lines = [];

    // Type change
    if (prev?.item_type && curr?.item_type && prev.item_type !== curr.item_type) {
      lines.push({
        before: `문항유형: ${prev.item_type}`,
        after: `문항유형: ${curr.item_type}`,
        note: curr.description && prev.description !== curr.description
          ? `(설명에 관련 세부 조치사항 내용이 추가됨)` : ''
      });
    }

    // Score change
    if (prev?.score !== undefined && curr?.score !== undefined && prev.score !== curr.score) {
      lines.push({
        before: `배점: ${prev.score}점`,
        after: `배점: ${curr.score}점`
      });
    }

    // Question change
    if (prev?.question && curr?.question && prev.question !== curr.question) {
      lines.push({
        before: prev.question,
        after: curr.question
      });
    }

    // Description change - find specific line differences
    if (prev?.description && curr?.description && prev.description !== curr.description) {
      const prevLines = prev.description.split('\n').map(l => l.trim()).filter(l => l);
      const currLines = curr.description.split('\n').map(l => l.trim()).filter(l => l);

      // Find removed lines
      prevLines.forEach(line => {
        const cleanLine = line.replace(/^[•\-\*]\s*/, '');
        const existsInCurr = currLines.some(cl => cl.replace(/^[•\-\*]\s*/, '') === cleanLine);
        if (!existsInCurr && cleanLine.length > 10) {
          lines.push({
            before: cleanLine,
            after: '(해당 지문 삭제)',
            isDescChange: true
          });
        }
      });

      // Find added lines
      currLines.forEach(line => {
        const cleanLine = line.replace(/^[•\-\*]\s*/, '');
        const existsInPrev = prevLines.some(pl => pl.replace(/^[•\-\*]\s*/, '') === cleanLine);
        if (!existsInPrev && cleanLine.length > 10) {
          lines.push({
            before: '(해당 지문 없음)',
            after: cleanLine,
            isDescChange: true
          });
        }
      });

      // Find modified lines (similar but not exact)
      prevLines.forEach(prevLine => {
        const cleanPrevLine = prevLine.replace(/^[•\-\*]\s*/, '');
        currLines.forEach(currLine => {
          const cleanCurrLine = currLine.replace(/^[•\-\*]\s*/, '');
          // Check if lines are similar (share significant words) but not identical
          if (cleanPrevLine !== cleanCurrLine && cleanPrevLine.length > 10 && cleanCurrLine.length > 10) {
            const prevWords = cleanPrevLine.split(/\s+/).filter(w => w.length > 2);
            const currWords = cleanCurrLine.split(/\s+/).filter(w => w.length > 2);
            const commonWords = prevWords.filter(w => currWords.includes(w));
            const similarity = commonWords.length / Math.max(prevWords.length, currWords.length);

            if (similarity > 0.5 && similarity < 1) {
              // Check if not already added
              const alreadyAdded = lines.some(l =>
                l.before === cleanPrevLine || l.after === cleanCurrLine
              );
              if (!alreadyAdded) {
                lines.push({
                  before: cleanPrevLine,
                  after: cleanCurrLine,
                  isDescChange: true
                });
              }
            }
          }
        });
      });
    }

    // If no specific changes detected, show general change
    if (lines.length === 0) {
      if (change.change_type === 'NEW') {
        lines.push({
          before: '(신규 문항)',
          after: curr?.question || '새 문항 추가됨',
          isNew: true
        });
      } else if (change.change_type === 'DELETED') {
        lines.push({
          before: prev?.question || '삭제된 문항',
          after: '(문항 삭제됨)',
          isDeleted: true
        });
      }
    }

    return lines;
  };

  const changeLines = buildChangeLines();

  return (
    <motion.div
      className="change-item-doc"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.02 }}
    >
      <div className="change-item-doc-header">
        <strong>문항 {change.item_number}</strong>
      </div>

      <div className="change-item-doc-body">
        {changeLines.map((line, i) => (
          <div key={i} className="change-line-doc">
            <span className="tag-before-doc">|수정전|</span>
            <span className="change-text-before">{line.before}</span>
            <span className="arrow-doc">→</span>
            <span className="tag-after-doc">|수정후|</span>
            <span className="change-text-after">{line.after}</span>
            {line.note && <span className="change-note">{line.note}</span>}
          </div>
        ))}
      </div>

      <div className="change-divider-doc">---</div>

      <div className="change-reason-doc">
        <span className="tag-reason">|수정사유: {change.summary}|</span>
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
