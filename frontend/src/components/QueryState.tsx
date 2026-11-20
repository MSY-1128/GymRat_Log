import type { ReactNode } from 'react';
import { ApiError } from '../api/client';
import ui from '../styles/ui.module.css';
import styles from './QueryState.module.css';

export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <span className={styles.spinner} aria-hidden="true" />
      {label}
    </div>
  );
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return '알 수 없는 오류가 발생했습니다.';
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div className={styles.error} role="alert">
      <p className={styles.errorText}>{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className={`${ui.secondary} ${ui.small}`} onClick={onRetry}>
          다시 시도
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
