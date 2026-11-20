import { describe, expect, it } from 'vitest';
import { addDays, isValidDateString, parseLocalDate, toLocalDateString } from './date';
import { formatGram, formatKcal } from './format';

describe('date utils (local, no UTC shift)', () => {
  it('formats a local date without converting to UTC', () => {
    // 로컬 23:30 — toISOString()이었다면 시간대에 따라 다음/이전 날짜가 될 수 있다.
    expect(toLocalDateString(new Date(2026, 0, 31, 23, 30))).toBe('2026-01-31');
    expect(toLocalDateString(new Date(2026, 2, 1, 0, 5))).toBe('2026-03-01');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-03-10', -6)).toBe('2026-03-04');
  });

  it('rejects invalid dates', () => {
    expect(isValidDateString('2026-02-30')).toBe(false);
    expect(isValidDateString('2026-13-01')).toBe(false);
    expect(isValidDateString('20260101')).toBe(false);
    expect(isValidDateString(null)).toBe(false);
    expect(parseLocalDate('2026-12-31')?.getDate()).toBe(31);
  });
});

describe('display rounding', () => {
  it('rounds kcal to integers and macros to one decimal', () => {
    expect(formatKcal(547.5)).toBe('548');
    expect(formatKcal(-47.5)).toBe('-48');
    expect(formatKcal(1978.4)).toBe('1,978');
    expect(formatKcal(null)).toBe('—');
    expect(formatGram(1.1988)).toBe('1.2');
    expect(formatGram(52.45)).toBe('52.5');
    expect(formatGram(0)).toBe('0.0');
  });
});
