import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useMe } from '../api/hooks';
import { ErrorState, Loading } from './QueryState';
import styles from '../pages/AuthPage.module.css';

/** 로그인하지 않았으면 로그인 화면으로 보낸다(로그인 후 원래 화면으로 돌아옴). */
export function RequireAuth({ children }: { children: ReactNode }) {
  const me = useMe();
  const location = useLocation();

  if (me.isPending) {
    return (
      <div className={styles.center}>
        <Loading label="로그인 상태를 확인하는 중…" />
      </div>
    );
  }
  if (me.isError) {
    return (
      <div className={styles.center}>
        <ErrorState error={me.error} onRetry={() => me.refetch()} />
      </div>
    );
  }
  if (!me.data) {
    const next = location.pathname + location.search;
    return <Navigate to={next === '/' ? '/login' : `/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <>{children}</>;
}

/** 로그인 후 돌아갈 경로. 다른 사이트로 보내는 값(//evil.com 등)은 무시한다. */
export function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.startsWith('/\\')) return '/';
  if (raw.startsWith('/login') || raw.startsWith('/signup')) return '/';
  return raw;
}
