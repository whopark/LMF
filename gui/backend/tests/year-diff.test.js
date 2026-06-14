import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';
import Revision from '../models/Revision.js';
import { normalizeKo } from '../utils/normalizeKo.js';

const API_KEY = process.env.API_KEY || 'test-api-key';

const mkItem = (over = {}) => ({
  item_number: '01.010.001', area_code: '01', area_name: '검사실운영',
  sub_category: '심사범위', sub_category_order: 1, item_order: 1,
  question: '질문', description: '설명', score: 5, classification: 'B', na_available: false,
  ...over,
});

beforeEach(async () => {
  await Item.deleteMany({});
  await Revision.deleteMany({});
});

// G-Y6: 한글 비교 전용 정규화
describe('normalizeKo (G-Y6)', () => {
  it('collapses whitespace and newlines', () => {
    expect(normalizeKo('가  나\n다')).toBe(normalizeKo('가 나 다'));
  });
  it('unifies bullet symbols', () => {
    expect(normalizeKo('항목•하나')).toBe(normalizeKo('항목∙하나'));
  });
  it('trims and returns plain text', () => {
    expect(normalizeKo('  설명  ')).toBe('설명');
  });
  it('treats null/undefined as empty string', () => {
    expect(normalizeKo(null)).toBe('');
    expect(normalizeKo(undefined)).toBe('');
  });
});

// G-Y1: changes.js 인증
describe('GET /api/changes/:year auth (G-Y1)', () => {
  it('returns 401 without auth', async () => {
    await request(app).get('/api/changes/2026').expect(401);
  });
  it('returns 200 with API key auth', async () => {
    await request(app).get('/api/changes/2026').set('X-API-Key', API_KEY).expect(200);
  });
});

// G-Y5: 6필드 diff + 한글 오탐 방지
describe('GET /api/changes/:year 6-field diff (G-Y5)', () => {
  it('detects field_specific_description and na_available changes', async () => {
    await Item.create(mkItem({ year: 2025, field_specific_description: '구 설명', na_available: false }));
    await Item.create(mkItem({ year: 2026, field_specific_description: '신 설명', na_available: true }));

    const res = await request(app).get('/api/changes/2026').set('X-API-Key', API_KEY).expect(200);
    const ch = res.body.changes.find(c => c.item_number === '01.010.001');
    expect(ch.change_type).toBe('MODIFIED');
    expect(ch.current).toHaveProperty('field_specific_description', '신 설명');
    expect(ch.current).toHaveProperty('na_available', true);
  });

  it('does NOT flag pure whitespace/newline difference as MODIFIED', async () => {
    await Item.create(mkItem({ year: 2025, description: '가 나 다' }));
    await Item.create(mkItem({ year: 2026, description: '가  나\n다' })); // 공백/개행만 차이
    const res = await request(app).get('/api/changes/2026').set('X-API-Key', API_KEY).expect(200);
    expect(res.body.changes.find(c => c.item_number === '01.010.001')).toBeUndefined();
  });
});

// G-Y4: verbatim 수정사유 batch 첨부
describe('GET /api/changes/:year verbatim reason batch (G-Y4)', () => {
  it('attaches latest target-year Revision.reason to change.current', async () => {
    await Item.create(mkItem({ year: 2025, question: '구 질문' }));
    await Item.create(mkItem({ year: 2026, question: '신 질문' }));
    await Revision.create([
      { item_number: '01.010.001', area_code: '01', year: 2026, reason: '구 사유', at: new Date('2026-01-01') },
      { item_number: '01.010.001', area_code: '01', year: 2026, reason: '위원회 심의 반영', at: new Date('2026-02-01') },
    ]);

    const res = await request(app).get('/api/changes/2026').set('X-API-Key', API_KEY).expect(200);
    const ch = res.body.changes.find(c => c.item_number === '01.010.001');
    expect(ch.current.reason).toBe('위원회 심의 반영'); // 최신 verbatim
  });
});
