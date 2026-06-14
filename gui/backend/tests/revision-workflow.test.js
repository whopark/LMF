import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../app.js';
import Item from '../models/Item.js';
import Revision from '../models/Revision.js';

const API_KEY = process.env.API_KEY || 'test-api-key';

const baseItem = {
  item_number: '01.010.001',
  area_code: '01', year: 2026, area_name: '검사실운영',
  sub_category: '심사범위', sub_category_order: 1, item_order: 1,
  question: '원래 질문', description: '원래 설명', score: 10,
  classification: 'R', na_available: false,
};

beforeEach(async () => {
  await Item.deleteMany({});
  await Revision.deleteMany({});
});

// ─── State Machine Unit Tests ──────────────────────────────────────────────
describe('revisionState — valid transitions', () => {
  it('none → draft is valid', async () => {
    const { isValidTransition } = await import('../utils/revisionState.js');
    expect(isValidTransition('none', 'draft')).toBe(true);
  });

  it('draft → review is valid', async () => {
    const { isValidTransition } = await import('../utils/revisionState.js');
    expect(isValidTransition('draft', 'review')).toBe(true);
  });

  it('review → final is valid', async () => {
    const { isValidTransition } = await import('../utils/revisionState.js');
    expect(isValidTransition('review', 'final')).toBe(true);
  });

  it('none → final is INVALID', async () => {
    const { isValidTransition } = await import('../utils/revisionState.js');
    expect(isValidTransition('none', 'final')).toBe(false);
  });

  it('final → draft is INVALID (locked)', async () => {
    const { isValidTransition } = await import('../utils/revisionState.js');
    expect(isValidTransition('final', 'draft')).toBe(false);
  });

  it('getStatusUpdates for final sets locked=true and revised=true', async () => {
    const { getStatusUpdates } = await import('../utils/revisionState.js');
    const u = getStatusUpdates('final');
    expect(u['revision.locked']).toBe(true);
    expect(u['revision.revised']).toBe(true);
    expect(u['revision.status']).toBe('final');
  });
});

// ─── POST /api/revisions/transition/:id ────────────────────────────────────
describe('POST /api/revisions/transition/:id', () => {
  it('none → draft succeeds', async () => {
    const item = await Item.create({ ...baseItem });
    const res = await request(app)
      .post(`/api/revisions/transition/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ to: 'draft' });
    expect(res.status).toBe(200);
    expect(res.body.revision.status).toBe('draft');
    expect(res.body.revision.locked).toBe(false);
  });

  it('none → final returns 400 (invalid transition)', async () => {
    const item = await Item.create({ ...baseItem });
    const res = await request(app)
      .post(`/api/revisions/transition/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ to: 'final' });
    expect(res.status).toBe(400);
  });

  it('draft → review → final sets locked=true and revised=true', async () => {
    const item = await Item.create({
      ...baseItem,
      revision: { status: 'review', locked: false, revised: false },
    });
    const res = await request(app)
      .post(`/api/revisions/transition/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ to: 'final' });
    expect(res.status).toBe(200);
    expect(res.body.revision.locked).toBe(true);
    expect(res.body.revision.revised).toBe(true);
  });

  it('locked item transition fails with 403', async () => {
    const item = await Item.create({
      ...baseItem,
      revision: { status: 'final', locked: true, revised: true },
    });
    const res = await request(app)
      .post(`/api/revisions/transition/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ to: 'draft' });
    expect(res.status).toBe(403);
  });

  it('missing `to` field returns 400', async () => {
    const item = await Item.create({ ...baseItem });
    const res = await request(app)
      .post(`/api/revisions/transition/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({});
    expect(res.status).toBe(400);
  });
});

// ─── PATCH /api/items/:id → automatic Revision log ─────────────────────────
describe('PATCH /api/items/:id — revision log', () => {
  it('creates revision log entry on successful PATCH', async () => {
    const item = await Item.create({ ...baseItem });
    // x-user header must be ASCII or URL-encoded for non-ASCII names
    await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', API_KEY)
      .set('x-user', encodeURIComponent('신경화'))
      .send({ 'about_item.question': '수정된 질문' });

    const revisions = await Revision.find({ item_number: '01.010.001' });
    expect(revisions.length).toBe(1);
    expect(revisions[0].user).toBe('신경화');
    expect(revisions[0].before.question).toBe('원래 질문');
    expect(revisions[0].after.question).toBe('수정된 질문');
  });

  it('records score_changed=true when score changes', async () => {
    const item = await Item.create({ ...baseItem, score: 10 });
    await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ 'about_item.score': 20 });

    const rev = await Revision.findOne({ item_number: '01.010.001' });
    expect(rev.score_changed).toBe(true);
  });

  it('records score_changed=false when score unchanged', async () => {
    const item = await Item.create({ ...baseItem, score: 10 });
    await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ 'about_item.question': '다른 필드만 변경' });

    const rev = await Revision.findOne({ item_number: '01.010.001' });
    expect(rev.score_changed).toBe(false);
  });

  it('auto-transitions none → draft on first PATCH', async () => {
    const item = await Item.create({
      ...baseItem,
      revision: { status: 'none', locked: false, revised: false },
    });
    await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ 'about_item.question': '수정 시작' });

    const updated = await Item.findById(item._id).lean();
    expect(updated.revision.status).toBe('draft');
  });

  it('saves edit_types and reason from request body', async () => {
    const item = await Item.create({ ...baseItem });
    await request(app)
      .patch(`/api/items/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({
        'about_item.question': '질문 변경',
        edit_types: ['MODIFY_ITEM'],
        reason: '위원회 심의 결과 반영',
      });

    const rev = await Revision.findOne({ item_number: '01.010.001' });
    expect(rev.edit_types).toContain('MODIFY_ITEM');
    expect(rev.reason).toBe('위원회 심의 결과 반영');
  });
});

// ─── GET /api/revisions ─────────────────────────────────────────────────────
describe('GET /api/revisions', () => {
  beforeEach(async () => {
    await Revision.create([
      { item_number: '01.010.001', area_code: '01', year: 2026, user: '신경화', score_changed: true,
        before: { question: 'A', score: 5 }, after: { question: 'B', score: 10 } },
      { item_number: '01.010.002', area_code: '01', year: 2026, user: '서자영', score_changed: false,
        before: { question: 'C' }, after: { question: 'D' } },
    ]);
  });

  it('returns all revisions', async () => {
    const res = await request(app).get('/api/revisions');
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(2);
  });

  it('filters by user', async () => {
    const res = await request(app).get('/api/revisions').query({ user: '신경화' });
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(1);
    expect(res.body.revisions[0].user).toBe('신경화');
  });

  it('filters by score_changed=true', async () => {
    const res = await request(app).get('/api/revisions').query({ score_changed: 'true' });
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(1);
    expect(res.body.revisions[0].score_changed).toBe(true);
  });

  it('filters by item_number', async () => {
    const res = await request(app).get('/api/revisions').query({ item_number: '01.010.001' });
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(1);
  });
});

// ─── GET /api/revisions/edit-type-codes ────────────────────────────────────
describe('GET /api/revisions/edit-type-codes', () => {
  it('returns non-empty code list', async () => {
    const res = await request(app).get('/api/revisions/edit-type-codes');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('code');
    expect(res.body[0]).toHaveProperty('label');
  });
});

// ─── G4: edit_types filter ────────────────────────────────────────────────
describe('GET /api/revisions?edit_types= (G4)', () => {
  beforeEach(async () => {
    await Revision.create([
      {
        item_number: '01.010.001', area_code: '01', year: 2026,
        user: '테스터', edit_types: ['MODIFY_ITEM', 'MODIFY_DESC'],
        reason: '내용 수정', before: {}, after: {}, score_changed: false,
      },
      {
        item_number: '01.010.002', area_code: '01', year: 2026,
        user: '테스터', edit_types: ['ADD_AREA'],
        reason: '분야 추가', before: {}, after: {}, score_changed: false,
      },
      {
        item_number: '01.010.003', area_code: '01', year: 2026,
        user: '테스터', edit_types: ['SCORE_CHANGE'],
        reason: '배점 변경', before: {}, after: {}, score_changed: true,
      },
    ]);
  });

  it('filters revisions by single edit_type (comma-separated)', async () => {
    const res = await request(app)
      .get('/api/revisions')
      .query({ edit_types: 'ADD_AREA' });

    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(1);
    expect(res.body.revisions[0].item_number).toBe('01.010.002');
  });

  it('filters by multiple edit_types using $in logic', async () => {
    const res = await request(app)
      .get('/api/revisions')
      .query({ edit_types: 'MODIFY_ITEM,SCORE_CHANGE' });

    expect(res.status).toBe(200);
    // MODIFY_ITEM matches 01.010.001, SCORE_CHANGE matches 01.010.003
    expect(res.body.revisions.length).toBe(2);
  });

  it('returns all revisions when edit_types not specified', async () => {
    const res = await request(app).get('/api/revisions');
    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(3);
  });

  it('returns empty when edit_type does not exist', async () => {
    const res = await request(app)
      .get('/api/revisions')
      .query({ edit_types: 'NONEXISTENT_TYPE' });

    expect(res.status).toBe(200);
    expect(res.body.revisions.length).toBe(0);
  });
});
