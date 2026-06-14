import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { hashReason, buildReasonFields, verifyReason } from '../utils/reason.js';

// Plan SC-2: verbatim 수정사유 — byte-for-byte 보존, 자동요약 금지 (G2)
describe('reason verbatim helpers (G2)', () => {
  describe('buildReasonFields', () => {
    it('stores input verbatim — no trim, no normalization', () => {
      const input = '  배점 기준 모호하여\n5점에서 3점으로 조정  ';
      const f = buildReasonFields(input);
      expect(f.raw_reason).toBe(input); // byte-for-byte, leading/trailing spaces kept
      expect(f.reason).toBe(input); // backward-compat mirror
    });

    it('computes SHA-256 hash matching raw_reason', () => {
      const input = '설명 수정';
      const f = buildReasonFields(input);
      const expected = crypto.createHash('sha256').update(input, 'utf8').digest('hex');
      expect(f.reason_hash).toBe(expected);
    });

    it('treats null/undefined as empty string', () => {
      const emptyHash = crypto.createHash('sha256').update('', 'utf8').digest('hex');
      expect(buildReasonFields(null).raw_reason).toBe('');
      expect(buildReasonFields(undefined).raw_reason).toBe('');
      expect(buildReasonFields(null).reason_hash).toBe(emptyHash);
    });

    it('does not summarize long multi-line text', () => {
      const long = Array.from({ length: 50 }, (_, i) => `라인 ${i} 변경 사유`).join('\n');
      expect(buildReasonFields(long).raw_reason).toBe(long);
    });
  });

  describe('verifyReason', () => {
    it('returns true when hash matches raw_reason', () => {
      expect(verifyReason(buildReasonFields('해당없음 유무 변경'))).toBe(true);
    });

    it('returns false when raw_reason tampered', () => {
      const f = buildReasonFields('원문');
      expect(verifyReason({ ...f, raw_reason: '변조됨' })).toBe(false);
    });

    it('returns false for null input', () => {
      expect(verifyReason(null)).toBe(false);
    });
  });

  describe('hashReason', () => {
    it('is deterministic', () => {
      expect(hashReason('x')).toBe(hashReason('x'));
    });
  });
});
