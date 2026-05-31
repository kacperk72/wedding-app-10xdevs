import { describe, expect, it } from 'vitest';
import { formatPLN } from './currency.format';

describe('formatPLN', () => {
  it('formatuje liczbę ze spacją jako separatorem tysięcy i sufiksem zł', () => {
    expect(formatPLN(32000)).toBe('32 000 zł');
    expect(formatPLN(1000000)).toBe('1 000 000 zł');
  });

  it('nie wstawia separatora dla wartości poniżej tysiąca', () => {
    expect(formatPLN(0)).toBe('0 zł');
    expect(formatPLN(999)).toBe('999 zł');
  });

  it('zaokrągla do pełnych złotych', () => {
    expect(formatPLN(32000.49)).toBe('32 000 zł');
    expect(formatPLN(32000.5)).toBe('32 001 zł');
  });

  it('zwraca "- zł" dla null, undefined i NaN', () => {
    expect(formatPLN(null)).toBe('- zł');
    expect(formatPLN(undefined)).toBe('- zł');
    expect(formatPLN(Number.NaN)).toBe('- zł');
  });
});
