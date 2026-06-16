import React, { useState } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { getDisplayData, formatBlocks, formatDescription, formatScore, API_BASE } from '../utils/helpers.jsx';
import CommonItemPanel from './CommonItemPanel.jsx';

function ItemModal({ selectedItem, setSelectedItem, setItems, setHistoryItems }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(null);
  const [showCommon, setShowCommon] = useState(false); // 공통문항 일괄 패널 토글

  // Design Ref: §3 — 공통문항 일괄 저장 후 열린 문항이 적용 분야면 변경분만 머지(불변)
  const handleCommonSaved = ({ updates, areaCodes }) => {
    const areaCode = selectedItem?.about_item?.item_number?.slice(0, 2);
    if (areaCode && areaCodes.includes(areaCode)) {
      const ai = { ...selectedItem.about_item };
      if ('question' in updates) ai.question = updates.question;
      if ('description' in updates) ai.description = updates.description;
      if ('score' in updates) ai.score = updates.score;
      const merged = { ...selectedItem, about_item: ai };
      setSelectedItem(merged);
      setItems(prev => prev.map(i => i._id === merged._id ? merged : i));
      setHistoryItems(prev => prev.map(i => i._id === merged._id ? merged : i));
    }
    setShowCommon(false);
  };

  const handleEdit = () => {
    // Use getDisplayData to properly split merged question/description (2020 data)
    const display = getDisplayData(selectedItem);
    setEditData({
      question: display.question,
      description: display.description,
      score: selectedItem.about_item.score,
      item_type: selectedItem.about_item.item_type || '',
      field_specific_description: selectedItem.about_item.field_specific_description || '',
    });
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData(null);
  };

  const handleSave = async () => {
    try {
      const apiKey = import.meta.env.VITE_API_KEY;
      const headers = apiKey ? { 'x-api-key': apiKey } : {};
      const res = await axios.patch(`${API_BASE}/items/${selectedItem._id}`, {
        'about_item.question': editData.question,
        'about_item.description': editData.description,
        'about_item.field_specific_description': editData.field_specific_description,
        'about_item.score': editData.score,
        'about_item.item_type': editData.item_type,
      }, { headers });
      setSelectedItem(res.data);
      setItems(prev => prev.map(item => item._id === res.data._id ? res.data : item));
      setHistoryItems(prev => prev.map(item => item._id === res.data._id ? res.data : item));
      setIsEditing(false);
      setEditData(null);
    } catch (err) {
      console.error('Failed to save item:', err);
      alert('저장에 실패했습니다: ' + err.message);
    }
  };

  const handleClose = () => {
    // Go back in history instead of just closing
    // This keeps the history stack clean
    if (window.history.state?.modalOpen) {
      window.history.back();
    } else {
      setSelectedItem(null);
    }
    setIsEditing(false);
    setShowCommon(false);
  };

  return (
    <AnimatePresence>
      {selectedItem && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
        >
          <motion.div
            className="modal-content"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-actions-header">
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {!isEditing ? (
                  <>
                    <button
                      onClick={handleEdit}
                      className="select-input"
                      style={{ width: 'auto', padding: '0.4rem 1.2rem', color: '#38bdf8', borderColor: '#38bdf8' }}
                    >
                      수정
                    </button>
                    {/* SC-1: common_key 있을 때만 공통문항 일괄 진입점 노출 */}
                    {selectedItem.common_key && !showCommon && (
                      <button
                        onClick={() => setShowCommon(true)}
                        className="select-input"
                        style={{ width: 'auto', padding: '0.4rem 1.2rem', color: '#a78bfa', borderColor: '#a78bfa' }}
                      >
                        공통문항 일괄
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button onClick={handleSave} className="btn-save">저장</button>
                    <button onClick={handleCancel} className="btn-cancel">취소</button>
                  </>
                )}
              </div>
              <button onClick={handleClose} className="close-btn"><X /></button>
            </div>

            <div className="modal-body-content">
              {showCommon ? (
                <CommonItemPanel
                  commonKey={selectedItem.common_key}
                  onClose={() => setShowCommon(false)}
                  onSaved={handleCommonSaved}
                />
              ) : (
                <>
                  <ModalContent
                    selectedItem={selectedItem}
                    isEditing={isEditing}
                    editData={editData}
                    setEditData={setEditData}
                  />
                  <ModalMetadata
                    selectedItem={selectedItem}
                    isEditing={isEditing}
                    editData={editData}
                    setEditData={setEditData}
                  />
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ModalContent({ selectedItem, isEditing, editData, setEditData }) {
  const display = getDisplayData(selectedItem);
  const classification = selectedItem.about_item?.item_type;
  const isCore = classification === '핵심C' || classification === 'C';
  const naAvailable = selectedItem.na_available === true;
  const score = selectedItem.about_item?.score;
  const yesLabel = isCore
    ? <>(필수)</>
    : score != null
      ? <>({score}점)</>
      : null;
  // colSpan for 설명 row: label(1) + question(1) + 예(1) + 아니오(1) [+ 해당없음(1)]
  const optionColCount = naAvailable ? 3 : 2;

  return (
    <div className="review-table-container">
      <table className="review-table">
        <tbody>
          <tr>
            <td className="label-cell">문항</td>
            <td className="item-content-cell">
              {isEditing ? (
                <div className="item-main-header">
                  <select
                    className="edit-input"
                    style={{ width: 80 }}
                    value={editData.item_type}
                    onChange={e => setEditData({ ...editData, item_type: e.target.value })}
                  >
                    <option value="C">핵심C</option>
                    <option value="R">필요R</option>
                    <option value="B">기본B</option>
                    <option value="">-</option>
                  </select>
                  <span style={{ fontWeight: 600 }}>{selectedItem.about_item.item_number}</span>
                  <input
                    className="edit-input"
                    style={{ flex: 1 }}
                    value={editData.question}
                    onChange={e => setEditData({ ...editData, question: e.target.value })}
                  />
                </div>
              ) : (
                <div className="item-main-header">
                  {selectedItem.about_item.item_type && <span className="badge-core">{selectedItem.about_item.item_type}</span>}
                  <span style={{ fontWeight: 600 }}>{selectedItem.about_item.item_number}</span>
                  <span style={{ marginLeft: '4px' }}>{display.question}</span>
                </div>
              )}
            </td>
            <td className="option-cell">예{yesLabel && <><br />{yesLabel}</>}</td>
            <td className="option-cell" style={naAvailable ? {} : { borderRight: 'none' }}>아니오</td>
            {naAvailable && <td className="option-cell" style={{ borderRight: 'none' }}>해당없음</td>}
          </tr>
          <tr>
            <td className="label-cell">설명</td>
            <td className="item-content-cell" colSpan={1 + optionColCount} style={{ borderRight: 'none' }}>
              <div className="description-text">
                {isEditing ? (
                  <textarea
                    className="edit-textarea"
                    value={editData.description}
                    onChange={e => setEditData({ ...editData, description: e.target.value })}
                  />
                ) : (
                  <div className="description-content">
                    {formatBlocks(selectedItem.about_item?.blocks, display.description)}
                  </div>
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ModalMetadata({ selectedItem, isEditing, editData, setEditData }) {
  return (
    <div className="modal-metadata">
      <div><strong>대분류:</strong> {selectedItem.area}</div>
      <div><strong>중분류:</strong> {selectedItem.sub_category}</div>
      <div>
        <strong>배점:</strong>{' '}
        {isEditing ? (
          <input
            type="number"
            min="0"
            className="edit-input"
            style={{ width: 60 }}
            value={Number.isFinite(editData.score) ? editData.score : ''}
            onChange={e => {
              const v = e.target.value;
              setEditData({ ...editData, score: v === '' ? 0 : parseInt(v, 10) });
            }}
          />
        ) : (
          <span>{formatScore(selectedItem.about_item.score, selectedItem.about_item.item_type)}</span>
        )}
      </div>
      {'na_available' in selectedItem && (
        <div><strong>해당없음:</strong> {selectedItem.na_available ? '적용 가능' : '해당없음 없음'}</div>
      )}
      {(selectedItem.about_item?.field_specific_description || isEditing) && (
        <div>
          <strong>분야특이 설명:</strong>
          {isEditing ? (
            <textarea
              className="edit-textarea"
              style={{ marginTop: '0.25rem', width: '100%', minHeight: '4rem', fontSize: '0.875rem' }}
              value={editData?.field_specific_description || ''}
              onChange={e => setEditData({ ...editData, field_specific_description: e.target.value })}
              placeholder="이 분야에만 적용되는 추가 설명..."
            />
          ) : (
            <div style={{ marginTop: '0.25rem', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
              {selectedItem.about_item.field_specific_description}
            </div>
          )}
        </div>
      )}
      <div><strong>출처:</strong> {selectedItem.metadata.source} ({selectedItem.metadata.year}년)</div>
    </div>
  );
}

export default ItemModal;
