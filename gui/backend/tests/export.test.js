import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';
import Revision from '../models/Revision.js';

const API_KEY = process.env.API_KEY || 'test-api-key';

const baseItem = {
  item_number: '01.010.001', area_code: '01', year: 2026,
  area_name: '검사실운영', sub_category: '심사범위',
  sub_category_order: 1, item_order: 1,
  question: '검사실 조직도가 있는가?',
  description: '조직도에는 책임자와 담당자가 명시되어야 함',
  score: 10, classification: 'R', na_available: false,
};

beforeEach(async () => {
  await Item.deleteMany({});
  await Revision.deleteMany({});
});

// ─── GET /api/export/items.xlsx ──────────────────────────────────────────
describe('GET /api/export/items.xlsx', () => {
  beforeEach(async () => {
    await Item.create([
      { ...baseItem, item_number: '01.010.001' },
      { ...baseItem, item_number: '01.010.002', question: '인력 구성이 적절한가?' },
    ]);
  });

  it('returns 200 with xlsx content-type', async () => {
    const res = await request(app)
      .get('/api/export/items.xlsx')
      .set('X-API-Key', API_KEY)
      .query({ area: '01', year: '2026' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml|officedocument/);
  });

  it('response has non-empty body', async () => {
    const res = await request(app)
      .get('/api/export/items.xlsx')
      .set('X-API-Key', API_KEY)
      .query({ year: '2026' });

    expect(res.body).toBeTruthy();
    expect(Buffer.byteLength(res.text || '')).toBeGreaterThan(0);
  });

  it('returns 200 even when no items match filters', async () => {
    const res = await request(app)
      .get('/api/export/items.xlsx')
      .set('X-API-Key', API_KEY)
      .query({ area: '99', year: '2026' });

    expect(res.status).toBe(200);
  });
});

// ─── GET /api/export/revisions.xlsx ─────────────────────────────────────
describe('GET /api/export/revisions.xlsx', () => {
  beforeEach(async () => {
    await Revision.create([
      {
        item_number: '01.010.001', area_code: '01', year: 2026,
        user: '신경화', edit_types: ['MODIFY_ITEM'], reason: '위원회 심의',
        before: { question: '이전 질문' }, after: { question: '수정된 질문' },
        score_changed: false,
      },
    ]);
  });

  it('returns 200 with xlsx content-type', async () => {
    const res = await request(app)
      .get('/api/export/revisions.xlsx')
      .set('X-API-Key', API_KEY)
      .query({ area: '01', year: '2026' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/spreadsheetml|officedocument/);
  });
});

// ─── GET /api/export/revisions.docx ─────────────────────────────────────
describe('GET /api/export/revisions.docx', () => {
  beforeEach(async () => {
    await Revision.create([
      {
        item_number: '01.010.001', area_code: '01', year: 2026,
        user: '신경화', edit_types: ['MODIFY_ITEM'], reason: '테스트 사유',
        before: { question: '이전' }, after: { question: '이후' },
        score_changed: false,
      },
    ]);
  });

  it('returns 200 with docx content-type', async () => {
    const res = await request(app)
      .get('/api/export/revisions.docx')
      .set('X-API-Key', API_KEY)
      .query({ area: '01', year: '2026' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/wordprocessingml|officedocument|docx/);
  });

  it('response body is non-empty buffer', async () => {
    const res = await request(app)
      .get('/api/export/revisions.docx')
      .set('X-API-Key', API_KEY);

    expect(res.status).toBe(200);
    // Response should be a binary buffer (ZIP-based docx)
    const len = res.headers['content-length'];
    if (len) expect(parseInt(len)).toBeGreaterThan(0);
  });
});
