// 서버 계산값은 반올림 전 값이다. 화면에서만 kcal 정수, 영양소 소수 1자리로 반올림한다.

/** 0.5는 0에서 먼 쪽으로 반올림(-47.5 → -48). */
function roundHalfAway(n: number, digits: number): number {
  const f = 10 ** digits;
  return (Math.sign(n) * Math.round(Math.abs(n) * f + Number.EPSILON)) / f;
}

const intFmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const oneFmt = new Intl.NumberFormat('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatKcal(n: number | null | undefined): string {
  if (n == null) return '—';
  const r = roundHalfAway(n, 0);
  return intFmt.format(r === 0 ? 0 : r);
}

export function formatGram(n: number | null | undefined): string {
  if (n == null) return '—';
  const r = roundHalfAway(n, 1);
  return oneFmt.format(r === 0 ? 0 : r);
}

export function roundKcal(n: number): number {
  return roundHalfAway(n, 0);
}

/** 입력값 그대로 표시(불필요한 소수점 제거). */
export function formatAmount(n: number): string {
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(n);
}
