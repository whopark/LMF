import { describe, it, expect } from 'vitest';
import { areaLabel } from '../src/utils/helpers.jsx';

describe('areaLabel', () => {
  it('prefixes a single area with its code', () => {
    expect(areaLabel({ code: '01', name: '검사실운영' })).toBe('01 검사실운영');
  });
  it('uses the first (representative) code for a grouped area', () => {
    expect(areaLabel({ code: '30,31,32,33,34,35,36', name: '임상미생물' })).toBe('30 임상미생물');
    expect(areaLabel({ code: '40,43,46', name: '수혈의학' })).toBe('40 수혈의학');
  });
  it('falls back to name when code is missing, and handles null', () => {
    expect(areaLabel({ code: '', name: '요경검학' })).toBe('요경검학');
    expect(areaLabel(null)).toBe('');
  });
});
