import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE } from '../utils/helpers.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

// 공통문항 일괄 보기·편집 패널 (스펙 §2). 백엔드 GET/PATCH /api/common/:key 재사용.
// Design Ref: §2 — 전 분야 표시 + shared(질문/설명/배점) 일괄 편집. Plan SC: SC-2/3/4.
const SENSITIVE_EDIT_TYPES = ['NEW_ITEM', 'DELETE_ALL', 'DELETE_AREA', 'ADD_AREA', 'MODIFY_CLASS'];
const SHARED = ['question', 'description', 'score'];

function CommonItemPanel({ commonKey, onClose, onSaved }) {
  const { user, authHeader } = useAuth();
  const canSelectSensitive = user?.role === 'approver' || user?.role === 'admin';

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availableCodes, setAvailableCodes] = useState([]);

  // 일괄 편집 폼 (대표값 prefill, 변경분만 전송)
  const [form, setForm] = useState({ question: '', description: '', score: '' });
  const [base, setBase] = useState({ question: '', description: '', score: '' });
  const [selectedAreas, setSelectedAreas] = useState(() => new Set()); // 기본 미선택 (명시 선택 강제)
  const [editTypes, setEditTypes] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    axios.get(`${API_BASE}/common/${encodeURIComponent(commonKey)}`)
      .then(res => {
        if (!alive) return;
        const list = res.data?.items || [];
        setItems(list);
        const rep = list[0] || {};
        const init = {
          question: rep.question || '',
          description: rep.description || '',
          score: (rep.score === null || rep.score === undefined) ? '' : String(rep.score),
        };
        setForm(init);
        setBase(init);
      })
      .catch(err => alive && setError(err.response?.status === 404 ? '공통문항을 찾을 수 없습니다.' : '불러오기 실패'))
      .finally(() => alive && setLoading(false));
    axios.get(`${API_BASE}/revisions/edit-type-codes`).then(r => alive && setAvailableCodes(r.data)).catch(() => {});
    return () => { alive = false; };
  }, [commonKey]);

  // 분야 간 shared 값 불일치 여부 (정규화 필요 신호)
  const divergent = useMemo(() => {
    const u = {};
    for (const f of SHARED) u[f] = new Set(items.map(i => String(i[f] ?? ''))).size > 1;
    return u;
  }, [items]);

  // 변경된 shared 필드만 추출
  const updates = useMemo(() => {
    const out = {};
    if (form.question !== base.question) out.question = form.question;
    if (form.description !== base.description) out.description = form.description;
    if (form.score !== base.score) out.score = form.score === '' ? null : Number(form.score);
    return out;
  }, [form, base]);

  const toggleArea = (code) => setSelectedAreas(prev => {
    const next = new Set(prev);
    next.has(code) ? next.delete(code) : next.add(code);
    return next;
  });
  const toggleEditType = (code) => setEditTypes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);

  const canSave = reason.trim() && selectedAreas.size > 0 && Object.keys(updates).length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true); setError('');
    try {
      await axios.patch(`${API_BASE}/common/${encodeURIComponent(commonKey)}`, {
        ...updates,
        area_codes: [...selectedAreas],
        edit_types: editTypes,
        reason,
        year: items[0]?.year, // G-1: scope to the loaded year (GET returns one year)
      }, { headers: { ...authHeader() } });
      // 상위(ItemModal)가 열린 문항을 즉시 반영하도록 변경분·적용 분야 전달
      onSaved?.({ updates, areaCodes: [...selectedAreas] });
      onClose?.();
    } catch (err) {
      const s = err.response?.status;
      setError(s === 401 || s === 403 ? '권한이 없습니다(editor 이상 필요).' : s === 400 ? (err.response?.data?.message || '허용되지 않은 필드') : '저장 실패');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="common-panel" role="dialog" aria-label="공통문항 일괄">
      <div className="common-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <strong>공통문항 일괄 — {commonKey} <span style={{ color: '#64748b', fontWeight: 400 }}>({items.length}개 분야)</span></strong>
        <button className="select-input" style={{ width: 'auto', padding: '0.2rem 0.6rem' }} onClick={onClose}>닫기</button>
      </div>

      {error && <div style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '0.5rem' }}>{error}</div>}
      {loading ? <div className="loader">불러오는 중...</div> : (
        <>
          {/* 전 분야 목록 + 적용 분야 선택(기본 미선택) */}
          <div className="common-area-list">
            {items.map(it => (
              <label key={it._id} className="common-area-row" style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.3rem 0', borderBottom: '1px solid #1e293b', fontSize: '0.85rem' }}>
                <input type="checkbox" checked={selectedAreas.has(it.area_code)} onChange={() => toggleArea(it.area_code)} />
                <span style={{ flex: 1 }}>
                  <strong>{it.area_code} {it.area_name}</strong> · {it.item_number} · {it.year}년 · 배점 {it.score ?? '—'} · 분류 {it.classification || '—'}
                  {it.field_specific_description && <div style={{ color: '#94a3b8', marginTop: 2 }}>분야특이: {it.field_specific_description}</div>}
                </span>
              </label>
            ))}
          </div>

          {/* shared 일괄 편집 (변경분만 전송) */}
          <div className="common-edit-form" style={{ marginTop: '0.75rem' }}>
            <div className="revision-panel-label">질문 {divergent.question && <span title="분야 간 값 불일치">⚠️</span>}</div>
            <textarea className="revision-reason-input" rows={2} value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} />
            <div className="revision-panel-label" style={{ marginTop: '0.4rem' }}>설명 {divergent.description && <span title="분야 간 값 불일치">⚠️</span>}</div>
            <textarea className="revision-reason-input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            <div className="revision-panel-label" style={{ marginTop: '0.4rem' }}>배점 {divergent.score && <span title="분야 간 값 불일치">⚠️</span>}</div>
            <input className="select-input" style={{ width: '120px' }} value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} placeholder="비우면 핵심(필수)" />
          </div>

          {availableCodes.length > 0 && (
            <div style={{ marginTop: '0.75rem' }}>
              <div className="revision-panel-label">수정유형 (복수 선택)</div>
              <div className="edit-type-grid">
                {availableCodes.map(c => {
                  const blocked = SENSITIVE_EDIT_TYPES.includes(c.code) && !canSelectSensitive;
                  return (
                    <label key={c.code} className="edit-type-option" style={blocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                      <input type="checkbox" disabled={blocked} checked={editTypes.includes(c.code)} onChange={() => toggleEditType(c.code)} />
                      <span>{c.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginTop: '0.75rem' }}>
            <div className="revision-panel-label">수정사유 (직접 입력, 필수)</div>
            <textarea className="revision-reason-input" rows={2} value={reason} onChange={e => setReason(e.target.value)} placeholder="일괄 변경 사유" />
          </div>

          <button className="btn-save select-input" style={{ marginTop: '0.6rem', width: 'auto', padding: '0.4rem 1rem' }} disabled={!canSave} onClick={handleSave}>
            {saving ? '저장 중...' : `선택 ${selectedAreas.size}개 분야 일괄 저장`}
          </button>
          {Object.keys(updates).length === 0 && <span style={{ color: '#64748b', fontSize: '0.8rem', marginLeft: '0.5rem' }}>변경된 필드 없음</span>}
        </>
      )}
    </div>
  );
}

export default CommonItemPanel;
