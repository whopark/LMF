// GET /api/filters — distinct years, areas, sub_categories (engine via filterRepo factory).
// SPEC-DB-001 Phase 4: route delegates to repository (mongo|pg by DB_ENGINE).
const { serverError } = require('../utils/httpError')
const express = require('express')
const filterRepo = require('../repositories/filterRepo')

const router = express.Router()

// GET /api/filters — return distinct years, areas, and sub_categories
router.get('/', async (req, res) => {
  try {
    res.json(await filterRepo.getFilters())
  } catch (err) {
    serverError(res, err, 'filters.js')
  }
})

// GET /api/filters/item-numbers — distinct item numbers, optionally by area
router.get('/item-numbers', async (req, res) => {
  try {
    res.json(await filterRepo.getItemNumbers(req.query.area))
  } catch (err) {
    serverError(res, err, 'filters.js')
  }
})

module.exports = router
