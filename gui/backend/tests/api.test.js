import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';

beforeEach(async () => {
  await Item.deleteMany({});
});

// Flat item matching new Item schema
const sampleItem = {
  item_number: '01.010.001',
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
};

describe('GET /api/filters', () => {
  it('returns empty arrays when no data exists', async () => {
    const res = await request(app).get('/api/filters');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('years');
    expect(res.body).toHaveProperty('areas');
    expect(res.body).toHaveProperty('subCategories');
    expect(res.body.years).toEqual([]);
    expect(res.body.areas).toEqual([]);
  });

  it('returns distinct years, areas, and subCategories', async () => {
    await Item.create(sampleItem);
    await Item.create({
      ...sampleItem,
      item_number: '02.010.001',
      area_code: '02',
      area_name: '인력',
      year: 2023,
    });

    const res = await request(app).get('/api/filters');

    expect(res.status).toBe(200);
    expect(res.body.years).toContain(2024);
    expect(res.body.years).toContain(2023);
    expect(res.body.areas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '01', name: '검사실운영' }),
        expect.objectContaining({ code: '02', name: '인력' }),
      ])
    );
  });

  it('orders subCategories by sub_category_order (심사점검표 순서, 가나다 아님)', async () => {
    // order 1,5 → [인력, 검사장비]; 가나다였다면 [검사장비, 인력](ㄱ<ㅇ)이라 구분됨
    await Item.create({ ...sampleItem, item_number: '01.700.001', sub_category: '인력', sub_category_order: 1 });
    await Item.create({ ...sampleItem, item_number: '01.500.001', sub_category: '검사장비', sub_category_order: 5 });

    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(res.body.subCategories).toEqual(['인력', '검사장비']);
  });
});

describe('GET /api/items', () => {
  beforeEach(async () => {
    await Item.create(sampleItem);
  });

  it('returns paginated items', async () => {
    const res = await request(app).get('/api/items');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page');
    expect(res.body).toHaveProperty('totalPages');
    expect(res.body.items.length).toBe(1);
    expect(res.body.total).toBe(1);
  });

  it('filters by area', async () => {
    await Item.create({
      ...sampleItem,
      item_number: '02.010.001',
      area_code: '02',
      area_name: '인력',
      question: '인력 구성이 적절한가?',
    });

    const res = await request(app).get('/api/items').query({ area: '01' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].area).toBe('01');
  });

  it('searches by keyword', async () => {
    const res = await request(app).get('/api/items').query({ search: '조직도' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });
});

describe('GET /api/items/:code', () => {
  it('returns 404 for non-existent item', async () => {
    const res = await request(app).get('/api/items/NONEXISTENT');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Item not found');
  });

  it('returns item history by item_number', async () => {
    await Item.create(sampleItem);
    await Item.create({ ...sampleItem, year: 2023 });

    const res = await request(app).get('/api/items/01.010.001');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // Results sorted by year descending
    expect(res.body[0].metadata.year).toBe(2024);
    expect(res.body[1].metadata.year).toBe(2023);
  });
});
