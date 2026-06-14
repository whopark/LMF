import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../app.js';
import Item from '../models/Item.js';
import Revision from '../models/Revision.js';
import { applyItemEdit } from '../services/revisionTxn.js';

const API_KEY = process.env.API_KEY || 'test-api-key';

const baseItem = (over = {}) => ({
  item_number: '01.010.090', area_code: '01', year: 2026,
  area_name: '검사실운영', sub_category: '심사범위',
  sub_category_order: 1, item_order: 1,
  question: '원본 질문', description: '원본 설명', score: 5, classification: 'B',
  ...over,
});

beforeEach(async () => {
  await Item.deleteMany({});
  await Revision.deleteMany({});
});

// Plan SC-2: verbatim 쓰기경로
describe('PATCH verbatim reason (G2 write path)', () => {
  it('stores reason verbatim with matching SHA-256 hash', async () => {
    const item = await Item.create(baseItem());
    const reason = '  배점 기준 모호\n5→3점으로 조정  ';
    await request(app).patch(`/api/items/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ 'about_item.score': 3, reason, edit_types: ['SCORE_CHANGE'] })
      .expect(200);

    const rev = await Revision.findOne({ item_number: '01.010.090' }).lean();
    expect(rev.raw_reason).toBe(reason); // byte-for-byte
    expect(rev.reason).toBe(reason); // backward-compat mirror
    expect(rev.reason_hash).toBe(crypto.createHash('sha256').update(reason, 'utf8').digest('hex'));
  });
});

// Plan SC-1 / TS-09: revision 로그 실패 시 PATCH 전체 롤백 (blocking)
describe('applyItemEdit transaction rollback (G1)', () => {
  it('rolls back the item update when revision creation fails', async () => {
    const item = await Item.create(baseItem({ question: '원본' }));
    const spy = vi.spyOn(Revision, 'create').mockRejectedValueOnce(new Error('injected revision failure'));

    await expect(applyItemEdit({
      id: item._id.toString(), updates: { question: '변경됨' },
      editTypes: [], rawReason: '사유', user: 'tester', role: 'editor', ip: '::1',
    })).rejects.toThrow();

    spy.mockRestore();
    const after = await Item.findById(item._id).lean();
    expect(after.question).toBe('원본'); // rolled back, not '변경됨'
    const revs = await Revision.find({ item_number: '01.010.090' }).lean();
    expect(revs.length).toBe(0); // no partial revision persisted
  });
});

// Plan SC-3 / TS-03: 최종 잠금 후 편집 차단
describe('locked item PATCH (G5)', () => {
  it('returns 403 and leaves the item unchanged', async () => {
    const item = await Item.create(baseItem({ revision: { status: 'final', locked: true, revised: true } }));
    await request(app).patch(`/api/items/${item._id}`)
      .set('X-API-Key', API_KEY)
      .send({ 'about_item.question': '변경 시도' })
      .expect(403);

    const after = await Item.findById(item._id).lean();
    expect(after.question).toBe('원본 질문');
  });
});

// Plan SC-5 / TS-06: 공통문항 전파 시 분야특이 설명 보존
describe('common propagation preserves field_specific_description (G7)', () => {
  beforeEach(async () => {
    await Item.create(baseItem({ area_code: '01', field_specific_description: '분야01 특이설명' }));
    await Item.create(baseItem({ item_number: '90.010.090', area_code: '90', field_specific_description: '분야90 특이설명' }));
  });

  it('propagates shared fields but never field_specific_description', async () => {
    await request(app).patch('/api/common/010.090')
      .set('X-API-Key', API_KEY)
      .send({ description: '공유 설명 변경', reason: '설명 수정', edit_types: ['MODIFY_DESC'] })
      .expect(200);

    const items = await Item.find({ common_key: '010.090' }).lean();
    items.forEach(i => expect(i.description).toBe('공유 설명 변경')); // shared propagated
    expect(items.find(i => i.area_code === '01').field_specific_description).toBe('분야01 특이설명');
    expect(items.find(i => i.area_code === '90').field_specific_description).toBe('분야90 특이설명');
  });

  it('stores verbatim reason for each propagated revision', async () => {
    const reason = '공통  일괄 설명 수정';
    await request(app).patch('/api/common/010.090')
      .set('X-API-Key', API_KEY)
      .send({ description: 'x', reason }).expect(200);

    const revs = await Revision.find({ common_key: '010.090' }).lean();
    expect(revs.length).toBe(2);
    revs.forEach(r => expect(r.raw_reason).toBe(reason));
  });
});
