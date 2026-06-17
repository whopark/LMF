// SPEC-DB-001 Phase 8 · PostgreSQL engine integration tests (T8.1/T8.2).
// The legacy 21 suites cover the Mongo path (MongoMemoryReplSet). This suite exercises the
// DB_ENGINE=pg cutover (read repos + write services) against a real, isolated PostgreSQL
// database created in the running Docker `lmf-pg` container. pg-mem is avoided (no generated
// columns / tsvector / pg_trgm — plan T8.1). When PostgreSQL is unreachable (e.g. CI without a
// PG service, or local without `docker start lmf-pg`) the suite SKIPS instead of failing.
const knexLib = require('knex')

const HOST = process.env.PGTEST_HOST || '127.0.0.1'
const PORT = process.env.PGTEST_PORT || '5435'
const USER = process.env.PGTEST_USER || 'postgres'
const PW = process.env.PGTEST_PW || 'password'
const TEST_DB = 'lab_accreditation_test'
const ADMIN_URL = `postgresql://${USER}:${PW}@${HOST}:${PORT}/postgres`
const TEST_URL = `postgresql://${USER}:${PW}@${HOST}:${PORT}/${TEST_DB}`

const ORIG = { DB_ENGINE: process.env.DB_ENGINE, PG_URL: process.env.PG_URL }

let k
let scId
let pgUp = false
let filterRepo, itemRepo, commonRepo, services, closeKnex

async function seedReference() {
  await k('area').insert([
    { area_code: '01', name: '검사실운영' },
    { area_code: '07', name: '종합검증' },
  ])
  await k('classification').insert([
    { code: 'C', name: '핵심' }, { code: 'R', name: '필요' }, { code: 'B', name: '기본' },
  ])
  const rows = await k('sub_category').insert({ name: '심사범위', display_order: 1 }).returning('id')
  return rows[0].id
}

async function seedData() {
  await k('item_content').insert([
    { common_key: '010.001', year: 2026, sub_category_id: scId, question: '공통 질문', description: '공통 설명' },
    { common_key: '010.001', year: 2025, sub_category_id: scId, question: '작년 질문', description: '작년 설명' },
  ])
  await k('checklist_item').insert([
    { area_code: '01', common_key: '010.001', year: 2026, item_number: '01.010.001', classification: 'B', score: 5 },
    { area_code: '07', common_key: '010.001', year: 2026, item_number: '07.010.001', classification: 'B', score: 5 },
    { area_code: '01', common_key: '010.001', year: 2025, item_number: '01.010.001', classification: 'B', score: 5 },
  ])
}

beforeAll(async () => {
  try {
    const admin = knexLib({ client: 'pg', connection: ADMIN_URL, acquireConnectionTimeout: 5000 })
    await admin.raw(`DROP DATABASE IF EXISTS ${TEST_DB}`)
    await admin.raw(`CREATE DATABASE ${TEST_DB}`)
    await admin.destroy()

    // Point the app's engine + connection at the test DB BEFORE requiring repos (knexfile reads
    // PG_URL via dotenv, which does not override an already-set env var).
    process.env.PG_URL = TEST_URL
    process.env.DB_ENGINE = 'pg'
    ;({ closeKnex } = require('../config/db'))
    k = require('../config/db').knex()
    await k.migrate.latest()
    scId = await seedReference()

    filterRepo = require('../repositories/filterRepo')
    itemRepo = require('../repositories/itemRepo')
    commonRepo = require('../repositories/commonRepo')
    services = require('../services/revisionTxn')
    pgUp = true
  } catch (e) {
    console.warn('[pg-engine] PostgreSQL unavailable — skipping suite:', e.message)
  }
}, 60000)

beforeEach(async () => {
  if (!pgUp) return
  await k.raw('TRUNCATE item_revision, audit_log, checklist_item, item_content RESTART IDENTITY CASCADE')
  await seedData()
})

afterAll(async () => {
  if (closeKnex) await closeKnex()
  // Restore env so later (mongo-path) suites in the same worker are unaffected.
  if (ORIG.DB_ENGINE === undefined) delete process.env.DB_ENGINE
  else process.env.DB_ENGINE = ORIG.DB_ENGINE
  if (ORIG.PG_URL === undefined) delete process.env.PG_URL
  else process.env.PG_URL = ORIG.PG_URL
})

describe('SPEC-DB-001 Phase 8 · PG engine integration', () => {
  it('filterRepo.getFilters returns years (desc) and areas collapsed by name', async (ctx) => {
    if (!pgUp) return ctx.skip()
    const f = await filterRepo.getFilters()
    expect(f.years).toEqual([2026, 2025])
    expect(f.areas.length).toBe(2)
    expect(f.subCategories).toContain('심사범위')
  })

  it('itemRepo.listItems + getByNumber (normalized de-projection)', async (ctx) => {
    if (!pgUp) return ctx.skip()
    const { items, total } = await itemRepo.listItems({ year: '2026' }, { skip: 0, limit: 10 })
    expect(total).toBe(2)
    expect(items[0].question).toBe('공통 질문') // from shared item_content
    const hist = await itemRepo.getByNumber('01.010.001')
    expect(hist.map(h => h.year)).toEqual([2026, 2025]) // year desc
  })

  it('commonRepo.getCommon returns all areas sharing the common_key (G-1 latest year)', async (ctx) => {
    if (!pgUp) return ctx.skip()
    const c = await commonRepo.getCommon('010.001')
    expect(c.year).toBe(2026)
    expect(c.items.length).toBe(2)
    expect(c.items.map(i => i.area_code).sort()).toEqual(['01', '07'])
  })

  it('applyItemEdit writes a per-area override + revision atomically (none→draft)', async (ctx) => {
    if (!pgUp) return ctx.skip()
    const r = await services.applyItemEdit({
      id: '01.01.010.001.2026', updates: { description: '단일편집' },
      editTypes: ['MODIFY_DESC'], rawReason: 'r', user: 'u', role: 'editor', ip: '::1',
    })
    expect(r.updated.description).toBe('단일편집')
    expect(r.updated.revision.status).toBe('draft')
    const revs = await k('item_revision').where({ item_number: '01.010.001', year: 2026 })
    expect(revs.length).toBe(1)
    // sibling area unaffected (shared item_content untouched)
    const sib = await itemRepo.getByNumber('07.010.001')
    expect(sib[0].description).toBe('공통 설명')
  })

  it('applyCommonEdit propagates question via the shared item_content row (AC-2)', async (ctx) => {
    if (!pgUp) return ctx.skip()
    const r = await services.applyCommonEdit({
      key: '010.001', year: 2026, updates: { question: '전파됨' },
      editTypes: ['MODIFY_ITEM'], rawReason: 'r', user: 'u', role: 'editor',
    })
    expect(r.updated.length).toBe(2)
    const content = await k('item_content').where({ common_key: '010.001', year: 2026 })
    expect(content.length).toBe(1)
    expect(content[0].question).toBe('전파됨')
    const both = await commonRepo.getCommon('010.001', '2026')
    expect(both.items.every(i => i.question === '전파됨')).toBe(true)
  })

  it('lock policy: locked target blocks common edit (409) unless admin override (REQ-10/AC-9)', async (ctx) => {
    if (!pgUp) return ctx.skip()
    await k('checklist_item').where({ area_code: '07', item_number: '07.010.001', year: 2026 }).update({ locked: true })
    await expect(services.applyCommonEdit({
      key: '010.001', year: 2026, updates: { question: 'X' }, user: 'u', role: 'editor',
    })).rejects.toMatchObject({ status: 409, blocked_locked: ['07.010.001'] })

    const ov = await services.applyCommonEdit({
      key: '010.001', year: 2026, updates: { question: 'X' }, user: 'u', role: 'admin', adminOverride: true,
    })
    expect(ov.updated).toEqual(['01.010.001'])
    expect(ov.skipped_locked).toEqual(['07.010.001'])
  })

  it('transitionItem advances the workflow with an atomic guard', async (ctx) => {
    if (!pgUp) return ctx.skip()
    const r = await services.transitionItem({ id: '01.01.010.001.2026', to: 'draft', role: 'editor' })
    expect(r.revision.status).toBe('draft')
    // editor cannot finalize — role gate (403) fires before the invalid-transition check (400)
    await expect(services.transitionItem({ id: '01.01.010.001.2026', to: 'final', role: 'editor' }))
      .rejects.toMatchObject({ status: 403 })
  })
})
