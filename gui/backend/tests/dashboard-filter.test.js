import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import Item from '../models/Item.js';

const viewerToken = jwt.sign(
  { name: 'test-viewer', role: 'viewer' },
  process.env.JWT_SECRET || 'dev-secret',
  { expiresIn: '1h' }
);

const baseItem = {
  item_number: '01.010.001',
  area_code: '01',
  year: 2026,
  area_name: '검사실운영',
  sub_category: '심사범위',
  sub_category_order: 1,
  item_order: 1,
  question: '핵심 문항 질문',
  description: '설명 텍스트',
  score: null,
  classification: 'C',
  na_available: false,
};

beforeEach(async () => {
  await Item.deleteMany({});
});

describe('GET /api/items?classification=', () => {
  beforeEach(async () => {
    await Item.create([
      { ...baseItem, item_number: '01.010.001', classification: 'C', question: '핵심문항' },
      { ...baseItem, item_number: '01.010.002', classification: 'R', score: 10, question: '필요문항' },
      { ...baseItem, item_number: '01.010.003', classification: 'B', score: 5, question: '기본문항' },
    ]);
  });

  it('returns only C items when classification=C', async () => {
    const res = await request(app).get('/api/items').query({ classification: 'C' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].about_item.question).toBe('핵심문항');
  });

  it('returns only R items when classification=R', async () => {
    const res = await request(app).get('/api/items').query({ classification: 'R' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].about_item.question).toBe('필요문항');
  });

  it('returns all items when classification not specified', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
  });
});

describe('GET /api/items?revised_only=true', () => {
  beforeEach(async () => {
    await Item.create([
      {
        ...baseItem,
        item_number: '01.010.001',
        question: 'REVISED 문항',
        revision: { status: 'final', locked: true, revised: true },
      },
      {
        ...baseItem,
        item_number: '01.010.002',
        question: '일반 문항',
        revision: { status: 'none', locked: false, revised: false },
      },
    ]);
  });

  it('returns only revised items when revised_only=true', async () => {
    const res = await request(app).get('/api/items').query({ revised_only: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].about_item.question).toBe('REVISED 문항');
  });

  it('returns all items when revised_only not specified', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
  });
});

describe('GET /api/items — combined filters', () => {
  beforeEach(async () => {
    await Item.create([
      {
        ...baseItem,
        item_number: '01.010.001',
        classification: 'C',
        question: 'C형 REVISED',
        revision: { status: 'final', locked: true, revised: true },
      },
      {
        ...baseItem,
        item_number: '01.010.002',
        classification: 'C',
        question: 'C형 일반',
        revision: { status: 'none', locked: false, revised: false },
      },
      {
        ...baseItem,
        item_number: '01.010.003',
        classification: 'R',
        score: 10,
        question: 'R형 REVISED',
        revision: { status: 'final', locked: true, revised: true },
      },
    ]);
  });

  it('classification=C AND revised_only returns only C revised items', async () => {
    const res = await request(app).get('/api/items').query({ classification: 'C', revised_only: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].about_item.question).toBe('C형 REVISED');
  });
});

// ─── G5: Score filter ────────────────────────────────────────────────────
describe('GET /api/items?score_null=true (G5)', () => {
  beforeEach(async () => {
    await Item.create([
      { ...baseItem, item_number: '01.010.010', classification: 'C', score: null, question: '핵심문항A' },
      { ...baseItem, item_number: '01.010.011', classification: 'R', score: 10, question: '필요문항B' },
      { ...baseItem, item_number: '01.010.012', classification: 'B', score: 5, question: '기본문항C' },
    ]);
  });

  it('returns only null-score (핵심/필수) items when score_null=true', async () => {
    const res = await request(app).get('/api/items').query({ score_null: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
    expect(res.body.items.every(i => i.about_item.score === null || i.about_item.score === undefined)).toBe(true);
  });

  it('score_min and score_max filter numeric range', async () => {
    const res = await request(app).get('/api/items').query({ score_min: '5', score_max: '5' });
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].about_item.question).toBe('기본문항C');
  });

  it('score_min=10 returns items with score >= 10', async () => {
    const res = await request(app).get('/api/items').query({ score_min: '10' });
    expect(res.status).toBe(200);
    expect(res.body.items.every(i => i.about_item.score >= 10)).toBe(true);
  });

  it('no score filter returns all items', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(3);
  });
});

describe('GET /api/users', () => {
  it('returns user list with viewer auth', async () => {
    const res = await request(app).get('/api/users')
      .set('Authorization', `Bearer ${viewerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('role');
  });
});
