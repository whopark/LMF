const express = require('express');
const filtersRouter = require('./filters');
const itemsRouter = require('./items');
const changesRouter = require('./changes');
const importRouter = require('./import');

const router = express.Router();

router.use('/filters', filtersRouter);
router.use('/items', itemsRouter);
router.use('/changes', changesRouter);
router.use('/import', importRouter);

module.exports = router;
