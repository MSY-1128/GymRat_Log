import { Link } from 'react-router';
import { useMeals, useProfile, useSummary, useWorkouts } from '../api/hooks';
import { mealTypeLabel } from '../api/types';
import { DateNav } from '../components/DateNav';
import { Empty, ErrorState, Loading } from '../components/QueryState';
import { formatAmount, formatGram, formatKcal } from '../lib/format';
import { useSelectedDate } from '../lib/useSelectedDate';
import ui from '../styles/ui.module.css';
import styles from './TodayPage.module.css';

export function TodayPage() {
  const [date, setDate] = useSelectedDate();
  const summary = useSummary(date);
  const profile = useProfile();
  const meals = useMeals(date);
  const workouts = useWorkouts(date);
  const qs = `?date=${date}`;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>오늘의 균형을 기록하세요</h1>
          <p className={ui.subtitle}>식단과 움직임을 하나씩 기록해 보세요.</p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>

      {summary.isPending ? (
        <Loading label="요약을 불러오는 중…" />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <>
          <div className={ui.grid3}>
            <section className={`${ui.card} ${styles.hero}`} aria-labelledby="consumed-label">
              <h2 id="consumed-label" className={styles.cardLabel}>
                섭취 칼로리
              </h2>
              <p className={styles.number} data-testid="consumed-kcal">
                {formatKcal(summary.data.consumedKcal)} <span className={styles.unit}>kcal</span>
              </p>
              <p className={styles.caption}>이 날 먹은 음식의 합계</p>
            </section>
            <section className={ui.card} aria-labelledby="remaining-label">
              <h2 id="remaining-label" className={styles.cardLabel}>
                목표까지 남은 칼로리
              </h2>
              {summary.data.remainingKcal == null ? (
                <>
                  <p className={styles.number}>미설정</p>
                  <p className={styles.caption}>
                    <Link to={'/settings' + qs}>설정</Link>에서 섭취 목표를 직접 입력해 주세요.
                  </p>
                </>
              ) : (
                <>
                  <p
                    className={`${styles.number} ${summary.data.remainingKcal < 0 ? styles.over : ''}`}
                    data-testid="remaining-kcal"
                  >
                    {formatKcal(summary.data.remainingKcal)} <span className={styles.unit}>kcal</span>
                  </p>
                  <p className={styles.caption}>
                    목표 {formatKcal(summary.data.targetKcal)} kcal
                    {summary.data.remainingKcal < 0 && ' · 목표를 넘었어요'}
                  </p>
                  <Meter value={summary.data.consumedKcal} max={summary.data.targetKcal ?? 0} />
                </>
              )}
            </section>
            <section className={ui.card} aria-labelledby="burn-label">
              <h2 id="burn-label" className={styles.cardLabel}>
                운동 소모 추정
              </h2>
              <p className={styles.number}>
                {formatKcal(summary.data.exerciseKcal)} <span className={styles.unit}>kcal</span>
              </p>
              <p className={styles.caption}>{summary.data.exerciseMinutes}분 · 휴식 대사 포함 · 목표에 자동 가산 안 함</p>
            </section>
          </div>

          <section className={ui.card} aria-labelledby="macro-label">
            <h2 id="macro-label" className={ui.cardTitle}>
              영양소
            </h2>
            <dl className={styles.macros}>
              <div>
                <dt>탄수화물</dt>
                <dd>{formatGram(summary.data.carbsG)} g</dd>
              </div>
              <div>
                <dt>단백질</dt>
                <dd>{formatGram(summary.data.proteinG)} g</dd>
              </div>
              <div>
                <dt>지방</dt>
                <dd>{formatGram(summary.data.fatG)} g</dd>
              </div>
            </dl>
          </section>
        </>
      )}

      <div className={ui.grid2}>
        <section className={ui.card} aria-labelledby="today-meals">
          <h2 id="today-meals" className={ui.cardTitle}>
            식단
            <Link to={'/meals' + qs} className={`${ui.secondary} ${ui.small}`}>
              식단 기록하기
            </Link>
          </h2>
          {meals.isPending ? (
            <Loading />
          ) : meals.isError ? (
            <ErrorState error={meals.error} onRetry={() => meals.refetch()} />
          ) : meals.data.length === 0 ? (
            <Empty>아직 기록이 없어요.</Empty>
          ) : (
            <ul className={ui.list}>
              {meals.data.map((m) => (
                <li key={m.id} className={ui.item}>
                  <div className={ui.itemMain}>
                    <div className={ui.itemName}>{m.foodNameSnapshot}</div>
                    <div className={ui.itemMeta}>
                      {mealTypeLabel(m.mealType)} · {formatAmount(m.grams)}g
                    </div>
                  </div>
                  <span className={ui.itemKcal}>{formatKcal(m.calculatedKcal)} kcal</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={ui.card} aria-labelledby="today-workouts">
          <h2 id="today-workouts" className={ui.cardTitle}>
            움직임
            <Link to={'/workouts' + qs} className={`${ui.secondary} ${ui.small}`}>
              운동 기록하기
            </Link>
          </h2>
          {workouts.isPending ? (
            <Loading />
          ) : workouts.isError ? (
            <ErrorState error={workouts.error} onRetry={() => workouts.refetch()} />
          ) : workouts.data.length === 0 ? (
            <Empty>아직 기록이 없어요.</Empty>
          ) : (
            <ul className={ui.list}>
              {workouts.data.map((w) => (
                <li key={w.id} className={ui.item}>
                  <div className={ui.itemMain}>
                    <div className={ui.itemName}>{w.nameSnapshot}</div>
                    <div className={ui.itemMeta}>{w.minutes}분</div>
                  </div>
                  <span className={ui.itemKcal}>{formatKcal(w.calculatedKcal)} kcal</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {profile.isSuccess && (
        <section className={ui.card} aria-labelledby="energy-label">
          <h2 id="energy-label" className={ui.cardTitle}>
            에너지 추정
          </h2>
          {profile.data == null ? (
            <p className={ui.notice}>
              프로필이 아직 없어요. <Link to={'/settings' + qs}>설정</Link>에서 저장하면 기초대사량(BMR)과 활동
              대사량(TDEE) 추정치를 볼 수 있고, 운동 기록도 할 수 있어요.
            </p>
          ) : profile.data.bmrKcal == null ? (
            <p className={ui.info}>계산식용 성별을 선택하지 않아 BMR/TDEE를 계산하지 않았어요.</p>
          ) : (
            <dl className={styles.macros}>
              <div>
                <dt>BMR (기초대사량)</dt>
                <dd>{formatKcal(profile.data.bmrKcal)} kcal</dd>
              </div>
              <div>
                <dt>TDEE (활동 포함)</dt>
                <dd>{formatKcal(profile.data.tdeeKcal)} kcal</dd>
              </div>
              <div>
                <dt>현재 체중</dt>
                <dd>{formatAmount(profile.data.weightKg)} kg</dd>
              </div>
            </dl>
          )}
        </section>
      )}
    </div>
  );
}

function Meter({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      className={styles.meter}
      role="meter"
      aria-label="목표 대비 섭취"
      aria-valuemin={0}
      aria-valuemax={Math.round(max)}
      aria-valuenow={Math.round(value)}
    >
      <div className={`${styles.meterFill} ${value > max ? styles.meterOver : ''}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
