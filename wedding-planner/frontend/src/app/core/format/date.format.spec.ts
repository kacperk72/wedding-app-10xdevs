import { describe, expect, it } from 'vitest';
import { formatDDMMYYYY, formatLongDatePL, formatMonthShortPL } from './date.format';

describe('formatDDMMYYYY', () => {
  it('formatuje datę jako DD.MM.YYYY z zerami wiodącymi', () => {
    expect(formatDDMMYYYY('2026-07-25')).toBe('25.07.2026');
    expect(formatDDMMYYYY(new Date(2026, 0, 5))).toBe('05.01.2026');
  });

  it('zwraca pusty string dla braku wejścia', () => {
    expect(formatDDMMYYYY(null)).toBe('');
    expect(formatDDMMYYYY(undefined)).toBe('');
    expect(formatDDMMYYYY('')).toBe('');
  });

  it('zwraca pusty string dla niepoprawnej daty', () => {
    expect(formatDDMMYYYY('to-nie-data')).toBe('');
  });
});

describe('formatLongDatePL', () => {
  it('formatuje datę z polską nazwą miesiąca w dopełniaczu', () => {
    expect(formatLongDatePL(new Date(2026, 6, 25))).toBe('25 lipca 2026');
  });

  it('zwraca pusty string dla braku/niepoprawnego wejścia', () => {
    expect(formatLongDatePL(null)).toBe('');
    expect(formatLongDatePL('to-nie-data')).toBe('');
  });
});

describe('formatMonthShortPL', () => {
  it('zwraca skróconą polską nazwę miesiąca', () => {
    expect(formatMonthShortPL(new Date(2026, 9, 1))).toBe('paź');
  });
});
