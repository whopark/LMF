// PDF export utility using pdfkit with NotoSansKR Korean font (OFL license, bundled).
// Production-safe: font is bundled in assets/fonts/NotoSansKR-Regular.ttf for Linux/Docker.
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const BUNDLED_FONT = path.join(__dirname, '../assets/fonts/NotoSansKR-Regular.ttf');

function resolveFont() {
  if (fs.existsSync(BUNDLED_FONT)) return BUNDLED_FONT;
  return null;
}

const FONT_PATH = resolveFont();
const FONT_NAME = 'Korean';

function createDoc() {
  const doc = new PDFDocument({ margin: 45, size: 'A4', autoFirstPage: true });
  if (FONT_PATH) doc.registerFont(FONT_NAME, FONT_PATH);
  return doc;
}

function korean(doc) {
  return FONT_PATH ? doc.font(FONT_NAME) : doc.font('Helvetica');
}

function pageTitle(doc, title) {
  korean(doc).fontSize(14).fillColor('#1e3a5f').text(title, { align: 'center' });
  doc.moveDown(0.4);
  doc.moveTo(45, doc.y).lineTo(550, doc.y).strokeColor('#cbd5e1').stroke();
  doc.moveDown(0.6);
  doc.fillColor('black');
}

function checkPageBreak(doc, neededHeight = 60) {
  if (doc.y > 760 - neededHeight) doc.addPage();
}

/**
 * Build a PDF for checklist items.
 * @param {object[]} items  - flat Item documents
 * @param {{ area?: string, year?: string|number }} opts
 * @returns {Promise<Buffer>}
 */
async function buildItemsPdf(items, opts = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = createDoc();
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const title = `문항 목록${opts.area ? ` — ${opts.area}` : ''}${opts.year ? ` (${opts.year}년)` : ''}`;
    pageTitle(doc, title);

    for (const item of items) {
      checkPageBreak(doc, 70);

      const num = item.item_number || '';
      const cls = item.classification || '';
      const score = item.score !== null && item.score !== undefined ? `${item.score}점` : '핵심(필수)';
      const revised = item.revision?.revised ? '  [REVISED]' : '';
      const q = item.question || '';
      const desc = item.description
        ? (item.description.length > 120 ? item.description.substring(0, 120) + '…' : item.description)
        : '';

      korean(doc).fontSize(9).fillColor('#1e3a5f')
        .text(`${num}${revised}  [${cls || '-'}] 배점: ${score}`, { indent: 0 });
      korean(doc).fontSize(8).fillColor('#111827').text(q, { indent: 16 });
      if (desc) {
        korean(doc).fontSize(7).fillColor('#6b7280').text(desc, { indent: 16 });
      }
      doc.fillColor('black').moveDown(0.4);
    }

    doc.end();
  });
}

/**
 * Build a PDF for revision history.
 * @param {object[]} revisions - Revision documents
 * @param {{ area?: string, year?: string|number }} opts
 * @returns {Promise<Buffer>}
 */
async function buildRevisionsPdf(revisions, opts = {}) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = createDoc();
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const title = `개정 이력 보고서${opts.area ? ` — ${opts.area}` : ''}${opts.year ? ` (${opts.year}년)` : ''}`;
    pageTitle(doc, title);

    for (const rev of revisions) {
      checkPageBreak(doc, 80);

      const types = (rev.edit_types || []).join(', ') || '미기재';
      const dateStr = rev.at ? new Date(rev.at).toLocaleDateString('ko-KR') : '—';

      korean(doc).fontSize(9).fillColor('#1e3a5f')
        .text(`${rev.item_number || ''}  (${rev.area_code || ''})  — ${rev.user || '미기재'}  ${dateStr}`);
      korean(doc).fontSize(8).fillColor('#374151')
        .text(`수정유형: ${types}`, { indent: 16 });
      korean(doc).fontSize(8).fillColor('#374151')
        .text(`사유: ${rev.reason || '—'}`, { indent: 16 });

      if (rev.before && rev.after) {
        const beforeQ = rev.before.question || '';
        const afterQ = rev.after.question || '';
        if (beforeQ !== afterQ) {
          korean(doc).fontSize(7).fillColor('#dc2626').text(`이전: ${beforeQ.substring(0, 80)}`, { indent: 16 });
          korean(doc).fontSize(7).fillColor('#16a34a').text(`이후: ${afterQ.substring(0, 80)}`, { indent: 16 });
        }
      }

      doc.fillColor('black').moveDown(0.5);
    }

    doc.end();
  });
}

module.exports = { buildItemsPdf, buildRevisionsPdf };
