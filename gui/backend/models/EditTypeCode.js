const mongoose = require('mongoose');

const editTypeCodeSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  active: { type: Boolean, default: true },
  order: { type: Number, default: 0 },
});

// Default codes per TODO.md §3 수정유형 list. Seeded on first GET /edit-type-codes.
// To customise: update the edit_type_codes collection directly, or swap via env.
const DEFAULT_CODES = [
  { code: 'NEW_ITEM',     label: '신규문항 추가',          order: 1 },
  { code: 'DELETE_ALL',   label: '문항삭제(전체)',          order: 2 },
  { code: 'DELETE_AREA',  label: '문항삭제(분야)',          order: 3 },
  { code: 'MODIFY_ITEM',  label: '문항 수정',              order: 4 },
  { code: 'MODIFY_DESC',  label: '설명 수정',              order: 5 },
  { code: 'ADD_DESC',     label: '설명 추가',              order: 6 },
  { code: 'DELETE_DESC',  label: '설명 삭제',              order: 7 },
  { code: 'CHANGE_SCORE', label: '배점 변경',              order: 8 },
  { code: 'CHANGE_NA',    label: '해당없음 유무 변경',       order: 9 },
  { code: 'ADD_AREA',     label: '분야추가',               order: 10 },
  { code: 'MOVE_ITEM',    label: '문항위치변경',            order: 11 },
  { code: 'MODIFY_CLASS', label: '문항분류체계 수정',        order: 12 },
  { code: 'MODIFY_GUIDE', label: '분류별 안내문 수정',       order: 13 },
];

const EditTypeCode = mongoose.models.EditTypeCode ||
  mongoose.model('EditTypeCode', editTypeCodeSchema, 'edit_type_codes');

module.exports = { EditTypeCode, DEFAULT_CODES };
