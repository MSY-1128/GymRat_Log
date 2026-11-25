import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router';
import { useLogout, useMe } from '../api/hooks';
import { setTheme, useTheme, type ThemeChoice } from '../lib/theme';
import { Icon, type IconName } from './Icon';
import styles from './Layout.module.css';

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: '오늘', icon: 'today' },
  { to: '/meals', label: '식단', icon: 'meals' },
  { to: '/workouts', label: '운동', icon: 'workouts' },
  { to: '/history', label: '기록', icon: 'history' },
  { to: '/body', label: '체성분', icon: 'body' },
  { to: '/settings', label: '설정', icon: 'settings' },
];

const THEME_NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' };
const THEME_LABEL: Record<ThemeChoice, string> = { system: '시스템 설정', light: '라이트', dark: '다크' };
const THEME_ICON: Record<ThemeChoice, IconName> = { system: 'system', light: 'sun', dark: 'moon' };

export function Layout() {
  const [params] = useSearchParams();
  const date = params.get('date');
  const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const theme = useTheme();
  const username = me.data?.username ?? '';

  const doLogout = () =>
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <NavLink to={'/' + suffix} className={styles.brand} aria-label="FitLog 홈" viewTransition>
          <span className={styles.mark} aria-hidden="true" />
          FitLog
        </NavLink>
        <nav aria-label="주요 메뉴" className={styles.nav}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to + suffix}
              end={n.to === '/'}
              viewTransition
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              <Icon name={n.icon} className={styles.icon} />
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className={styles.account}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setTheme(THEME_NEXT[theme.choice])}
            aria-label={`테마: ${THEME_LABEL[theme.choice]} (눌러서 ${THEME_LABEL[THEME_NEXT[theme.choice]]}로 바꾸기)`}
            title={`테마: ${THEME_LABEL[theme.choice]}`}
          >
            <Icon name={THEME_ICON[theme.choice]} size={18} />
          </button>
          <span className={styles.user} title="로그인한 계정">
            <span className={styles.avatar} aria-hidden="true">
              {username.slice(0, 1).toUpperCase()}
            </span>
            <span className={styles.userName}>{username}</span>
          </span>
          <button
            type="button"
            className={styles.logout}
            onClick={doLogout}
            disabled={logout.isPending}
            aria-label="로그아웃"
          >
            <Icon name="logout" size={16} />
            <span>로그아웃</span>
          </button>
        </div>
      </header>
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        모든 수치는 참고용 추정치이며 의료적 판단·진단을 대신하지 않습니다. 운동 소모량은 휴식 대사를 포함한 총
        소모 추정치이며 섭취 목표에 자동으로 더하지 않습니다. 샘플(DEMO) 음식·운동 데이터는 검증된 영양정보가
        아닌 기능 확인용 예시입니다.
      </footer>
    </div>
  );
}
