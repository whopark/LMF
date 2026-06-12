import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import Worklist from '../models/Worklist.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
// C1: All worklist writes now require authentication
const userToken = jwt.sign({ name: '신경화', role: 'editor' }, JWT_SECRET, { expiresIn: '1h' });
const otherToken = jwt.sign({ name: '서자영', role: 'editor' }, JWT_SECRET, { expiresIn: '1h' });

beforeEach(async () => {
  await Worklist.deleteMany({});
});

describe('GET /api/worklists', () => {
  it('returns empty list when no worklist exists', async () => {
    const res = await request(app).get('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.item_numbers).toEqual([]);
  });

  it('returns saved worklist for the requesting user', async () => {
    await Worklist.create({
      user: '신경화', year: 2026,
      item_numbers: ['01.010.001', '01.010.002'],
    });
    const res = await request(app).get('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.item_numbers).toContain('01.010.001');
  });

  it('does not return another user\'s worklist', async () => {
    await Worklist.create({ user: '서자영', year: 2026, item_numbers: ['01.010.003'] });
    const res = await request(app).get('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.item_numbers).toEqual([]);
  });
});

describe('PUT /api/worklists', () => {
  it('saves item_numbers for user', async () => {
    const res = await request(app)
      .put('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ item_numbers: ['01.010.001', '01.010.002'], year: 2026 });
    expect(res.status).toBe(200);
    expect(res.body.item_numbers.length).toBe(2);
  });

  it('updates existing worklist on second PUT', async () => {
    await request(app).put('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ item_numbers: ['01.010.001'], year: 2026 });
    await request(app).put('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ item_numbers: ['01.010.001', '01.010.002'], year: 2026 });

    const res = await request(app).get('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.body.item_numbers.length).toBe(2);
  });
});

describe('DELETE /api/worklists', () => {
  it('clears user\'s worklist', async () => {
    await Worklist.create({ user: '신경화', year: 2026, item_numbers: ['01.010.001'] });
    const del = await request(app).delete('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`);
    expect(del.status).toBe(200);

    const get = await request(app).get('/api/worklists')
      .set('Authorization', `Bearer ${userToken}`);
    expect(get.body.item_numbers).toEqual([]);
  });
});
