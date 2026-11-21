import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { ApiError } from '../api/client';
import { useLogin, useMe, useSignup } from '../api/hooks';
import { Field } from '../components/Field';
import { errorMessage } from '../components/QueryState';
import { safeNext } from '../components/RequireAuth';
import ui from '../styles/ui.module.css';
import styles from './AuthPage.module.css';

interface Props {
  mode: 'login' | 'signup';
}

const USERNAME = /^[A-Za-z0-9_.-]{3,30}$/;

/** 로그인 / 회원가입 화면. */
export function AuthPage({ mode }: Props) {
  const isSignup = mode === 'signup';
  const me = useMe();
  const login = useLogin();
  const signup = useSignup();
  const mutation = isSignup ? signup : login;
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const [v, setV] = useState({ username: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  if (me.data) return <Navigate to={next} replace />;

  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const username = v.username.trim();
    const errs: Record<string, string> = {};
    if (!username) errs.username = '아이디를 입력해 주세요.';
    else if (isSignup && !USERNAME.test(username)) errs.username = '영문·숫자·_ . - 로 3~30자 입력해 주세요.';
    if (!v.password) errs.password = '비밀번호를 입력해 주세요.';
    else if (isSignup && (v.password.length < 8 || v.password.length > 64)) errs.password = '8~64자로 입력해 주세요.';
    if (isSignup && !errs.password && v.password !== v.confirm) errs.confirm = '비밀번호가 서로 달라요.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    mutation.mutate(
      { username, password: v.password },
      {
        onSuccess: () => navigate(next, { replace: true }),
        onError: (err) => {
          if (err instanceof ApiError) setErrors(err.fieldErrors);
          setV((p) => ({ ...p, password: '', confirm: '' }));
        },
      },
    );
  };

  const err = mutation.error;
  const showFormError = mutation.isError && !(err instanceof ApiError && Object.keys(err.fieldErrors).length);
  const switchTo = (isSignup ? '/login' : '/signup') + (next !== '/' ? `?next=${encodeURIComponent(next)}` : '');

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden="true" />
          FitLog
        </div>
        <h1 className={styles.title}>{isSignup ? '계정 만들기' : '로그인'}</h1>
        <p className={styles.subtitle}>
          {isSignup ? '내 식단·운동 기록은 내 계정에만 저장돼요.' : '식단과 운동 기록을 이어서 관리하세요.'}
        </p>

        <form className={ui.form} onSubmit={submit} noValidate aria-label={isSignup ? '회원가입' : '로그인'}>
          <Field
            label="아이디"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={30}
            value={v.username}
            onChange={set('username')}
            error={errors.username}
            hint={isSignup ? '영문·숫자·_ . - 3~30자' : undefined}
            required
            autoFocus
          />
          <Field
            label="비밀번호"
            name="password"
            type="password"
            autoComplete={isSignup ? 'new-password' : 'current-password'}
            maxLength={64}
            value={v.password}
            onChange={set('password')}
            error={errors.password}
            hint={isSignup ? '8자 이상' : undefined}
            required
          />
          {isSignup && (
            <Field
              label="비밀번호 확인"
              name="confirm"
              type="password"
              autoComplete="new-password"
              maxLength={64}
              value={v.confirm}
              onChange={set('confirm')}
              error={errors.confirm}
              required
            />
          )}
          {showFormError && (
            <p className={ui.formError} role="alert">
              {errorMessage(err)}
            </p>
          )}
          <button type="submit" className={`${ui.button} ${styles.submit}`} disabled={mutation.isPending}>
            {mutation.isPending ? (isSignup ? '만드는 중…' : '로그인 중…') : isSignup ? '가입하고 시작하기' : '로그인'}
          </button>
        </form>

        <p className={styles.switch}>
          {isSignup ? '이미 계정이 있나요? ' : '처음이신가요? '}
          <Link to={switchTo}>{isSignup ? '로그인' : '계정 만들기'}</Link>
        </p>
      </div>
      <p className={styles.note}>
        모든 수치는 참고용 추정치이며 의료적 판단·진단을 대신하지 않습니다.
      </p>
    </div>
  );
}
