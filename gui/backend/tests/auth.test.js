import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';

beforeEach(async () => {
  await Item.deleteMany({});
});

const sampleItem = {
  item_number: 'QA-AUTH-001',
  area_code: '01',
  year: 2024,
  area_name: '검사실운영',
  sub_category: '1.1 조직',
  question: '인증 테스트용 문항',
  description: '테스트 설명',
  classification: 'R',
  score: 10,
};

describe('GET endpoints work without authentication', () => {
  beforeEach(async () => {
    await Item.create(sampleItem);
  });

  it('GET /api/filters works without API key', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('years');
    expect(res.body).toHaveProperty('areas');
  });

  it('GET /api/items works without API key', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('items');
  });

  it('GET /api/items/:code works without API key', async () => {
    const res = await request(app).get('/api/items/QA-AUTH-001');
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });
});

describe('Health and version endpoints', () => {
  it('GET /health returns status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/version returns version info', async () => {
    const res = await request(app).get('/api/version');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('features');
  });
});
