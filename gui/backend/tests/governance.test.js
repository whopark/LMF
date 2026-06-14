import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app.js';
import Item from '../models/Item.js';
import Revision from '../models/Revision.js';
import AuditLog from '../models/AuditLog.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const editorToken = jwt.sign({ name: 'gov-editor', role: 'editor' }, JWT_SECRET, { expiresIn: '1h' });
const approverToken = jwt.sign({ name: 'gov-approver', role: 'approver' }, JWT_SECRET, { expiresIn: '1h' });
const adminToken = jwt.sign({ name: 'gov-admin', role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });

const baseItem = (over = {}) => ({
  item_number: '01.010.050', area_code: '01', year: 2026,
  area_name: '검사실운영', sub_category: '심사범위', sub_category_order: 1, item_order: 1,
  question: '원본 질문', description: '원본 설명', score: 5, classification: 'B',
  ...over,
});

beforeEach(async () => {
  await Item.deleteMany({});
  await Revision.deleteMany({});
  await AuditLog.deleteMany({});
});

// G4: unlock — admin only, reason required, audited (Plan SC-4)
describe('POST /api/revisions/unlock/:itemId (G4)', () => {
  const lockedItem = () => Item.create(baseItem({ revision: { status: 'final', locked: true, revised: true } }));

  it('requires admin role (editor → 403)', async () => {
    const item = await lockedItem();
    await request(app).post(`/api/revisions/unlock/${item._id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ reason: '재검토 필요' })
      .expect(403);
  });

  it('rejects unlock without a reason (400)', async () => {
    const item = await lockedItem();
    await request(app).post(`/api/revisions/unlock/${item._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(400);
  });

  it('unlocks with reason and writes an audit log (TS-04/05)', async () => {
    const item = await lockedItem();
    const reason = '위원장 요청으로 배점 재조정';
    await request(app).post(`/api/revisions/unlock/${item._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason })
      .expect(200);

    const after = await Item.findById(item._id).lean();
    expect(after.revision.locked).toBe(false);
    expect(after.revision.status).toBe('review');
    expect(after.revision.revised).toBe(true); // history permanent

    const logs = await AuditLog.find({ action: 'unlock' }).lean();
    expect(logs.length).toBe(1);
    expect(logs[0].details.reason).toBe(reason);
    expect(logs[0].user).toBe('gov-admin');
  });

  it('rejects unlock on a non-locked item (400)', async () => {
    const item = await Item.create(baseItem({ revision: { status: 'review', locked: false } }));
    await request(app).post(`/api/revisions/unlock/${item._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'x' })
      .expect(400);
  });

  it('allows repeated unlock cycles (unlimited)', async () => {
    const item = await lockedItem();
    await request(app).post(`/api/revisions/unlock/${item._id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ reason: '1차' }).expect(200);
    await Item.updateOne({ _id: item._id }, { $set: { 'revision.locked': true, 'revision.status': 'final' } });
    await request(app).post(`/api/revisions/unlock/${item._id}`)
      .set('Authorization', `Bearer ${adminToken}`).send({ reason: '2차' }).expect(200);

    const logs = await AuditLog.find({ action: 'unlock' }).lean();
    expect(logs.length).toBe(2);
  });
});

// G6: sensitive edit types restricted to approver+ (Plan SC-7 / TS-10)
describe('sensitive edit types (G6)', () => {
  it('blocks editor from a sensitive type (NEW_ITEM → 403) and leaves item unchanged', async () => {
    const item = await Item.create(baseItem());
    await request(app).patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ 'about_item.question': '신규문항 시도', edit_types: ['NEW_ITEM'] })
      .expect(403);

    const after = await Item.findById(item._id).lean();
    expect(after.question).toBe('원본 질문'); // guard runs before any write
  });

  it('allows approver to use a sensitive type (200)', async () => {
    const item = await Item.create(baseItem());
    await request(app).patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${approverToken}`)
      .send({ 'about_item.question': '분야 삭제', edit_types: ['DELETE_AREA'] })
      .expect(200);
  });

  it('allows editor to use a non-sensitive type (200)', async () => {
    const item = await Item.create(baseItem());
    await request(app).patch(`/api/items/${item._id}`)
      .set('Authorization', `Bearer ${editorToken}`)
      .send({ 'about_item.score': 7, edit_types: ['CHANGE_SCORE'] })
      .expect(200);
  });
});
