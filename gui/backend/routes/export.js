const express = require('express');
const { requireAuth } = require('../middleware/roles');
const { serverError } = require('../utils/httpError');
const { buildItemsWorkbook, buildRevisionsWorkbook } = require('../utils/exportExcel');
const { buildRevisionsDocx } = require('../utils/exportDocx');
const { buildItemsPdf, buildRevisionsPdf } = require('../utils/exportPdf');
const itemRepo = require('../repositories/itemRepo');
const revisionRepo = require('../repositories/revisionRepo');

const router = express.Router();

// All export endpoints require editor role (or higher / API key fallback)
router.use(requireAuth('editor'));

// Read paths via repository factory (mongo|pg). Item/Revision filtering + sort live in the repos.

// GET /api/export/items.xlsx — items list as Excel
router.get('/items.xlsx', async (req, res) => {
  try {
    const items = await itemRepo.listAllForExport(req.query);
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
    const revisions = await revisionRepo.listForExport(req.query);
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
    const revisions = await revisionRepo.listForExport(req.query);
    const buf = await buildRevisionsDocx(revisions, { area: req.query.area, year: req.query.year });

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
    const items = await itemRepo.listAllForExport(req.query);
    const buf = await buildItemsPdf(items, { area: req.query.area, year: req.query.year });

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
    const revisions = await revisionRepo.listForExport(req.query);
    const buf = await buildRevisionsPdf(revisions, { area: req.query.area, year: req.query.year });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="revisions.pdf"');
    res.setHeader('Content-Length', buf.length);
    res.end(buf);
  } catch (err) {
    serverError(res, err, 'GET /export/revisions.pdf');
  }
});

module.exports = router;
