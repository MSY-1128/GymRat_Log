import { NavLink, Outlet, useSearchParams } from 'react-router';
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
