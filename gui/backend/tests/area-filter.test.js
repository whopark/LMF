import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';
import { areaCodeClause } from '../utils/areaFilter.js';

const base = {
  sub_category: '심사범위', sub_category_order: 1, item_order: 1,
  question: 'Q', description: 'D', score: 10, classification: 'R', na_available: false, year: 2026,
};
// 임상미생물 spans 30/31; 검사실운영 is single (01)
const mb30 = { ...base, item_number: '30.100.001', area_code: '30', area_name: '임상미생물' };
const mb31 = { ...base, item_number: '31.100.001', area_code: '31', area_name: '임상미생물' };
const lab01 = { ...base, item_number: '01.010.001', area_code: '01', area_name: '검사실운영' };

describe('areaCodeClause (unit)', () => {
  it('single code → plain string', () => expect(areaCodeClause('01')).toBe('01'));
  it('multi code → $in', () => expect(areaCodeClause('30,31,36')).toEqual({ $in: ['30', '31', '36'] }));
  it('trims and drops empties', () => expect(areaCodeClause(' 30 , ,31 ')).toEqual({ $in: ['30', '31'] }));
  it('empty/undefined → undefined', () => {
    expect(areaCodeClause('')).toBeUndefined();
    expect(areaCodeClause(undefined)).toBeUndefined();
  });
});

describe('GET /api/filters — area dedupe by name', () => {
  beforeEach(async () => { await Item.deleteMany({}); await Item.create([mb30, mb31, lab01]); });

  it('collapses duplicate names to one option with joined codes', async () => {
    const res = await request(app).get('/api/filters');
    expect(res.status).toBe(200);
    const names = res.body.areas.map(a => a.name);
    expect(names.filter(n => n === '임상미생물').length).toBe(1); // not 2
    const mb = res.body.areas.find(a => a.name === '임상미생물');
    expect(mb.code).toBe('30,31'); // all constituent codes
    expect(res.body.areas.find(a => a.name === '검사실운영').code).toBe('01');
  });
});

describe('GET /api/items — grouped area filter', () => {
  beforeEach(async () => { await Item.deleteMany({}); await Item.create([mb30, mb31, lab01]); });

  it('area=30,31 returns every constituent area_code', async () => {
    const res = await request(app).get('/api/items?area=30,31');
    expect(res.status).toBe(200);
    const codes = res.body.items.map(i => i.area).sort();
    expect(codes).toEqual(['30', '31']);
  });

  it('single area=01 still works', async () => {
    const res = await request(app).get('/api/items?area=01');
    expect(res.body.items.every(i => i.area === '01')).toBe(true);
  });
});
