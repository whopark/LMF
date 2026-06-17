// SPEC-DB-001 (read cutover) · editTypeRepo Mongoose impl (GET /edit-type-codes).
// Seeds DEFAULT_CODES on first call when the collection is empty.
const { EditTypeCode, DEFAULT_CODES } = require('../../models/EditTypeCode')

async function listActive() {
  let codes = await EditTypeCode.find({ active: true }).sort({ order: 1 }).lean()
  if (codes.length === 0) {
    await EditTypeCode.insertMany(DEFAULT_CODES, { ordered: false }).catch(() => {})
    codes = DEFAULT_CODES.filter(c => c)
  }
  return codes
}

module.exports = { listActive }
