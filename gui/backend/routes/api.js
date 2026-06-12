const express = require('express');
const filtersRouter = require('./filters');
const itemsRouter = require('./items');
const changesRouter = require('./changes');
const importRouter = require('./import');
const usersRouter = require('./users');
const revisionsRouter = require('./revisions');
const commonRouter = require('./common');

const router = express.Router();

router.use('/filters', filtersRouter);
router.use('/items', itemsRouter);
router.use('/changes', changesRouter);
router.use('/import', importRouter);
router.use('/users', usersRouter);
router.use('/revisions', revisionsRouter);
router.use('/common', commonRouter);

module.exports = router;
