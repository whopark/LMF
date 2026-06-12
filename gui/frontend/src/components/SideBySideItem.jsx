import React, { useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { API_BASE } from '../utils/helpers.jsx';
import DiffText from './DiffText.jsx';

function buildDiffLines(prev, curr) {
  const lines = [];
  if (prev?.item_type && curr?.item_type && prev.item_type !== curr.item_type)
    lines.push({ field: '문항유형', prev: prev.item_type, curr: curr.item_type });
  if (prev?.score !== undefined && curr?.score !== undefined && prev.score !== curr.score)
    lines.push({ field: '배점', prev: `${prev.score}점`, curr: `${curr.score}점` });
  if (prev?.question && curr?.question && prev.question !== curr.question)
    lines.push({ field: '질문', prev: prev.question, curr: curr.question, useDiff: true });
  if (prev?.description && curr?.description && prev.description !== curr.description) {
    lines.push({ field: '설명', prev: prev.description, curr: curr.description, useDiff: true });
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
        previous: prev, current: curr,
        changeType: change.change_type, summary: change.summary,
      });
      setReason(res.data.reason);
    } catch (err) {
      if (err.response?.data?.code === 'API_KEY_NOT_CONFIGURED') {
        setReason('⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다.');
      } else if (err.response?.status === 429) {
        setReason('⏱️ 요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
      } else {
        setReason('수정사유 생성에 실패했습니다.');
      }
    } finally {
      setReasonLoading(false);
    }
  };

  return (
    <motion.div className="sbs-item" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
      <div className="sbs-item-header">
        <span className="sbs-item-number">{change.item_number}</span>
        <span className={`sbs-badge ${badgeClass}`}>{badgeText}</span>
        <span className="sbs-area">{change.area}</span>
        <span className="sbs-summary">{change.summary}</span>
      </div>
      <div className="sbs-body">
        {isNew && (<>
          <div className="sbs-panel left empty"><div className="sbs-empty-label">해당 없음</div></div>
          <div className="sbs-panel right">
            {curr?.item_type && <div className="sbs-field"><span className="sbs-field-label">유형</span> <span className="sbs-text-added">{curr.item_type}</span></div>}
            {curr?.score != null && <div className="sbs-field"><span className="sbs-field-label">배점</span> <span className="sbs-text-added">{curr.score}점</span></div>}
            {curr?.question && <div className="sbs-question added">{curr.question}</div>}
          </div>
        </>)}
        {isDeleted && (<>
          <div className="sbs-panel left">
            {prev?.item_type && <div className="sbs-field"><span className="sbs-field-label">유형</span> <span className="sbs-text-removed">{prev.item_type}</span></div>}
            {prev?.score != null && <div className="sbs-field"><span className="sbs-field-label">배점</span> <span className="sbs-text-removed">{prev.score}점</span></div>}
            {prev?.question && <div className="sbs-question removed">{prev.question}</div>}
          </div>
          <div className="sbs-panel right empty"><div className="sbs-empty-label">삭제됨</div></div>
        </>)}
        {!isNew && !isDeleted && (<>
          <div className="sbs-panel left">
            {diffLines.map((d, i) => (
              <div key={i} className="sbs-diff-row">
                <span className="sbs-field-label">{d.field}</span>
                {d.prev ? <span className="sbs-text-removed">{d.prev}</span> : <span className="sbs-text-none">—</span>}
              </div>
            ))}
          </div>
          <div className="sbs-panel right">
            {diffLines.map((d, i) => (
              <div key={i} className="sbs-diff-row">
                <span className="sbs-field-label">{d.field}</span>
                {d.curr
                  ? d.useDiff
                    ? <DiffText oldText={d.prev || ''} newText={d.curr} />
                    : <span className="sbs-text-added">{d.curr}</span>
                  : <span className="sbs-text-none">—</span>}
              </div>
            ))}
          </div>
        </>)}
      </div>
      <div className="sbs-reason-bar">
        {reason ? (
          <div className="sbs-reason-text">{reason}</div>
        ) : (
          <button className="sbs-reason-btn" onClick={generateReason} disabled={reasonLoading}>
            {reasonLoading ? '분석 중...' : '🤖 수정사유 생성'}
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default SideBySideItem;
