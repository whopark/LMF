const express = require('express');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');
const { buildItemsWorkbook, buildRevisionsWorkbook } = require('../utils/exportExcel');
const { buildRevisionsDocx } = require('../utils/exportDocx');
const { buildItemsPdf, buildRevisionsPdf } = require('../utils/exportPdf');
const { areaCodeClause } = require('../utils/areaFilter');

const router = express.Router();

// All export endpoints require editor role (or higher / API key fallback)
router.use(requireAuth('editor'));

function buildItemQuery(query) {
  const q = {};
  const areaClause = areaCodeClause(query.area);
  if (areaClause !== undefined) q.area_code = areaClause;
  if (query.year) q.year = parseInt(query.year);
  if (query.sub_category) q.sub_category = String(query.sub_category);
  if (query.classification) q.classification = String(query.classification);
  if (query.revised_only === 'true') q['revision.revised'] = true;
  return q;
}

function buildRevisionQuery(query) {
  const q = {};
  const areaClause = areaCodeClause(query.area);
  if (areaClause !== undefined) q.area_code = areaClause;
  if (query.year) q.year = parseInt(query.year);
  if (query.score_changed === 'true') q.score_changed = true;
  return q;
}

// GET /api/export/items.xlsx — items list as Excel
router.get('/items.xlsx', async (req, res) => {
  try {
    const items = await Item.find(buildItemQuery(req.query))
      .sort({ area_code: 1, sub_category_order: 1, item_order: 1 })
      .lean();

    const wb = await buildItemsWorkbook(items);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="items.xlsx"');

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    serverError(res, err, 'GET /export/items.xlsx');
  }
});

// GET /api/export/revisions.xlsx — revision history as Excel
router.get('/revisions.xlsx', async (req, res) => {
  try {
    const revisions = await Revision.find(buildRevisionQuery(req.query))
      .sort({ at: -1 })
      .lean();

    const wb = await buildRevisionsWorkbook(revisions);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="revisions.xlsx"');

    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    serverError(res, err, 'GET /export/revisions.xlsx');
  }
});

// GET /api/export/revisions.docx — revision report as Word document
router.get('/revisions.docx', async (req, res) => {
  try {
    const revisions = await Revision.find(buildRevisionQuery(req.query))
      .sort({ at: -1 })
      .lean();

    const buf = await buildRevisionsDocx(revisions, {
      area: req.query.area,
      year: req.query.year,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', 'attachment; filename="revisions.docx"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    serverError(res, err, 'GET /export/revisions.docx');
  }
});

// GET /api/export/items.pdf — items list as PDF (Korean font)
router.get('/items.pdf', async (req, res) => {
  try {
    const items = await Item.find(buildItemQuery(req.query))
      .sort({ area_code: 1, sub_category_order: 1, item_order: 1 })
      .lean();

    const buf = await buildItemsPdf(items, {
      area: req.query.area,
      year: req.query.year,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="items.pdf"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    serverError(res, err, 'GET /export/items.pdf');
  }
});

// GET /api/export/revisions.pdf — revision history as PDF
router.get('/revisions.pdf', async (req, res) => {
  try {
    const revisions = await Revision.find(buildRevisionQuery(req.query))
      .sort({ at: -1 })
      .lean();

    const buf = await buildRevisionsPdf(revisions, {
      area: req.query.area,
      year: req.query.year,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="revisions.pdf"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    serverError(res, err, 'GET /export/revisions.pdf');
  }
});

module.exports = router;
