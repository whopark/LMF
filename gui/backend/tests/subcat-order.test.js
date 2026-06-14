import { describe, it, expect, beforeEach } from 'vitest';
import Item from '../models/Item.js';
import { middleCode, categoryCode, categoryFor, CATEGORY } from '../scripts/lib/subcatOrder.js';
import { runMigration } from '../scripts/migrate-subcat-order.js';

// Design Ref: §3 (Option C) — 93 중분류 → 10 코드 분류 통합. Plan SC-1/SC-2/SC-4.

describe('middleCode', () => {
  it('extracts MMM as int; null for non-standard', () => {
    expect(middleCode('01.010.020')).toBe(10);
    expect(middleCode('90.905.052')).toBe(905);
    expect(middleCode('01.제공.001')).toBeNull();
    expect(middleCode('bad')).toBeNull();
  });
});

describe('categoryCode — MMM 백자리 + 엣지', () => {
  it('maps hundreds digit → code', () => {
    expect(categoryCode('01.010.020')).toBe('01'); // 심사범위
    expect(categoryCode('01.201.010')).toBe('02'); // 질관리:일반
    expect(categoryCode('01.301.010')).toBe('03'); // 정도관리
    expect(categoryCode('01.404.010')).toBe('04'); // 검체처리
    expect(categoryCode('01.505.010')).toBe('05'); // 기구·장비
    expect(categoryCode('10.601.010')).toBe('06'); // 검사특이 → 검사수행
    expect(categoryCode('01.702.010')).toBe('07'); // 인력
    expect(categoryCode('01.801.010')).toBe('08'); // 시설
    expect(categoryCode('01.901.010')).toBe('09'); // 안전
  });
  it('edge: 제공(비숫자)→11, 005 기타→06, 980→04', () => {
    expect(categoryCode('01.제공.001')).toBe('11');
    expect(categoryCode('01.005.001')).toBe('06');
    expect(categoryCode('01.980.001')).toBe('04');
  });
  it('categoryFor returns coded label + numeric order', () => {
    expect(categoryFor('01.010.020')).toEqual({ code: '01', label: '01 심사범위', order: 1 });
    expect(categoryFor('01.제공.001')).toEqual({ code: '11', label: '11 제공서비스', order: 11 });
  });
  it('label set has 11 entries incl 검사실이전(10)', () => {
    expect(Object.keys(CATEGORY)).toHaveLength(11);
    expect(CATEGORY['10']).toBe('10 검사실이전');
  });
});

describe('migrate-subcat-order (integration: 93→10 통합)', () => {
  beforeEach(async () => {
    await Item.create([
      { item_number: '01.010.001', area_code: '01', year: 2026, sub_category: '심사범위', sub_category_order: 7 },
      { item_number: '10.610.110', area_code: '10', year: 2026, sub_category: '혈액응고검사', sub_category_order: 12 }, // 검사특이 → 06
      { item_number: '01.300.001', area_code: '01', year: 2026, sub_category: '정도관리 일반', sub_category_order: 4 },
      { item_number: '01.제공.001', area_code: '01', year: 2026, sub_category: '제공서비스', sub_category_order: 99 },
    ]);
  });

  it('collapses to coded categories + order = code (SC-1/2/4)', async () => {
    const total0 = await Item.countDocuments();
    const r = await runMigration({ apply: true });
    expect(total0).toBe(4);
    expect(r.post.inconsistentNames).toBe(0);  // SC-1
    expect(r.post.totalOk).toBe(true);

    const a = await Item.findOne({ item_number: '01.010.001' }).lean();
    expect(a.sub_category).toBe('01 심사범위');
    expect(a.sub_category_order).toBe(1);

    const b = await Item.findOne({ item_number: '10.610.110' }).lean(); // 혈액응고검사 → 06
    expect(b.sub_category).toBe('06 검사수행 및 장비운용');
    expect(b.sub_category_order).toBe(6);

    const p = await Item.findOne({ item_number: '01.제공.001' }).lean();
    expect(p.sub_category).toBe('11 제공서비스'); // 별도 끝
    expect(p.sub_category_order).toBe(11);

    // 심사범위(1) < 정도관리(3) < 검사수행(6) < 제공서비스(11)
    const codes = (await Item.find({}).lean()).map(i => i.sub_category_order).sort((x, y) => x - y);
    expect(codes).toEqual([1, 3, 6, 11]);
  });

  it('is idempotent — second apply changes nothing', async () => {
    await runMigration({ apply: true });
    const second = await runMigration({ apply: true });
    expect(second.stat.changed).toBe(0);
    expect(second.written).toBe(0);
  });

  it('dry-run writes nothing', async () => {
    const r = await runMigration({ apply: false });
    expect(r.stat.changed).toBeGreaterThan(0);
    expect(r.written).toBe(0);
    const a = await Item.findOne({ item_number: '01.010.001' }).lean();
    expect(a.sub_category).toBe('심사범위'); // unchanged
  });
});
