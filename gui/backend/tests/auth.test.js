import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import ChecklistItem from '../models/ChecklistItem.js';

const TEST_API_KEY = 'test-api-key-12345';

const sampleItem = {
  area: '01 검사실운영',
  sub_category: '1.1 조직',
  about_item: {
    item_number: 'QA-AUTH-001',
    question: '인증 테스트용 문항',
    description: '테스트 설명',
    item_type: '필수',
    score: 10,
  },
  metadata: {
    year: 2024,
    source_file: 'test.pdf',
  },
};

describe('PATCH /api/items/:id Authentication', () => {
  let testItem;

  beforeEach(async () => {
    process.env.API_KEY = TEST_API_KEY;
    testItem = await ChecklistItem.create(sampleItem);
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  it('returns 401 when no API key provided', async () => {
    const res = await request(app)
      .patch(`/api/items/${testItem._id}`)
      .send({ 'about_item.score': 20 });

    expect(res.status).toBe(401);
    expect(res.body.message).toBe('API key required');
  });

  it('returns 403 when invalid API key provided', async () => {
    const res = await request(app)
      .patch(`/api/items/${testItem._id}`)
      .set('x-api-key', 'wrong-key')
      .send({ 'about_item.score': 20 });

    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid API key');
  });

  it('allows update with valid API key', async () => {
    const res = await request(app)
      .patch(`/api/items/${testItem._id}`)
      .set('x-api-key', TEST_API_KEY)
      .send({ 'about_item.score': 20 });

    expect(res.status).toBe(200);
    expect(res.body.about_item.score).toBe(20);
  });

  it('returns 500 when API_KEY not configured', async () => {
    delete process.env.API_KEY;

    const res = await request(app)
      .patch(`/api/items/${testItem._id}`)
      .set('x-api-key', 'any-key')
      .send({ 'about_item.score': 20 });

    expect(res.status).toBe(500);
    expect(res.body.message).toBe('Server authentication not configured');
  });
});

describe('GET endpoints do not require authentication', () => {
  beforeEach(async () => {
    process.env.API_KEY = TEST_API_KEY;
    await ChecklistItem.create(sampleItem);
  });

  afterEach(() => {
    delete process.env.API_KEY;
  });

  it('GET /api/filters works without API key', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
  });

  it('GET /api/items works without API key', async () => {
    const res = await request(app).get('/api/items');
    expect(res.status).toBe(200);
  });

  it('GET /api/items/:number works without API key', async () => {
    const res = await request(app).get('/api/items/QA-AUTH-001');
    expect(res.status).toBe(200);
  });
});
