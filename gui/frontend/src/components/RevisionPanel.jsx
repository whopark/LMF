import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE } from '../utils/helpers.jsx';
import { useFilterContext } from '../contexts/FilterContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

// G6: edit types restricted to approver+ (mirror of backend constants/sensitiveEditTypes).
const SENSITIVE_EDIT_TYPES = ['NEW_ITEM', 'DELETE_ALL', 'DELETE_AREA', 'ADD_AREA', 'MODIFY_CLASS'];

const STATUS_LABEL = { none: '미시작', draft: '수정중', review: '검토중', final: '최종' };
const NEXT_TRANSITIONS = { none: ['draft'], draft: ['review', 'none'], review: ['final', 'draft'], final: [] };

/**
 * 화면 B — Revision form attached to a single item.
 * Shows edit_types checkboxes, reason textarea, status transitions, last_modified info.
 */
function RevisionPanel({ item, onRevisionSaved }) {
  const { selectedUser } = useFilterContext();
  const { user, authHeader } = useAuth();
  const canSelectSensitive = user?.role === 'approver' || user?.role === 'admin';
  const [editTypes, setEditTypes] = useState([]);
  const [availableCodes, setAvailableCodes] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  const apiKey = typeof window !== 'undefined' ? window?.__ENV__?.VITE_API_KEY || import.meta.env?.VITE_API_KEY : '';

  useEffect(() => {
    axios.get(`${API_BASE}/revisions/edit-type-codes`)
      .then(res => setAvailableCodes(res.data))
      .catch(() => {});
  }, []);

  const toggleEditType = (code) => {
    setEditTypes(prev => prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]);
  };

  const handleSaveReason = async () => {
    if (!item || !reason.trim()) return;
    setSaving(true);
    try {
      const headers = { ...authHeader() };
      if (!user?.token && apiKey) headers['x-api-key'] = apiKey;
      if (selectedUser) headers['x-user'] = encodeURIComponent(selectedUser);

      await axios.patch(`${API_BASE}/items/${item._id}`, {
        'about_item.question': item.about_item.question,
        edit_types: editTypes,
        reason,
      }, { headers });

      onRevisionSaved?.();
    } catch (err) {
      console.error('Failed to save revision:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (toStatus) => {
    if (!item) return;
    setTransitioning(true);
    try {
      const headers = { ...authHeader() };
      if (!user?.token && apiKey) headers['x-api-key'] = apiKey;

      await axios.post(`${API_BASE}/revisions/transition/${item._id}`, { to: toStatus }, { headers });
      onRevisionSaved?.();
    } catch (err) {
      console.error('Failed to transition:', err.response?.data?.message || err.message);
    } finally {
      setTransitioning(false);
    }
  };

  if (!item) return null;

  const currentStatus = item.revision?.status || 'none';
  const isLocked = item.revision?.locked;
  const transitions = NEXT_TRANSITIONS[currentStatus] || [];

  return (
    <div className="revision-panel">
      <div className="revision-panel-section">
        <div className="revision-panel-label">현재 상태</div>
        <span className={`revision-status-badge status-${currentStatus}`}>
          {STATUS_LABEL[currentStatus]}
        </span>
        {isLocked && <span className="badge-locked" style={{ marginLeft: '0.5rem' }}>🔒</span>}
      </div>

      {!isLocked && availableCodes.length > 0 && (
        <div className="revision-panel-section">
          <div className="revision-panel-label">수정유형 (복수 선택)</div>
          <div className="edit-type-grid">
            {availableCodes.map(c => {
              const blocked = SENSITIVE_EDIT_TYPES.includes(c.code) && !canSelectSensitive;
              return (
                <label
                  key={c.code}
                  className="edit-type-option"
                  title={blocked ? 'approver 권한 전용 항목입니다' : undefined}
                  style={blocked ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
                >
                  <input
                    type="checkbox"
                    disabled={blocked}
                    checked={editTypes.includes(c.code)}
                    onChange={() => toggleEditType(c.code)}
                  />
                  <span>{c.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {!isLocked && (
        <div className="revision-panel-section">
          <div className="revision-panel-label">수정사유 (직접 입력)</div>
          <textarea
            className="revision-reason-input"
            placeholder="수정 사유를 입력하세요 — 연도별 추적에 그대로 표시됩니다"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
          />
          <button
            className="btn-save select-input"
            onClick={handleSaveReason}
            disabled={saving || !reason.trim()}
            style={{ marginTop: '0.5rem', width: 'auto', padding: '0.3rem 1rem' }}
          >
            {saving ? '저장 중...' : '사유 저장'}
          </button>
        </div>
      )}

      {transitions.length > 0 && (
        <div className="revision-panel-section">
          <div className="revision-panel-label">상태 전이</div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {transitions.map(t => (
              <button
                key={t}
                className="select-input"
                onClick={() => handleTransition(t)}
                disabled={transitioning}
                style={{ width: 'auto', padding: '0.3rem 0.8rem', fontSize: '0.8rem' }}
              >
                → {STATUS_LABEL[t] || t}
              </button>
            ))}
          </div>
        </div>
      )}

      {item.last_modified?.user && (
        <div className="revision-panel-meta">
          최종 수정: {item.last_modified.user}
          {item.last_modified.at && ` · ${new Date(item.last_modified.at).toLocaleDateString('ko-KR')}`}
        </div>
      )}
    </div>
  );
}

export default RevisionPanel;
