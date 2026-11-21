import { NavLink, Outlet, useNavigate, useSearchParams } from 'react-router';
import { useLogout, useMe } from '../api/hooks';
import styles from './Layout.module.css';

const NAV = [
  { to: '/', label: '오늘', icon: '◎' },
  { to: '/meals', label: '식단', icon: '◐' },
  { to: '/workouts', label: '운동', icon: '▲' },
  { to: '/history', label: '기록', icon: '▥' },
  { to: '/settings', label: '설정', icon: '⚙' },
];

export function Layout() {
  const [params] = useSearchParams();
  const date = params.get('date');
  const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
  const me = useMe();
  const logout = useLogout();
  const navigate = useNavigate();

  const doLogout = () =>
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) });

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main">
        본문으로 건너뛰기
      </a>
      <header className={styles.header}>
        <NavLink to={'/' + suffix} className={styles.brand} aria-label="FitLog 홈">
          FitLog<span className={styles.dot}>.</span>
        </NavLink>
        <nav aria-label="주요 메뉴" className={styles.nav}>
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to + suffix}
              end={n.to === '/'}
              className={({ isActive }) => (isActive ? `${styles.link} ${styles.active}` : styles.link)}
            >
              <span className={styles.icon} aria-hidden="true">
                {n.icon}
              </span>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.account}>
          <span className={styles.user} title="로그인한 계정">
            {me.data?.username}
          </span>
          <button type="button" className={styles.logout} onClick={doLogout} disabled={logout.isPending}>
            로그아웃
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
