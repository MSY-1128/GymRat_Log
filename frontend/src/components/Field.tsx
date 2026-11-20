import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import ui from '../styles/ui.module.css';

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
}

/** label·hint·오류가 연결된 입력 필드. */
export function Field({ label, hint, error, id, ...rest }: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const hintId = hint ? inputId + '-hint' : undefined;
  const errId = error ? inputId + '-err' : undefined;
  return (
    <div className={ui.field}>
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        className={ui.input}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(' ') || undefined}
        {...rest}
      />
      {hint && (
        <p id={hintId} className={ui.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className={ui.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}
