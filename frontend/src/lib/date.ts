// 날짜는 브라우저 로컬 기준 YYYY-MM-DD 문자열로만 다룬다.
// toISOString()은 UTC로 바뀌어 날짜가 하루 밀릴 수 있으므로 사용하지 않는다.

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function toLocalDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayString(): string {
  return toLocalDateString(new Date());
}

/** YYYY-MM-DD를 로컬 자정 Date로 파싱. 유효하지 않으면 null. */
export function parseLocalDate(s: string | null | undefined): Date | null {
  if (!s) return null;
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
}

export function isValidDateString(s: string | null | undefined): s is string {
  return parseLocalDate(s) !== null;
}

export function addDays(s: string, days: number): string {
  const d = parseLocalDate(s);
  if (!d) throw new Error('Invalid date: ' + s);
  d.setDate(d.getDate() + days);
  return toLocalDateString(d);
}

export function formatKoreanDate(s: string): string {
  const d = parseLocalDate(s);
  if (!d) return s;
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' }).format(d);
}

export function formatShortDate(s: string): string {
  const d = parseLocalDate(s);
  if (!d) return s;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
