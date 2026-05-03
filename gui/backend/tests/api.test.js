import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import ChecklistItem from '../models/ChecklistItem.js';

const sampleItem = {
  area: '01 검사실운영',
  sub_category: '1.1 조직',
  about_item: {
    item_number: 'QA-001',
    question: '검사실 조직도가 있는가?',
    description: '조직도에는 책임자와 담당자가 명시되어야 함',
    item_type: '필수',
    score: 10,
  },
  metadata: {
    year: 2024,
    source_file: 'test.pdf',
  },
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
    await ChecklistItem.create(sampleItem);
    await ChecklistItem.create({
      ...sampleItem,
      area: '02 인력',
      metadata: { year: 2023 },
    });

    const res = await request(app).get('/api/filters');

    expect(res.status).toBe(200);
    expect(res.body.years).toContain(2024);
    expect(res.body.years).toContain(2023);
    expect(res.body.areas).toContain('01 검사실운영');
    expect(res.body.areas).toContain('02 인력');
  });
});

describe('GET /api/items', () => {
  beforeEach(async () => {
    await ChecklistItem.create(sampleItem);
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
    await ChecklistItem.create({
      ...sampleItem,
      area: '02 인력',
      about_item: { ...sampleItem.about_item, item_number: 'QA-002' },
    });

    const res = await request(app)
      .get('/api/items')
      .query({ area: '01 검사실운영' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].area).toBe('01 검사실운영');
  });

  it('searches by keyword', async () => {
    const res = await request(app)
      .get('/api/items')
      .query({ search: '조직도' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
  });
});

describe('GET /api/items/:number', () => {
  it('returns 404 for non-existent item', async () => {
    const res = await request(app).get('/api/items/NONEXISTENT');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Item not found');
  });

  it('returns item history by item number', async () => {
    await ChecklistItem.create(sampleItem);
    await ChecklistItem.create({
      ...sampleItem,
      metadata: { year: 2023 },
    });

    const res = await request(app).get('/api/items/QA-001');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    expect(res.body[0].metadata.year).toBe(2024);
    expect(res.body[1].metadata.year).toBe(2023);
  });
});
