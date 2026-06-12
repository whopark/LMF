const ExcelJS = require('exceljs');

const HEADER_STYLE = {
  font: { bold: true, color: { argb: 'FFFFFFFF' } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } },
  alignment: { horizontal: 'center', wrapText: true },
};

function autoWidth(worksheet, minWidth = 10, maxWidth = 60) {
  worksheet.columns.forEach(col => {
    let max = minWidth;
    col.eachCell({ includeEmpty: false }, cell => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, maxWidth);
  });
}

/**
 * Build an Excel workbook for checklist items.
 * @param {object[]} items - flat Item documents
 * @returns {ExcelJS.Workbook}
 */
async function buildItemsWorkbook(items) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LMF Accreditation';
  wb.created = new Date();

  const ws = wb.addWorksheet('문항 목록');

  ws.columns = [
    { header: '번호', key: 'idx', width: 6 },
    { header: '문항번호', key: 'item_number', width: 14 },
    { header: '대분류', key: 'area', width: 16 },
    { header: '중분류', key: 'sub_category', width: 20 },
    { header: '분류', key: 'classification', width: 8 },
    { header: '문항', key: 'question', width: 50 },
    { header: '설명', key: 'description', width: 50 },
    { header: '배점', key: 'score', width: 8 },
    { header: '해당없음', key: 'na_available', width: 10 },
    { header: '개정상태', key: 'status', width: 10 },
  ];

  // Apply header style
  ws.getRow(1).eachCell(cell => { Object.assign(cell, HEADER_STYLE); });
  ws.getRow(1).height = 24;

  items.forEach((item, i) => {
    ws.addRow({
      idx: i + 1,
      item_number: item.item_number || '',
      area: item.area_name || item.area_code || '',
      sub_category: item.sub_category || '',
      classification: item.classification || '',
      question: item.question || '',
      description: item.description || '',
      score: item.score != null ? item.score : '핵심',
      na_available: item.na_available ? '있음' : '없음',
      status: item.revision?.status || 'none',
    });
  });

  // Zebra striping
  ws.eachRow((row, rowNum) => {
    if (rowNum > 1 && rowNum % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });

  autoWidth(ws);
  return wb;
}

/**
 * Build an Excel workbook for revision history.
 * @param {object[]} revisions - Revision documents
 * @returns {ExcelJS.Workbook}
 */
async function buildRevisionsWorkbook(revisions) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'LMF Accreditation';
  wb.created = new Date();

  const ws = wb.addWorksheet('개정 이력');

  ws.columns = [
    { header: '문항번호', key: 'item_number', width: 14 },
    { header: '대분류', key: 'area_code', width: 8 },
    { header: '연도', key: 'year', width: 6 },
    { header: '수정자', key: 'user', width: 12 },
    { header: '수정일시', key: 'at', width: 20 },
    { header: '수정유형', key: 'edit_types', width: 20 },
    { header: '수정사유', key: 'reason', width: 40 },
    { header: '수정 전 문항', key: 'before', width: 40 },
    { header: '수정 후 문항', key: 'after', width: 40 },
    { header: '배점변경', key: 'score_changed', width: 10 },
  ];

  ws.getRow(1).eachCell(cell => { Object.assign(cell, HEADER_STYLE); });
  ws.getRow(1).height = 24;

  revisions.forEach(rev => {
    ws.addRow({
      item_number: rev.item_number || '',
      area_code: rev.area_code || '',
      year: rev.year || '',
      user: rev.user || '',
      at: rev.at ? new Date(rev.at).toLocaleString('ko-KR') : '',
      edit_types: (rev.edit_types || []).join(', '),
      reason: rev.reason || '',
      before: rev.before?.question || '',
      after: rev.after?.question || '',
      score_changed: rev.score_changed ? '예' : '아니오',
    });
  });

  autoWidth(ws);
  return wb;
}

module.exports = { buildItemsWorkbook, buildRevisionsWorkbook };
