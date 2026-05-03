const express = require('express');
const filtersRouter = require('./filters');
const itemsRouter = require('./items');
const changesRouter = require('./changes');

const router = express.Router();

router.use('/filters', filtersRouter);
router.use('/items', itemsRouter);
router.use('/changes', changesRouter);

module.exports = router;
