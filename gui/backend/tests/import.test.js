import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';

// Flat item document matching new Item schema
const sampleFlatItem = {
  item_number: '01.010.001',
  area_code: '01',
  year: 2024,
  area_name: '검사실운영',
  sub_category: '1.1 조직',
  question: '테스트 요구사항 1',
  description: '원본 텍스트 1',
  classification: 'R',
  score: 10,
};

const VALID_API_KEY = process.env.API_KEY || 'test-api-key';

describe('GET /api/import/status', () => {
  beforeEach(async () => {
    await Item.deleteMany({});
  });

  it('returns empty status when no items exist', async () => {
    const res = await request(app).get('/api/import/status')
      .set('X-API-Key', VALID_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalDocuments');
    expect(res.body).toHaveProperty('years');
    expect(res.body).toHaveProperty('categories');
    expect(res.body).toHaveProperty('documentsPerYear');
    expect(res.body.totalDocuments).toBe(0);
    expect(res.body.years).toEqual([]);
  });

  it('returns correct counts when items exist', async () => {
    await Item.create(sampleFlatItem);
    await Item.create({
      ...sampleFlatItem,
      item_number: '02.010.001',
      area_code: '02',
      year: 2023,
    });

    const res = await request(app).get('/api/import/status')
      .set('X-API-Key', VALID_API_KEY);

    expect(res.status).toBe(200);
    expect(res.body.totalDocuments).toBe(2);
    expect(res.body.years).toContain(2023);
    expect(res.body.years).toContain(2024);
    expect(res.body.categories).toContain('01');
    expect(res.body.categories).toContain('02');
    expect(res.body.documentsPerYear.length).toBe(2);
  });
});

describe('POST /api/import/bulk', () => {
  beforeEach(async () => {
    await Item.deleteMany({});
  });

  it('rejects request without credentials', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .send({ documents: [sampleFlatItem] });

    expect(res.status).toBe(401);
  });

  it('rejects request with invalid API key', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', 'invalid-key')
      .send({ documents: [sampleFlatItem] });

    expect(res.status).toBe(401);
  });

  it('rejects request without documents array', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/documents array required/i);
  });

  it('rejects request with non-array documents', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/documents array required/i);
  });

  it('successfully imports flat items with valid API key', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: [sampleFlatItem] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toHaveProperty('documentsReceived', 1);
    expect(res.body.stats).toHaveProperty('documentsInserted', 1);
    expect(res.body.stats).toHaveProperty('totalInDB', 1);

    const count = await Item.countDocuments();
    expect(count).toBe(1);
  });

  it('accepts API key via query parameter', async () => {
    const res = await request(app)
      .post(`/api/import/bulk?apiKey=${VALID_API_KEY}`)
      .send({ documents: [sampleFlatItem] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('clears existing data when clearExisting is true', async () => {
    await Item.create(sampleFlatItem);
    expect(await Item.countDocuments()).toBe(1);

    const newItem = { ...sampleFlatItem, year: 2025 };
    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: [newItem], clearExisting: true });

    expect(res.status).toBe(200);
    expect(res.body.stats.totalInDB).toBe(1);

    const items = await Item.find({});
    expect(items.length).toBe(1);
    expect(items[0].year).toBe(2025);
  });

  it('preserves existing data when clearExisting is false', async () => {
    await Item.create(sampleFlatItem);

    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: [{ ...sampleFlatItem, year: 2025, item_number: '01.010.002' }], clearExisting: false });

    expect(res.status).toBe(200);
    expect(res.body.stats.totalInDB).toBe(2);
  });

  it('handles batch import of multiple items', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({
      ...sampleFlatItem,
      year: 2020 + (i % 5),
      area_code: String(i % 10).padStart(2, '0'),
      item_number: `${String(i % 10).padStart(2, '0')}.010.${String(i + 1).padStart(3, '0')}`,
    }));

    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: docs });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats.documentsReceived).toBe(25);
    expect(res.body.stats.documentsInserted).toBe(25);
  });
});
