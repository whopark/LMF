import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Worklist from '../models/Worklist.js';

const API_KEY = process.env.API_KEY || 'test-api-key';
const USER = encodeURIComponent('신경화');

beforeEach(async () => {
  await Worklist.deleteMany({});
});

describe('GET /api/worklists', () => {
  it('returns empty list when no worklist exists', async () => {
    const res = await request(app).get('/api/worklists').set('x-user', USER);
    expect(res.status).toBe(200);
    expect(res.body.item_numbers).toEqual([]);
  });

  it('returns saved worklist for the requesting user', async () => {
    await Worklist.create({
      user: '신경화', year: 2026,
      item_numbers: ['01.010.001', '01.010.002'],
    });
    const res = await request(app).get('/api/worklists').set('x-user', USER);
    expect(res.status).toBe(200);
    expect(res.body.item_numbers).toContain('01.010.001');
  });

  it('does not return another user\'s worklist', async () => {
    await Worklist.create({
      user: '서자영', year: 2026, item_numbers: ['01.010.003'],
    });
    const res = await request(app).get('/api/worklists').set('x-user', USER);
    expect(res.body.item_numbers).toEqual([]);
  });
});

describe('PUT /api/worklists', () => {
  it('saves item_numbers for user', async () => {
    const res = await request(app)
      .put('/api/worklists')
      .set('x-user', USER)
      .send({ item_numbers: ['01.010.001', '01.010.002'], year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.item_numbers.length).toBe(2);
  });

  it('updates existing worklist on second PUT', async () => {
    await request(app).put('/api/worklists').set('x-user', USER)
      .send({ item_numbers: ['01.010.001'], year: 2026 });
    await request(app).put('/api/worklists').set('x-user', USER)
      .send({ item_numbers: ['01.010.001', '01.010.002'], year: 2026 });

    const res = await request(app).get('/api/worklists').set('x-user', USER);
    expect(res.body.item_numbers.length).toBe(2);
  });
});

describe('DELETE /api/worklists', () => {
  it('clears user\'s worklist', async () => {
    await Worklist.create({ user: '신경화', year: 2026, item_numbers: ['01.010.001'] });
    const del = await request(app).delete('/api/worklists').set('x-user', USER);
    expect(del.status).toBe(200);

    const get = await request(app).get('/api/worklists').set('x-user', USER);
    expect(get.body.item_numbers).toEqual([]);
  });
});
