import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import Item from '../models/Item.js';
import User from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const API_KEY = process.env.API_KEY || 'test-api-key';

// Helper: create a JWT for a given role
function makeToken(name, role) {
  return jwt.sign({ name, role }, JWT_SECRET, { expiresIn: '1h' });
}

const tokens = {
  viewer: makeToken('viewer-test', 'viewer'),
  editor: makeToken('editor-test', 'editor'),
  approver: makeToken('approver-test', 'approver'),
  admin: makeToken('admin-test', 'admin'),
};

const baseItem = {
  item_number: '01.010.001', area_code: '01', year: 2026,
  area_name: '검사실운영', sub_category: '심사범위',
  sub_category_order: 1, item_order: 1,
  question: '역할 테스트 질문', score: 10, classification: 'R',
};

beforeEach(async () => {
  await Item.deleteMany({});
  await User.deleteMany({});
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    await User.create({ name: '테스트관리자', role: 'admin', password_hash: 'placeholder' });
    // Seed via login with raw password
    await User.findOneAndUpdate(
      { name: '테스트관리자' },
      { $set: { password_hash: await hashPassword('adminpass') } }
    );

    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: '테스트관리자', password: 'adminpass' });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('user');
    expect(res.body.user.role).toBe('admin');
  });

  it('returns 401 for wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.default.hash('correct', 10);
    await User.create({ name: '직원', role: 'editor', password_hash: hash });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: '직원', password: 'wrong' });

    expect(res.status).toBe(401);
  });

  it('returns 404 for unknown user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ name: '없는사람', password: 'pass' });

    expect(res.status).toBe(404);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────
describe('GET /api/auth/me', () => {
  it('returns user info for valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${tokens.editor}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('editor-test');
    expect(res.body.role).toBe('editor');
  });

  it('returns 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});

// ─── Role matrix: PATCH /api/items/:id ───────────────────────────────────
describe('PATCH /api/items/:id — role matrix', () => {
  let itemId;
  beforeEach(async () => {
    const item = await Item.create(baseItem);
    itemId = item._id;
  });

  it('viewer gets 403 on PATCH', async () => {
    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${tokens.viewer}`)
      .send({ 'about_item.question': '수정 시도' });
    expect(res.status).toBe(403);
  });

  it('editor can PATCH', async () => {
    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('Authorization', `Bearer ${tokens.editor}`)
      .send({ 'about_item.question': '수정 성공' });
    expect(res.status).toBe(200);
  });

  it('API key still works (backward compat = admin)', async () => {
    const res = await request(app)
      .patch(`/api/items/${itemId}`)
      .set('X-API-Key', API_KEY)
      .send({ 'about_item.question': '키 방식 수정' });
    expect(res.status).toBe(200);
  });
});

// ─── Role matrix: POST /api/revisions/transition — review→final ──────────
describe('POST /api/revisions/transition — review→final requires approver', () => {
  let itemId;
  beforeEach(async () => {
    const item = await Item.create({
      ...baseItem,
      revision: { status: 'review', locked: false, revised: false },
    });
    itemId = item._id;
  });

  it('editor cannot transition review→final', async () => {
    const res = await request(app)
      .post(`/api/revisions/transition/${itemId}`)
      .set('Authorization', `Bearer ${tokens.editor}`)
      .send({ to: 'final' });
    expect(res.status).toBe(403);
  });

  it('approver can transition review→final', async () => {
    const res = await request(app)
      .post(`/api/revisions/transition/${itemId}`)
      .set('Authorization', `Bearer ${tokens.approver}`)
      .send({ to: 'final' });
    expect(res.status).toBe(200);
    expect(res.body.revision.status).toBe('final');
  });

  it('admin can transition review→final', async () => {
    const res = await request(app)
      .post(`/api/revisions/transition/${itemId}`)
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ to: 'final' });
    expect(res.status).toBe(200);
  });
});

// ─── GET /api/audit — admin only ─────────────────────────────────────────
describe('GET /api/audit', () => {
  it('admin can access audit log', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${tokens.admin}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
  });

  it('editor cannot access audit log', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${tokens.editor}`);
    expect(res.status).toBe(403);
  });
});

// ─── POST /api/users — admin only ────────────────────────────────────────
describe('POST /api/users — admin only', () => {
  it('admin can create user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens.admin}`)
      .send({ name: '신규직원', role: 'editor', password: 'pass123' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('신규직원');
  });

  it('editor cannot create user', async () => {
    const res = await request(app)
      .post('/api/users')
      .set('Authorization', `Bearer ${tokens.editor}`)
      .send({ name: '신규직원', role: 'viewer', password: 'pass123' });
    expect(res.status).toBe(403);
  });
});

async function hashPassword(plain) {
  const bcrypt = await import('bcryptjs');
  return bcrypt.default.hash(plain, 10);
}
