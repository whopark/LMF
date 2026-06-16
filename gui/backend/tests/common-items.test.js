import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';
import Revision from '../models/Revision.js';

const API_KEY = process.env.API_KEY || 'test-api-key';

// Two areas sharing common_key '010.001' (01.010.001 and 90.010.001)
const area01 = {
  item_number: '01.010.001', area_code: '01', year: 2026, area_name: '검사실운영',
  sub_category: '심사범위', sub_category_order: 1, item_order: 1,
  question: '공통 질문', description: '공통 설명', score: 10,
  classification: 'R', na_available: false,
};
const area90 = {
  item_number: '90.010.001', area_code: '90', year: 2026, area_name: '분자진단검사',
  sub_category: '심사범위', sub_category_order: 1, item_order: 1,
  question: '공통 질문', description: '공통 설명', score: 10,
  classification: 'R', na_available: true, // area-specific flag differs
};

beforeEach(async () => {
  await Item.deleteMany({});
  await Revision.deleteMany({});
});

describe('GET /api/common/:key', () => {
  it('returns all items with same common_key', async () => {
    await Item.create([area01, area90]);
    const res = await request(app).get('/api/common/010.001');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.common_key).toBe('010.001');
  });

  it('returns 404 when no items exist for key', async () => {
    const res = await request(app).get('/api/common/999.999');
    expect(res.status).toBe(404);
  });

  it('includes area_code and area_name in response', async () => {
    await Item.create([area01]);
    const res = await request(app).get('/api/common/010.001');
    expect(res.body.items[0]).toHaveProperty('area_code', '01');
    expect(res.body.items[0]).toHaveProperty('area_name', '검사실운영');
  });
});

// G-1/G-2: year scoping + field_specific_description in GET response
describe('GET /api/common/:key — year scoping + field_specific', () => {
  const a01_2026 = { ...area01, description: '2026 설명', field_specific_description: '01 분야특이' };
  const a01_2025 = { ...area01, year: 2025, description: '2025 설명' };
  const a90_2026 = { ...area90, description: '2026 설명' };

  beforeEach(async () => { await Item.create([a01_2026, a01_2025, a90_2026]); });

  it('defaults to the latest year only (no per-year duplicates)', async () => {
    const res = await request(app).get('/api/common/010.001');
    expect(res.status).toBe(200);
    expect(res.body.year).toBe(2026);
    expect(res.body.items.length).toBe(2); // 01,90 @2026 — not 2025
    expect(res.body.items.every(i => i.year === 2026)).toBe(true);
  });

  it('honors ?year= filter', async () => {
    const res = await request(app).get('/api/common/010.001?year=2025');
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].year).toBe(2025);
  });

  it('includes field_specific_description (read-only display)', async () => {
    const res = await request(app).get('/api/common/010.001');
    const a01 = res.body.items.find(i => i.area_code === '01');
    expect(a01).toHaveProperty('field_specific_description', '01 분야특이');
  });
});

describe('PATCH /api/common/:key — year isolation (G-1)', () => {
  const a01_2026 = { ...area01, description: '2026 설명' };
  const a01_2025 = { ...area01, year: 2025, description: '2025 설명' };
  beforeEach(async () => { await Item.create([a01_2026, a01_2025]); });

  it('scopes the update to the given year only', async () => {
    const res = await request(app)
      .patch('/api/common/010.001')
      .set('X-API-Key', API_KEY)
      .send({ description: '신규 2026', area_codes: ['01'], year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.updated.length).toBe(1);

    const y2026 = await Item.findOne({ area_code: '01', year: 2026 }).lean();
    const y2025 = await Item.findOne({ area_code: '01', year: 2025 }).lean();
    expect(y2026.description).toBe('신규 2026');
    expect(y2025.description).toBe('2025 설명'); // past year untouched
  });
});

describe('PATCH /api/common/:key — bulk update', () => {
  beforeEach(async () => {
    await Item.create([area01, area90]);
  });

  it('updates question for all matching items', async () => {
    const res = await request(app)
      .patch('/api/common/010.001')
      .set('X-API-Key', API_KEY)
      .send({ question: '변경된 공통 질문' });
    expect(res.status).toBe(200);
    expect(res.body.updated.length).toBe(2);

    const items = await Item.find({ common_key: '010.001' }).lean();
    items.forEach(i => expect(i.question).toBe('변경된 공통 질문'));
  });

  it('area_codes filter limits which areas are updated', async () => {
    const res = await request(app)
      .patch('/api/common/010.001')
      .set('X-API-Key', API_KEY)
      .send({ question: '01 분야만 변경', area_codes: ['01'] });
    expect(res.status).toBe(200);
    expect(res.body.updated.length).toBe(1);
    expect(res.body.updated[0]).toBe('01.010.001');

    const item90 = await Item.findOne({ area_code: '90' }).lean();
    expect(item90.question).toBe('공통 질문'); // unchanged
  });

  it('does NOT modify na_available (area-specific field)', async () => {
    await request(app)
      .patch('/api/common/010.001')
      .set('X-API-Key', API_KEY)
      .send({ question: '질문 변경', na_available: false }); // attempt to change na_available

    const item90 = await Item.findOne({ area_code: '90' }).lean();
    expect(item90.na_available).toBe(true); // must be unchanged
  });

  it('creates one revision log entry per updated item', async () => {
    await request(app)
      .patch('/api/common/010.001')
      .set('X-API-Key', API_KEY)
      .set('x-user', encodeURIComponent('강소영'))
      .send({ question: '이력 테스트', edit_types: ['MODIFY_ITEM'], reason: '공통 개정' });

    const revisions = await Revision.find({ common_key: '010.001' }).lean();
    expect(revisions.length).toBe(2);
    revisions.forEach(r => {
      expect(r.user).toBe('강소영');
      expect(r.edit_types).toContain('MODIFY_ITEM');
    });
  });

  it('skips locked items and reports them', async () => {
    // Lock area01
    await Item.updateOne({ area_code: '01' }, {
      $set: { 'revision.status': 'final', 'revision.locked': true },
    });

    const res = await request(app)
      .patch('/api/common/010.001')
      .set('X-API-Key', API_KEY)
      .send({ question: '잠금 테스트' });

    expect(res.status).toBe(200);
    expect(res.body.updated.length).toBe(1); // only area90 updated
    expect(res.body.skipped_locked.length).toBe(1);
    expect(res.body.skipped_locked[0]).toBe('01.010.001');

    // Locked item question must be unchanged
    const lockedItem = await Item.findOne({ area_code: '01' }).lean();
    expect(lockedItem.question).toBe('공통 질문');
  });

  it('returns 400 when no valid update fields provided', async () => {
    const res = await request(app)
      .patch('/api/common/010.001')
      .set('X-API-Key', API_KEY)
      .send({ na_available: false }); // not an allowed bulk field
    expect(res.status).toBe(400);
  });
});
