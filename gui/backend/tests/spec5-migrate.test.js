import { describe, it, expect, beforeEach } from 'vitest';
import Item from '../models/Item.js';
import { runMigration } from '../scripts/migrate-spec5.js';

// Integration: drive the migration core against the in-memory replset (setup.js).
// Plan SC-1/2/3/5 + idempotency. common_key is derived by Item pre-save from item_number.

async function seed() {
  await Item.create([
    // (a) 2020 merged: description empty, question carries everything; already classified.
    { item_number: '01.010.020', area_code: '01', year: 2020, question: 'Q2020? ∙ 가 ∙ 나', description: '', classification: 'C' },
    // (b) 2021 unclassified: shares common_key 010.020 with the 2026 source → backfill to C.
    { item_number: '90.010.020', area_code: '90', year: 2021, question: '클린질문?', description: '∙ 다', classification: '' },
    // (c) 2026 clean source: classMap source, must remain unchanged (SC-5).
    { item_number: '01.010.020', area_code: '01', year: 2026, question: 'clean?', description: '∙ x', classification: 'C', blocks: [{ type: 'bullet', content: ['x'] }] },
  ]);
}

describe('spec5 migration (integration)', () => {
  beforeEach(seed);

  it('applies split/backfill/blocks and meets SC-1/2/3/5', async () => {
    const total0 = await Item.countDocuments();
    const r = await runMigration({ apply: true });

    expect(total0).toBe(3);
    expect(r.post.mergedRemaining).toBe(0);        // SC-1
    expect(r.post.unclassifiedRemaining).toBe(0);  // SC-2
    expect(r.post.blocksCoverage).toBe('3/3');     // SC-3
    expect(r.post.totalOk).toBe(true);             // SC-5

    // (a) 2020 split + blocks, classification untouched
    const a = await Item.findOne({ item_number: '01.010.020', year: 2020 }).lean();
    expect(a.question).toBe('Q2020?');
    expect(a.description).toBe('∙ 가 ∙ 나');
    expect(a.blocks).toEqual([{ type: 'bullet', content: ['가', '나'] }]);
    expect(a.classification).toBe('C');

    // (b) 2021 backfilled to C from 2026 source, blocks built, no split
    const b = await Item.findOne({ item_number: '90.010.020', year: 2021 }).lean();
    expect(b.classification).toBe('C');
    expect(b.question).toBe('클린질문?');
    expect(b.blocks).toEqual([{ type: 'bullet', content: ['다'] }]);

    // (c) 2026 source unchanged
    const c = await Item.findOne({ item_number: '01.010.020', year: 2026 }).lean();
    expect(c.question).toBe('clean?');
    expect(c.classification).toBe('C');
  });

  it('is idempotent — second apply changes nothing', async () => {
    await runMigration({ apply: true });
    const second = await runMigration({ apply: true });
    expect(second.stat.changed).toBe(0);
    expect(second.written).toBe(0);
  });

  it('dry-run computes changes but writes nothing', async () => {
    const r = await runMigration({ apply: false });
    expect(r.stat.changed).toBeGreaterThan(0);
    expect(r.written).toBe(0);
    const a = await Item.findOne({ item_number: '01.010.020', year: 2020 }).lean();
    expect(a.description).toBe(''); // unchanged
  });

  it('cleans answer-marker bleed (question-only), bleedRemaining=0', async () => {
    await Item.create([
      // 2025형: "예 (필수)" 임베드
      { item_number: '01.010.022', area_code: '01', year: 2025, question: '인증 예 (필수) 심사를 받는가?', description: '∙ x', classification: 'C', blocks: [{ type: 'bullet', content: ['x'] }] },
      // 2021형: '?' 뒤 (필수) ∙ 중복 — 실설명은 description에 보존
      { item_number: '01.702.050', area_code: '01', year: 2021, question: '갖추고 있는가? (필수) ∙ 중복설명', description: '∙ 실설명', classification: 'R', blocks: [{ type: 'bullet', content: ['실설명'] }] },
    ]);
    const r = await runMigration({ apply: true });
    expect(r.post.bleedRemaining).toBe(0);

    const a = await Item.findOne({ item_number: '01.010.022', year: 2025 }).lean();
    expect(a.question).toBe('인증 심사를 받는가?');
    expect(a.description).toBe('∙ x'); // question-only
    expect(a.blocks).toEqual([{ type: 'bullet', content: ['x'] }]);

    const b = await Item.findOne({ item_number: '01.702.050', year: 2021 }).lean();
    expect(b.question).toBe('갖추고 있는가?');
    expect(b.description).toBe('∙ 실설명'); // unchanged
  });
});
