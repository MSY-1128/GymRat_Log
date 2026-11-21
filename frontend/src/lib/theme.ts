import { useSyncExternalStore } from 'react';

/** system = OS 설정을 따름 */
export type ThemeChoice = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const KEY = 'fitlog.theme';
const listeners = new Set<() => void>();
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

let choice: ThemeChoice = readChoice();

function apply() {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset.theme;
  else root.dataset.theme = choice;
  const meta = document.querySelector('meta[name="theme-color"]');
  meta?.setAttribute('content', resolve() === 'dark' ? '#0a0b09' : '#f2f2ee');
}

function resolve(): ResolvedTheme {
  if (choice !== 'system') return choice;
  return media?.matches ? 'dark' : 'light';
}

function emit() {
  apply();
  listeners.forEach((l) => l());
}

media?.addEventListener?.('change', () => {
  if (choice === 'system') emit();
});

export function setTheme(next: ThemeChoice) {
  choice = next;
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // 저장이 막혀 있어도 이번 화면에서는 적용
  }
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  if (doc.startViewTransition && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    doc.startViewTransition(emit);
  } else {
    emit();
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useTheme(): { choice: ThemeChoice; resolved: ResolvedTheme } {
  const c = useSyncExternalStore(subscribe, () => choice, () => 'system' as ThemeChoice);
  const r = useSyncExternalStore(subscribe, resolve, () => 'light' as ResolvedTheme);
  return { choice: c, resolved: r };
}

/** 앱 시작 시 한 번(index.html 인라인 스크립트가 먼저 적용하고, 여기서 메타 태그까지 맞춘다). */
export function initTheme() {
  apply();
}

/** CSS 변수 값을 읽는다(차트처럼 색을 JS로 넘겨야 하는 곳). 테마가 바뀌면 useTheme로 다시 그린다. */
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
