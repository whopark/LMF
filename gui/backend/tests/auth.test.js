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
          item_code: 'QA-AUTH-001',
          requirement: '인증 테스트용 문항',
          raw_line: '테스트 설명',
          type: '필수',
          max_score: 10,
        }
      ]
    }
  ]
};

describe('GET endpoints work without authentication', () => {
  beforeEach(async () => {
    await ChecklistItem.create(sampleDoc);
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
