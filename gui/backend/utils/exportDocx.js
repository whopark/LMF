const { Document, Paragraph, Table, TableRow, TableCell, TextRun,
  HeadingLevel, WidthType, AlignmentType, BorderStyle } = require('docx');

const THIN_BORDER = {
  style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC',
};
const CELL_BORDERS = {
  top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER,
};

function makeHeaderCell(text) {
  return new TableCell({
    children: [new Paragraph({
      children: [new TextRun({ text, bold: true, size: 18 })],
      alignment: AlignmentType.CENTER,
    })],
    shading: { fill: '2563EB', color: 'FFFFFF' },
    borders: CELL_BORDERS,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
  });
}

function makeDataCell(text) {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: String(text || ''), size: 18 })] })],
    borders: CELL_BORDERS,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
  });
}

/**
 * Build a Word document for revision history report.
 * @param {object[]} revisions - Revision documents
 * @param {{ area?: string, year?: string|number }} opts
 * @returns {Buffer} - docx file buffer
 */
async function buildRevisionsDocx(revisions, opts = {}) {
  const title = `개정 이력 보고서${opts.area ? ` — ${opts.area}` : ''}${opts.year ? ` (${opts.year}년)` : ''}`;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      makeHeaderCell('문항번호'),
      makeHeaderCell('수정자'),
      makeHeaderCell('수정일시'),
      makeHeaderCell('수정유형'),
      makeHeaderCell('수정사유'),
      makeHeaderCell('수정 전 문항'),
      makeHeaderCell('수정 후 문항'),
    ],
  });

  const dataRows = revisions.map(rev => new TableRow({
    children: [
      makeDataCell(rev.item_number),
      makeDataCell(rev.user),
      makeDataCell(rev.at ? new Date(rev.at).toLocaleDateString('ko-KR') : ''),
      makeDataCell((rev.edit_types || []).join(', ')),
      makeDataCell(rev.reason),
      makeDataCell(rev.before?.question || ''),
      makeDataCell(rev.after?.question || ''),
    ],
  }));

  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({
          text: title,
          heading: HeadingLevel.HEADING_1,
          spacing: { after: 400 },
        }),
        new Paragraph({
          children: [new TextRun({ text: `생성일: ${new Date().toLocaleDateString('ko-KR')}`, size: 18, color: '666666' })],
          spacing: { after: 400 },
        }),
        revisions.length === 0
          ? new Paragraph({ text: '개정 이력이 없습니다.', spacing: { after: 200 } })
          : new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [headerRow, ...dataRows],
            }),
      ],
    }],
  });

  const { Packer } = require('docx');
  return await Packer.toBuffer(doc);
}

module.exports = { buildRevisionsDocx };
