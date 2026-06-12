import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import Item from '../models/Item.js';
import AuditLog from '../models/AuditLog.js';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const API_KEY = process.env.API_KEY || 'test-api-key';

const editorToken = jwt.sign({ name: 'audit-editor', role: 'editor' }, JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ name: 'audit-admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

const baseItem = {
  item_number: '01.010.001', area_code: '01', year: 2026,
  area_name: '검사실운영', sub_category: '심사범위',
  sub_category_order: 1, item_order: 1,
  question: '감사 테스트 질문', score: 10, classification: 'R',
};

beforeEach(async () => {
  await Item.deleteMany({});
  await AuditLog.deleteMany({});
  await User.deleteMany({});
});

describe('Audit log — PATCH /api/items creates log entry', () => {
  it('creates audit log entry on item PATCH', async () => {
    const item = await Item.create(baseItem);

    await request(app)
      .patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ 'about_item.question': '수정된 질문' });

    // Allow async log write to complete
    await new Promise(r => setTimeout(r, 50));

    const logs = await AuditLog.find({ resource_type: 'item' }).lean();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('patch_item');
    expect(logs[0].user).toBe('audit-editor');
  });
});

describe('Audit log — login creates log entry', () => {
  it('creates audit log entry on successful login', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('pass', 10);
    await User.create({ name: 'login-user', role: 'viewer', password_hash: hash });

    await request(app)
      .post('/api/auth/login')
      .send({ name: 'login-user', password: 'pass' });

    await new Promise(r => setTimeout(r, 50));

    const logs = await AuditLog.find({ action: 'login' }).lean();
    expect(logs.length).toBe(1);
    expect(logs[0].user).toBe('login-user');
  });
});

describe('GET /api/audit — search audit logs', () => {
  beforeEach(async () => {
    await AuditLog.create([
      { user: 'alice', role: 'editor', action: 'patch_item', resource_type: 'item', resource_id: 'id1' },
      { user: 'bob', role: 'admin', action: 'login', resource_type: 'auth', resource_id: '' },
      { user: 'alice', role: 'editor', action: 'transition', resource_type: 'item', resource_id: 'id2' },
    ]);
  });

  it('returns all logs to admin', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(3);
  });

  it('filters by user', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ user: 'alice' });
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(2);
  });

  it('filters by action', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${adminToken}`)
      .query({ action: 'login' });
    expect(res.status).toBe(200);
    expect(res.body.logs.length).toBe(1);
  });
});
