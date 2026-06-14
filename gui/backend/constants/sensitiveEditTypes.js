// Design Ref: §7 (G6) — edit-type codes restricted to approver+ roles.
// PRD R-10: 신규문항 · 문항삭제(전체/분야) · 분야추가 · 문항분류체계 수정.
// Codes match EditTypeCode DEFAULT_CODES (edit_type_codes collection).
const { hasRole } = require('../middleware/roles');

const SENSITIVE_EDIT_TYPES = ['NEW_ITEM', 'DELETE_ALL', 'DELETE_AREA', 'ADD_AREA', 'MODIFY_CLASS'];

// Throws a 403 error if editTypes contain a sensitive code and the role is below approver.
function assertEditTypesAllowed(editTypes, role) {
  const list = Array.isArray(editTypes) ? editTypes : [];
  const blocked = list.filter(t => SENSITIVE_EDIT_TYPES.includes(t));
  if (blocked.length > 0 && !hasRole(role, 'approver')) {
    const e = new Error(`Sensitive edit types require approver role: ${blocked.join(', ')}`);
    e.status = 403;
    throw e;
  }
}

module.exports = { SENSITIVE_EDIT_TYPES, assertEditTypesAllowed };
