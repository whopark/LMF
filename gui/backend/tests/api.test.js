import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import ChecklistItem from '../models/ChecklistItem.js';

// Clean up before each test to ensure isolation
beforeEach(async () => {
  await ChecklistItem.deleteMany({});
});

// Sample document matching the nested MongoDB schema
const sampleDoc = {
  year: 2024,
  category: '01',
  title: '01.검사실운영_2024',
  total_items: 1,
  structured_sections: [
    {
      title: '1.1 조직',
      items: [
        {
          item_code: 'QA-001',
          requirement: '검사실 조직도가 있는가?',
          raw_line: '조직도에는 책임자와 담당자가 명시되어야 함',
          type: '필수',
          max_score: 10,
        }
      ]
    }
  ]
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
    await ChecklistItem.create(sampleDoc);
    await ChecklistItem.create({
      ...sampleDoc,
      category: '02',
      title: '02.인력_2023',
      year: 2023,
    });

    const res = await request(app).get('/api/filters');

    expect(res.status).toBe(200);
    expect(res.body.years).toContain(2024);
    expect(res.body.years).toContain(2023);
    // areas is now array of {code, name} objects
    expect(res.body.areas).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: '01', name: '검사실운영' }),
        expect.objectContaining({ code: '02', name: '인력' }),
      ])
    );
  });
});

describe('GET /api/items', () => {
  beforeEach(async () => {
    await ChecklistItem.create(sampleDoc);
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
      ...sampleDoc,
      category: '02',
      title: '02.인력_2024',
      structured_sections: [{
        title: '2.1 인력관리',
        items: [{
          item_code: 'QA-002',
          requirement: '인력 구성이 적절한가?',
          raw_line: '인력 구성에 대한 설명',
          type: '필수',
          max_score: 10,
        }]
      }]
    });

    const res = await request(app)
      .get('/api/items')
      .query({ area: '01' });

    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].area).toBe('01');
  });

  it('searches by keyword', async () => {
    const res = await request(app)
      .get('/api/items')
      .query({ search: '조직도' });

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

  it('returns item history by item code', async () => {
    await ChecklistItem.create(sampleDoc);
    await ChecklistItem.create({
      ...sampleDoc,
      year: 2023,
      title: '01.검사실운영_2023',
    });

    const res = await request(app).get('/api/items/QA-001');

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
    // Results should be sorted by year descending
    expect(res.body[0].metadata.year).toBe(2024);
    expect(res.body[1].metadata.year).toBe(2023);
  });
});
