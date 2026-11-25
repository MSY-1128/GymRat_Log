import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { safeNext } from '../components/RequireAuth';
import { createFakeServer, renderWithProviders } from '../test/utils';

describe('로그인', () => {
  it('redirects to login, then returns to the requested page after logging in', async () => {
    const { state } = createFakeServer();
    state.user = null;
    const user = userEvent.setup();
    renderWithProviders(<App />, '/meals?date=2026-11-21');

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('아이디'), 'Tester');
    await user.type(screen.getByLabelText('비밀번호'), 'password-123');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('heading', { name: '식단' })).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
    // 변경 요청에는 CSRF 헤더가 붙는다
    const login = state.calls.find((c) => c.method === 'POST' && c.path === '/auth/login');
    expect(login?.csrf).toMatch(/^tok-/);
    expect(login?.body).toEqual({ username: 'Tester', password: 'password-123' });
  });

  it('shows the server message on wrong password and clears the password', async () => {
    const { state } = createFakeServer();
    state.user = null;
    const user = userEvent.setup();
    renderWithProviders(<App />, '/login');

    await user.type(await screen.findByLabelText('아이디'), 'tester');
    await user.type(screen.getByLabelText('비밀번호'), 'nope-nope');
    await user.click(screen.getByRole('button', { name: '로그인' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('아이디 또는 비밀번호가 올바르지 않아요.');
    expect(screen.getByLabelText('비밀번호')).toHaveValue('');
  });

  it('validates signup on the client, shows server field errors, then signs up', async () => {
    const { state } = createFakeServer();
    state.user = null;
    const user = userEvent.setup();
    renderWithProviders(<App />, '/login');

    await user.click(await screen.findByRole('link', { name: '계정 만들기' }));
    expect(await screen.findByRole('heading', { name: '계정 만들기' })).toBeInTheDocument();

    await user.type(screen.getByLabelText('아이디'), 'ab');
    await user.type(screen.getByLabelText('비밀번호'), 'short');
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }));
    expect(screen.getByText('영문·숫자·_ . - 로 3~30자 입력해 주세요.')).toBeInTheDocument();
    expect(screen.getByText('8~64자로 입력해 주세요.')).toBeInTheDocument();
    expect(state.calls.some((c) => c.path === '/auth/signup')).toBe(false);

    await user.clear(screen.getByLabelText('아이디'));
    await user.type(screen.getByLabelText('아이디'), 'TESTER');
    await user.clear(screen.getByLabelText('비밀번호'));
    await user.type(screen.getByLabelText('비밀번호'), 'long-enough-1');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'different-1');
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }));
    expect(screen.getByText('비밀번호가 서로 달라요.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('비밀번호 확인'));
    await user.type(screen.getByLabelText('비밀번호 확인'), 'long-enough-1');
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }));
    expect(await screen.findByText('이미 사용 중인 아이디예요.')).toBeInTheDocument();
    expect(screen.getByLabelText('아이디')).toHaveAttribute('aria-invalid', 'true');

    await user.clear(screen.getByLabelText('아이디'));
    await user.type(screen.getByLabelText('아이디'), 'newbie');
    await user.type(screen.getByLabelText('비밀번호'), 'long-enough-1');
    await user.type(screen.getByLabelText('비밀번호 확인'), 'long-enough-1');
    await user.click(screen.getByRole('button', { name: '가입하고 시작하기' }));

    expect(await screen.findByText('newbie')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '오늘의 균형을 기록하세요' })).toBeInTheDocument();
  });

  it('logs out and returns to the login page', async () => {
    const { state } = createFakeServer();
    const user = userEvent.setup();
    renderWithProviders(<App />, '/');

    await user.click(await screen.findByRole('button', { name: '로그아웃' }));

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
    expect(state.user).toBeNull();
  });

  it('sends the user to login when the session expires mid-use', async () => {
    const { state } = createFakeServer();
    const user = userEvent.setup();
    renderWithProviders(<App />, '/meals?date=2026-11-21');
    await screen.findByRole('heading', { name: '식단' });

    // 서버 세션 만료(재시작 등)
    state.user = null;
    await user.click(screen.getByRole('link', { name: /기록/ }));

    expect(await screen.findByRole('heading', { name: '로그인' })).toBeInTheDocument();
  });

  it('ignores unsafe redirect targets', () => {
    expect(safeNext('/meals?date=2026-11-21')).toBe('/meals?date=2026-11-21');
    expect(safeNext('//evil.example')).toBe('/');
    expect(safeNext('https://evil.example')).toBe('/');
    expect(safeNext('/\\evil.example')).toBe('/');
    expect(safeNext('/login')).toBe('/');
    expect(safeNext(null)).toBe('/');
  });
});

describe('CSRF', () => {
  it('fetches a token before the first change request and retries once with a fresh token on 403', async () => {
    const { state } = createFakeServer();
    state.failures.set('PUT /profile', { count: 1, status: 403, body: { code: 'FORBIDDEN', message: '거부' } });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/settings');

    await user.type(await screen.findByLabelText(/나이/), '30');
    await user.type(screen.getByLabelText('키 (cm)'), '175');
    await user.type(screen.getByLabelText(/체중/), '70');
    await user.click(screen.getByRole('button', { name: /저장/ }));

    await waitFor(() => expect(state.calls.filter((c) => c.path === '/profile' && c.method === 'PUT')).toHaveLength(2));
    const puts = state.calls.filter((c) => c.path === '/profile' && c.method === 'PUT');
    expect(puts[0]?.csrf).toBe('tok-1');
    expect(puts[1]?.csrf).toBe('tok-2');
  });
});
