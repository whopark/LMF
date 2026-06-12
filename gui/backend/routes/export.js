const express = require('express');
const Item = require('../models/Item');
const Revision = require('../models/Revision');
const { requireApiKey } = require('../middleware/auth');
const { buildItemsWorkbook, buildRevisionsWorkbook } = require('../utils/exportExcel');
const { buildRevisionsDocx } = require('../utils/exportDocx');

const router = express.Router();

// All export endpoints require API key
router.use(requireApiKey);

function buildItemQuery(query) {
  const q = {};
  if (query.area) q.area_code = query.area;
  if (query.year) q.year = parseInt(query.year);
  if (query.sub_category) q.sub_category = query.sub_category;
  if (query.classification) q.classification = query.classification;
  if (query.revised_only === 'true') q['revision.revised'] = true;
  return q;
}

function buildRevisionQuery(query) {
  const q = {};
  if (query.area) q.area_code = query.area;
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
    console.error('[export/items.xlsx]', err);
    res.status(500).json({ error: err.message });
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
    console.error('[export/revisions.xlsx]', err);
    res.status(500).json({ error: err.message });
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
    console.error('[export/revisions.docx]', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
