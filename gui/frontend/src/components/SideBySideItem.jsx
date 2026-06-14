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
  // G-A1: 분야특이 설명·해당없음 행 추가 (SC-Y4 6필드 화면 완전 충족)
  if ((prev?.field_specific_description || '') !== (curr?.field_specific_description || ''))
    lines.push({ field: '분야특이설명', prev: prev?.field_specific_description, curr: curr?.field_specific_description, useDiff: true });
  if ((prev?.na_available || false) !== (curr?.na_available || false))
    lines.push({ field: '해당없음', prev: prev?.na_available ? '적용' : '없음', curr: curr?.na_available ? '적용' : '없음' });
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

  // G-Y2: official 수정사유는 verbatim Revision.reason (diff-core가 change.current.reason으로 첨부).
  const verbatimReason = curr?.reason || '';
  const [draft, setDraft] = useState('');
  const [draftLoading, setDraftLoading] = useState(false);

  // Design Ref: §6 — LLM을 '초안 제안'으로 격하. 결과는 편집 textarea(미저장)로만 흐른다.
  // 실제 저장(Revision.reason 반영)은 화면 B 편집(RevisionPanel)에서 수행한다.
  const suggestDraft = async () => {
    setDraftLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/llm/reason`, {
        previous: prev, current: curr,
        changeType: change.change_type, summary: change.summary,
      });
      setDraft(res.data.reason);
    } catch (err) {
      if (err.response?.data?.code === 'API_KEY_NOT_CONFIGURED') {
        setDraft('⚠️ ANTHROPIC_API_KEY가 설정되지 않았습니다.');
      } else if (err.response?.status === 429) {
        setDraft('⏱️ 요청이 너무 많습니다. 잠시 후 다시 시도하세요.');
      } else {
        setDraft('초안 제안에 실패했습니다.');
      }
    } finally {
      setDraftLoading(false);
    }
  };

  return (
    <motion.div className="sbs-item" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx, 12) * 0.02 }}>
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
        {/* G-Y2: verbatim 수정사유 (Revision.reason) — 화면과 Export가 동일 소스 (SC-Y2) */}
        {verbatimReason && (
          <div className="sbs-reason-text">
            <span className="sbs-field-label">수정사유</span> {verbatimReason}
          </div>
        )}
        {/* G-Y2: LLM은 '초안 제안'으로 격하 (미저장). 저장은 화면 B 편집(RevisionPanel)에서. */}
        <div className="sbs-draft">
          <button className="sbs-reason-btn" onClick={suggestDraft} disabled={draftLoading}>
            {draftLoading ? '분석 중...' : '🤖 초안 제안'}
          </button>
          {draft && (
            <>
              <textarea
                className="sbs-draft-input"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={2}
                aria-label="수정사유 초안 (미저장)"
              />
              <div className="sbs-draft-hint">초안(미저장) — 저장하려면 화면 B 편집의 수정사유 저장을 사용하세요</div>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default SideBySideItem;
