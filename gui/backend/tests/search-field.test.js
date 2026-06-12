import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';

const items = [
  {
    item_number: '01.010.001', area_code: '01', year: 2026, area_name: '검사실운영',
    sub_category: '심사범위', sub_category_order: 1, item_order: 1,
    question: '조직도가 있는가', description: '책임자가 명시', score: 10, classification: 'R',
  },
  {
    item_number: '01.010.002', area_code: '01', year: 2026, area_name: '검사실운영',
    sub_category: '심사범위', sub_category_order: 1, item_order: 2,
    question: '인력 구성이 적절한가', description: '전문 인력 목록', score: 5, classification: 'B',
  },
  {
    item_number: '02.010.001', area_code: '02', year: 2026, area_name: '종합검증',
    sub_category: '심사범위', sub_category_order: 1, item_order: 1,
    question: '종합 평가 기준이 있는가', description: '조직도 참조', score: 8, classification: 'R',
  },
];

beforeEach(async () => {
  await Item.deleteMany({});
  await Item.create(items);
});

describe('GET /api/items?search_field=item_number', () => {
  it('searches only in item_number field', async () => {
    const res = await request(app)
      .get('/api/items')
      .query({ search: '01.010', search_field: 'item_number' });

    expect(res.status).toBe(200);
    // Should match 01.010.001 and 01.010.002
    expect(res.body.items.length).toBe(2);
    expect(res.body.items.every(i => i.about_item.item_number.startsWith('01.010'))).toBe(true);
  });

  it('does not match question text when search_field=item_number', async () => {
    // "조직도" is in description/question but not item_number
    const res = await request(app)
      .get('/api/items')
      .query({ search: '조직도', search_field: 'item_number' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });
});

describe('GET /api/items?search_field=question', () => {
  it('searches only in question field', async () => {
    const res = await request(app)
      .get('/api/items')
      .query({ search: '조직도', search_field: 'question' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].about_item.item_number).toBe('01.010.001');
  });

  it('does not match description when search_field=question', async () => {
    // '책임자' is only in description, not question
    const res = await request(app)
      .get('/api/items')
      .query({ search: '책임자', search_field: 'question' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(0);
  });
});

describe('GET /api/items?search_field=description', () => {
  it('searches only in description field', async () => {
    const res = await request(app)
      .get('/api/items')
      .query({ search: '책임자', search_field: 'description' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });

  it('matches description across areas when no area filter', async () => {
    // '조직도' is in description of item 02.010.001 as well
    const res = await request(app)
      .get('/api/items')
      .query({ search: '조직도', search_field: 'description' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /api/items — no search_field defaults to all fields', () => {
  it('searches across item_number, question, and description', async () => {
    // '조직도' appears in question of 01.010.001 AND description of 02.010.001
    const res = await request(app)
      .get('/api/items')
      .query({ search: '조직도' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThanOrEqual(2);
  });
});
