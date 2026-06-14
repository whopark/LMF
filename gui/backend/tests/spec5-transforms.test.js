import { describe, it, expect } from 'vitest';
import { splitMerged } from '../scripts/lib/spec5/splitMerged.js';
import { buildClassMap } from '../scripts/lib/spec5/classMap.js';
import { backfillClassification } from '../scripts/lib/spec5/backfillClassification.js';
import { buildBlocks } from '../scripts/lib/spec5/buildBlocks.js';
import { cleanBleed } from '../scripts/lib/spec5/cleanBleed.js';
import { applyPatches } from '../scripts/lib/spec5/index.js';

// Design Ref: §3 — pure transforms, idempotent guards. Plan SC-1/2/3.

describe('splitMerged (SC-1: ∙ 기준 질문/설명 분리)', () => {
  it('splits at first ∙ when description empty', () => {
    const r = splitMerged({ question: '검사를 받는가? ∙ 별도의 검사실 ∙ 목록 확인', description: '' });
    expect(r).toEqual({ question: '검사를 받는가?', description: '∙ 별도의 검사실 ∙ 목록 확인' });
  });

  it('returns null when description already present (guard)', () => {
    expect(splitMerged({ question: '질문 ∙ a', description: '이미 있음' })).toBeNull();
  });

  it('returns null when question has no ∙ (FR-1: 원본 보존)', () => {
    expect(splitMerged({ question: '불릿 없는 질문입니다', description: '' })).toBeNull();
  });

  it('returns null when question would become empty (안전)', () => {
    expect(splitMerged({ question: '∙ 항목만 있음', description: '' })).toBeNull();
  });

  it('is idempotent — re-running on split output yields null', () => {
    const first = splitMerged({ question: 'Q? ∙ a', description: '' });
    expect(splitMerged({ question: first.question, description: first.description })).toBeNull();
  });
});

describe('buildClassMap (SC-2: 클린연도 우선순위 맵)', () => {
  it('prefers 2026 over older years for same common_key', () => {
    const docs = [
      { common_key: '010.090', year: 2025, classification: 'R' },
      { common_key: '010.090', year: 2026, classification: 'C' },
      { common_key: '010.020', year: 2025, classification: 'B' },
    ];
    const m = buildClassMap(docs);
    expect(m.get('010.090')).toBe('C');
    expect(m.get('010.020')).toBe('B');
  });

  it('excludes dirty source years (2020/2021) and empty classifications', () => {
    const docs = [
      { common_key: 'x', year: 2021, classification: 'C' },
      { common_key: 'y', year: 2026, classification: '' },
    ];
    const m = buildClassMap(docs);
    expect(m.has('x')).toBe(false);
    expect(m.has('y')).toBe(false);
  });
});

describe('backfillClassification (SC-2)', () => {
  const map = new Map([['010.090', 'C']]);
  it('fills classification from map when empty', () => {
    expect(backfillClassification({ classification: '', common_key: '010.090' }, map)).toEqual({ classification: 'C' });
  });
  it('returns null when already classified (guard)', () => {
    expect(backfillClassification({ classification: 'B', common_key: '010.090' }, map)).toBeNull();
  });
  it('returns null when common_key not in map (추측 금지)', () => {
    expect(backfillClassification({ classification: '', common_key: 'zzz' }, map)).toBeNull();
  });
  it('returns null when no common_key', () => {
    expect(backfillClassification({ classification: '' }, map)).toBeNull();
  });
});

describe('buildBlocks (SC-3: description → blocks)', () => {
  it('returns null for empty description', () => {
    expect(buildBlocks('')).toBeNull();
    expect(buildBlocks(null)).toBeNull();
  });
  it('parses inline ∙ bullets into one bullet block', () => {
    expect(buildBlocks('∙ 항목1 ∙ 항목2')).toEqual([{ type: 'bullet', content: ['항목1', '항목2'] }]);
  });
  it('separates leading text from bullets', () => {
    expect(buildBlocks('서론 텍스트 ∙ a ∙ b')).toEqual([
      { type: 'text', content: '서론 텍스트' },
      { type: 'bullet', content: ['a', 'b'] },
    ]);
  });
  it('treats plain text (no bullet) as text block', () => {
    expect(buildBlocks('단순 설명 문장')).toEqual([{ type: 'text', content: '단순 설명 문장' }]);
  });
  it('parses pipe table rows into a table block', () => {
    expect(buildBlocks('| 항목 | 기준 |\n| A | 5점 |')).toEqual([
      { type: 'table', content: [['항목', '기준'], ['A', '5점']] },
    ]);
  });
});

describe('cleanBleed (SC-B1: 답안마커 bleed 정제)', () => {
  it('removes embedded "예 (필수)" (2025형)', () => {
    expect(cleanBleed('검사 분야에 대해 인증 예 (필수) 심사를 받는가?'))
      .toEqual({ question: '검사 분야에 대해 인증 심사를 받는가?' });
  });
  it('truncates "?-뒤 (필수) ∙ 중복" cruft (2021형)', () => {
    expect(cleanBleed('기본요건을 갖추고 있는가? (필수) ∙ 검사실의 과장은 다음의'))
      .toEqual({ question: '기본요건을 갖추고 있는가?' });
  });
  it('returns null when no bleed marker (타깃 한정)', () => {
    expect(cleanBleed('일반적인 질문입니다?')).toBeNull();
  });
  it('does NOT touch 2020-merge style (? 뒤 ∙, no marker)', () => {
    expect(cleanBleed('받는가? ∙ 별도의 검사실을 포함하여')).toBeNull();
  });
  it('is idempotent', () => {
    const once = cleanBleed('인증 예 (필수) 심사를 받는가?');
    expect(cleanBleed(once.question)).toBeNull();
  });
});

describe('applyPatches (index: 합성 + 멱등)', () => {
  const map = new Map([['010.090', 'C']]);
  it('produces combined patch for a merged dirty doc', () => {
    const doc = { question: 'Q? ∙ a ∙ b', description: '', classification: '', common_key: '010.090' };
    expect(applyPatches(doc, map)).toEqual({
      question: 'Q?',
      description: '∙ a ∙ b',
      classification: 'C',
      blocks: [{ type: 'bullet', content: ['a', 'b'] }],
    });
  });
  it('returns null for an already-clean doc (SC-5: 불변/멱등)', () => {
    const clean = { question: 'clean?', description: '∙ x', classification: 'C', common_key: '010.090', blocks: [{ type: 'bullet', content: ['x'] }] };
    expect(applyPatches(clean, map)).toBeNull();
  });
  it('cleans bleed on a doc with populated description (question-only)', () => {
    const doc = { question: '인증 예 (필수) 심사를 받는가?', description: '∙ x', classification: 'C', common_key: '010.090', blocks: [{ type: 'bullet', content: ['x'] }] };
    expect(applyPatches(doc, map)).toEqual({ question: '인증 심사를 받는가?' });
  });
});
