// Build a Mongo `area_code` clause from an `area` query param.
// The param may be a single code ("01") or a comma-joined group of codes
// ("30,31,32,33,34,35,36") that share one 분야 name (e.g. 임상미생물 spans 30~36,
// 수혈의학 spans 40/43/46). The dashboard 대분류 dropdown shows each name once and
// sends the whole code group, so selecting it filters every constituent area_code.
function areaCodeClause(area) {
  if (area === undefined || area === null || area === '') return undefined;
  const codes = String(area).split(',').map(s => s.trim()).filter(Boolean);
  if (codes.length === 0) return undefined;
  return codes.length > 1 ? { $in: codes } : codes[0];
}

module.exports = { areaCodeClause };
