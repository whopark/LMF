import { describe, it, expect } from 'vitest';
import { diffWords } from '../src/utils/diffText.js';

describe('diffWords — basic cases', () => {
  it('identical texts produce all "same" tokens', () => {
    const result = diffWords('hello world', 'hello world');
    expect(result.every(t => t.type === 'same')).toBe(true);
    expect(result.map(t => t.text).join(' ')).toBe('hello world');
  });

  it('added word is marked "added"', () => {
    const result = diffWords('hello', 'hello world');
    const added = result.filter(t => t.type === 'added');
    expect(added.length).toBe(1);
    expect(added[0].text).toBe('world');
  });

  it('removed word is marked "removed"', () => {
    const result = diffWords('hello world', 'hello');
    const removed = result.filter(t => t.type === 'removed');
    expect(removed.length).toBe(1);
    expect(removed[0].text).toBe('world');
  });

  it('empty old text → all tokens added', () => {
    const result = diffWords('', 'foo bar');
    expect(result.every(t => t.type === 'added')).toBe(true);
  });

  it('empty new text → all tokens removed', () => {
    const result = diffWords('foo bar', '');
    expect(result.every(t => t.type === 'removed')).toBe(true);
  });

  it('both empty → empty array', () => {
    expect(diffWords('', '')).toEqual([]);
  });
});

describe('diffWords — Korean text', () => {
  it('handles Korean word-level diff', () => {
    const result = diffWords('검사실 조직도가 있는가', '검사실 전문인력 조직도가 있는가');
    const added = result.filter(t => t.type === 'added');
    expect(added.some(t => t.text === '전문인력')).toBe(true);
  });

  it('common Korean words stay "same"', () => {
    const result = diffWords('조직도가 있는가', '조직도가 있는가');
    expect(result.every(t => t.type === 'same')).toBe(true);
  });
});

describe('diffWords — word substitution', () => {
  it('changed word appears as removed+added pair', () => {
    const result = diffWords('필수 항목이다', '권장 항목이다');
    const removed = result.filter(t => t.type === 'removed').map(t => t.text);
    const added = result.filter(t => t.type === 'added').map(t => t.text);
    expect(removed).toContain('필수');
    expect(added).toContain('권장');
  });
});
