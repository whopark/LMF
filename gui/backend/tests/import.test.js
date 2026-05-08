import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import ChecklistItem from '../models/ChecklistItem.js';

// Sample document for import testing
const sampleImportDoc = {
  year: 2024,
  category: '01',
  title: '01.검사실운영_2024',
  total_items: 2,
  structured_sections: [
    {
      title: '1.1 조직',
      items: [
        {
          item_code: 'IMPORT-001',
          requirement: '테스트 요구사항 1',
          raw_line: '원본 텍스트 1',
          type: '필수',
          max_score: 10,
        },
        {
          item_code: 'IMPORT-002',
          requirement: '테스트 요구사항 2',
          raw_line: '원본 텍스트 2',
          type: '권장',
          max_score: 5,
        }
      ]
    }
  ]
};

// Valid API key for testing (must match test environment)
const VALID_API_KEY = process.env.API_KEY || 'test-api-key';

describe('GET /api/import/status', () => {
  beforeEach(async () => {
    await ChecklistItem.deleteMany({});
  });

  it('returns empty status when no documents exist', async () => {
    const res = await request(app).get('/api/import/status');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalDocuments');
    expect(res.body).toHaveProperty('years');
    expect(res.body).toHaveProperty('categories');
    expect(res.body).toHaveProperty('documentsPerYear');
    expect(res.body.totalDocuments).toBe(0);
    expect(res.body.years).toEqual([]);
  });

  it('returns correct counts when documents exist', async () => {
    await ChecklistItem.create(sampleImportDoc);
    await ChecklistItem.create({
      ...sampleImportDoc,
      year: 2023,
      category: '02',
      title: '02.인력_2023',
    });

    const res = await request(app).get('/api/import/status');

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
    await ChecklistItem.deleteMany({});
  });

  it('rejects request without API key', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .send({ documents: [sampleImportDoc] });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid or missing API key/i);
  });

  it('rejects request with invalid API key', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', 'invalid-key')
      .send({ documents: [sampleImportDoc] });

    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/Invalid or missing API key/i);
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

  it('successfully imports documents with valid API key', async () => {
    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: [sampleImportDoc] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.stats).toHaveProperty('documentsReceived', 1);
    expect(res.body.stats).toHaveProperty('documentsInserted', 1);
    expect(res.body.stats).toHaveProperty('totalInDB', 1);

    // Verify document was actually inserted
    const count = await ChecklistItem.countDocuments();
    expect(count).toBe(1);
  });

  it('accepts API key via query parameter', async () => {
    const res = await request(app)
      .post(`/api/import/bulk?apiKey=${VALID_API_KEY}`)
      .send({ documents: [sampleImportDoc] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('clears existing data when clearExisting is true', async () => {
    // Insert initial document
    await ChecklistItem.create(sampleImportDoc);
    const count = await ChecklistItem.countDocuments();
    expect(count).toBe(1);

    // Import with clearExisting
    const newDoc = {
      ...sampleImportDoc,
      year: 2025,
      title: '01.검사실운영_2025',
    };

    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: [newDoc], clearExisting: true });

    expect(res.status).toBe(200);
    expect(res.body.stats.totalInDB).toBe(1);

    // Verify only new document exists
    const docs = await ChecklistItem.find({});
    expect(docs.length).toBe(1);
    expect(docs[0].year).toBe(2025);
  });

  it('preserves existing data when clearExisting is false', async () => {
    // Insert initial document
    await ChecklistItem.create(sampleImportDoc);

    // Import without clearExisting
    const newDoc = {
      ...sampleImportDoc,
      year: 2025,
      title: '01.검사실운영_2025',
    };

    const res = await request(app)
      .post('/api/import/bulk')
      .set('X-API-Key', VALID_API_KEY)
      .send({ documents: [newDoc], clearExisting: false });

    expect(res.status).toBe(200);
    expect(res.body.stats.totalInDB).toBe(2);
  });

  it('handles batch import of multiple documents', async () => {
    const docs = Array.from({ length: 25 }, (_, i) => ({
      ...sampleImportDoc,
      year: 2020 + (i % 5),
      category: String(i % 10).padStart(2, '0'),
      title: `${String(i % 10).padStart(2, '0')}.테스트_${2020 + (i % 5)}`,
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
