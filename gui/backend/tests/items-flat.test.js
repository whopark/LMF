import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';

const VALID_API_KEY = process.env.API_KEY || 'test-api-key';

const baseItem = {
  item_number: '01.010.090',
  area_code: '01',
  year: 2024,
  area_name: '검사실운영',
  sub_category: '1.1 조직',
  sub_category_order: 1,
  item_order: 1,
  question: '검사실 조직도가 있는가?',
  description: '조직도에는 책임자와 담당자가 명시되어야 함',
  score: 10,
  classification: 'R',
  na_available: false,
};

describe('PATCH /api/items/:id — flat model bug regression', () => {
  it('PATCH update is reflected in subsequent GET (main regression)', async () => {
    const item = await Item.create({ ...baseItem });

    const patchRes = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', VALID_API_KEY)
      .send({ 'about_item.question': '수정된 질문입니다' });

    expect(patchRes.status).toBe(200);

    const getRes = await request(app)
      .get('/api/items')
      .query({ search: '수정된 질문입니다' });

    expect(getRes.status).toBe(200);
    expect(getRes.body.items.length).toBe(1);
    expect(getRes.body.items[0].about_item.question).toBe('수정된 질문입니다');
  });

  it('PATCH score update is reflected in GET', async () => {
    const item = await Item.create({ ...baseItem });

    await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', VALID_API_KEY)
      .send({ 'about_item.score': 20 });

    const getRes = await request(app)
      .get('/api/items')
      .query({ area: '01' });

    expect(getRes.status).toBe(200);
    expect(getRes.body.items[0].about_item.score).toBe(20);
  });

  it('PATCH returns 403 when item is locked', async () => {
    const item = await Item.create({
      ...baseItem,
      revision: { status: 'final', locked: true, revised: false },
    });

    const res = await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', VALID_API_KEY)
      .send({ 'about_item.question': '잠긴 문항 수정 시도' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/lock/i);
  });

  it('PATCH returns 400 for invalid ObjectId', async () => {
    const res = await request(app)
      .patch('/api/items/not-an-id')
      .set('X-API-Key', VALID_API_KEY)
      .send({ 'about_item.question': '테스트' });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/items — ordering by sub_category_order + item_order', () => {
  it('items sorted by sub_category_order then item_order', async () => {
    await Item.create([
      { ...baseItem, item_number: '01.020.001', sub_category_order: 2, item_order: 1, question: 'C항목' },
      { ...baseItem, item_number: '01.010.002', sub_category_order: 1, item_order: 2, question: 'B항목' },
      { ...baseItem, item_number: '01.010.001', sub_category_order: 1, item_order: 1, question: 'A항목' },
    ]);

    const res = await request(app).get('/api/items').query({ area: '01' });

    expect(res.status).toBe(200);
    expect(res.body.items[0].about_item.question).toBe('A항목');
    expect(res.body.items[1].about_item.question).toBe('B항목');
    expect(res.body.items[2].about_item.question).toBe('C항목');
  });
});

describe('Item model — common_key pre-save hook', () => {
  it('common_key is derived from item_number on create', async () => {
    const item = await Item.create({ ...baseItem, item_number: '01.010.090' });
    expect(item.common_key).toBe('010.090');
  });

  it('different area_code same common_key identifies common items', async () => {
    await Item.create({ ...baseItem, item_number: '01.010.090', area_code: '01' });
    await Item.create({ ...baseItem, item_number: '90.010.090', area_code: '90' });

    const common = await Item.find({ common_key: '010.090' });
    expect(common.length).toBe(2);
    expect(common.map(i => i.area_code).sort()).toEqual(['01', '90']);
  });
});

describe('GET /api/items — classification filter', () => {
  it('filters by classification param', async () => {
    await Item.create([
      { ...baseItem, item_number: '01.010.001', classification: 'C', question: '핵심문항' },
      { ...baseItem, item_number: '01.010.002', classification: 'R', question: '필요문항' },
      { ...baseItem, item_number: '01.010.003', classification: 'B', question: '기본문항' },
    ]);

    const res = await request(app).get('/api/items').query({ classification: 'C' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].about_item.question).toBe('핵심문항');
  });
});
