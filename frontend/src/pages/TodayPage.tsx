import { Link } from 'react-router';
import { useMeals, useProfile, useSummary, useWorkouts } from '../api/hooks';
import { bmrMethodLabel, mealTypeLabel, type DailySummary } from '../api/types';
import { DateNav } from '../components/DateNav';
import { Icon } from '../components/Icon';
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
          <p className={ui.eyebrow}>{greeting()}</p>
          <h1 className={ui.title}>오늘의 균형을 기록하세요</h1>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>

      {summary.isPending ? (
        <Loading label="요약을 불러오는 중…" />
      ) : summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : (
        <div className={styles.bento}>
          <section className={`${ui.card} ${styles.hero}`} aria-labelledby="consumed-label">
            <Ring consumed={summary.data.consumedKcal} target={summary.data.targetKcal} />
            <div className={styles.heroBody}>
              <h2 id="consumed-label" className={styles.label}>
                섭취 칼로리
              </h2>
              <p className={styles.heroNumber} data-testid="consumed-kcal">
                {formatKcal(summary.data.consumedKcal)}
                <span className={styles.unit}>kcal</span>
              </p>
              <p className={styles.caption}>
                {summary.data.targetKcal == null
                  ? '이 날 먹은 음식의 합계'
                  : `목표 ${formatKcal(summary.data.targetKcal)} kcal의 ${percent(summary.data)}%`}
              </p>
            </div>
            <div className={styles.quick}>
              <Link to={'/meals' + qs} className={`${ui.button} ${styles.quickPrimary}`} viewTransition>
                <Icon name="plus" size={18} />
                식단 기록하기
              </Link>
              <Link to={'/workouts' + qs} className={ui.secondary} viewTransition>
                <Icon name="plus" size={18} />
                운동 기록하기
              </Link>
            </div>
          </section>

          <section className={`${ui.card} ${styles.stat}`} aria-labelledby="remaining-label">
            <h2 id="remaining-label" className={styles.label}>
              목표까지 남은 칼로리
            </h2>
            {summary.data.remainingKcal == null ? (
              <>
                <p className={styles.statNumber}>미설정</p>
                <p className={styles.caption}>
                  <Link to={'/settings' + qs}>설정</Link>에서 섭취 목표를 직접 입력해 주세요.
                </p>
              </>
            ) : (
              <>
                <p
                  className={`${styles.statNumber} ${summary.data.remainingKcal < 0 ? styles.over : ''}`}
                  data-testid="remaining-kcal"
                >
                  {formatKcal(summary.data.remainingKcal)}
                  <span className={styles.unit}>kcal</span>
                </p>
                <p className={styles.caption}>
                  목표 {formatKcal(summary.data.targetKcal)} kcal
                  {summary.data.remainingKcal < 0 && ' · 목표를 넘었어요'}
                </p>
              </>
            )}
          </section>

          <section className={`${ui.card} ${styles.stat} ${styles.burn}`} aria-labelledby="burn-label">
            <h2 id="burn-label" className={styles.label}>
              <Icon name="flame" size={16} />
              운동 소모 추정
            </h2>
            <p className={styles.statNumber}>
              {formatKcal(summary.data.exerciseKcal)}
              <span className={styles.unit}>kcal</span>
            </p>
            <p className={styles.caption}>{summary.data.exerciseMinutes}분 · 휴식 대사 포함 · 목표에 자동 가산 안 함</p>
          </section>

          <section className={`${ui.card} ${styles.macroCard}`} aria-labelledby="macro-label">
            <h2 id="macro-label" className={ui.cardTitle}>
              영양소
              <span className={styles.cardHint}>칼로리 비중</span>
            </h2>
            <Macros summary={summary.data} />
            {profile.data?.proteinTargetG != null && (
              <ProteinGoal eaten={summary.data.proteinG} target={profile.data.proteinTargetG} />
            )}
          </section>

          {profile.isSuccess && (
            <section className={`${ui.card} ${styles.energy}`} aria-labelledby="energy-label">
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
                <dl className={styles.kv}>
                  <div>
                    <dt>BMR · {bmrMethodLabel(profile.data.bmrAppliedMethod ?? 'FORMULA')}</dt>
                    <dd>
                      {formatKcal(profile.data.bmrKcal)} <span>kcal</span>
                    </dd>
                  </div>
                  <div>
                    <dt>TDEE · 활동 포함</dt>
                    <dd>
                      {formatKcal(profile.data.tdeeKcal)} <span>kcal</span>
                    </dd>
                  </div>
                  <div>
                    <dt>현재 체중</dt>
                    <dd>
                      {formatAmount(profile.data.weightKg)} <span>kg</span>
                    </dd>
                  </div>
                </dl>
              )}
            </section>
          )}
        </div>
      )}

      <div className={styles.lists}>
        <section className={ui.card} aria-labelledby="today-meals">
          <h2 id="today-meals" className={ui.cardTitle}>
            식단
            <Link to={'/meals' + qs} className={`${ui.secondary} ${ui.small}`} viewTransition aria-label="식단 전체 보기">
              전체 보기
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
            <Link to={'/workouts' + qs} className={`${ui.secondary} ${ui.small}`} viewTransition aria-label="운동 전체 보기">
              전체 보기
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
    </div>
  );
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return '늦은 밤이에요';
  if (h < 11) return '좋은 아침이에요';
  if (h < 17) return '좋은 오후예요';
  return '좋은 저녁이에요';
}

function percent(s: DailySummary): number {
  return s.targetKcal ? Math.round((s.consumedKcal / s.targetKcal) * 100) : 0;
}

/** 목표 대비 섭취 진행 링. 목표가 없으면 빈 링(장식). */
function Ring({ consumed, target }: { consumed: number; target: number | null }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  const ratio = target && target > 0 ? consumed / target : 0;
  const shown = Math.min(1, Math.max(0, ratio));
  const over = ratio > 1;
  const common = { cx: 64, cy: 64, r, fill: 'none', strokeWidth: 14 } as const;
  return (
    <div className={styles.ring}>
      <svg
        viewBox="0 0 128 128"
        role={target ? 'meter' : undefined}
        aria-label={target ? '목표 대비 섭취' : undefined}
        aria-hidden={target ? undefined : true}
        aria-valuemin={target ? 0 : undefined}
        aria-valuemax={target ? Math.round(target) : undefined}
        aria-valuenow={target ? Math.round(consumed) : undefined}
      >
        <circle {...common} className={styles.ringTrack} />
        {target != null && target > 0 && (
          <circle
            {...common}
            className={`${styles.ringFill} ${over ? styles.ringOver : ''}`}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - shown)}
            transform="rotate(-90 64 64)"
          />
        )}
      </svg>
      <span className={styles.ringCenter} aria-hidden="true">
        {target ? `${Math.round(ratio * 100)}%` : <Icon name="bolt" size={26} />}
      </span>
    </div>
  );
}

/** 단백질 목표(제지방량 기준) 대비 섭취. 수치를 글자로 함께 보여 준다. */
function ProteinGoal({ eaten, target }: { eaten: number; target: number }) {
  const ratio = target > 0 ? eaten / target : 0;
  const left = target - eaten;
  return (
    <div className={styles.goal}>
      <div className={styles.goalHead}>
        <span>단백질 목표</span>
        <span data-testid="protein-progress">
          <strong>{formatKcal(eaten)}</strong> / {formatKcal(target)} g
        </span>
      </div>
      <div
        className={styles.goalTrack}
        role="meter"
        aria-label="단백질 목표 대비 섭취"
        aria-valuemin={0}
        aria-valuemax={Math.round(target)}
        aria-valuenow={Math.round(eaten)}
      >
        <span className={styles.goalFill} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
      </div>
      <p className={styles.goalNote}>{left > 0 ? `${formatKcal(left)} g 더 먹으면 목표예요` : '목표를 채웠어요'}</p>
    </div>
  );
}

/** 탄·단·지 칼로리 비중 막대 + 범례(그램·비율을 글자로 함께 표시). */
function Macros({ summary }: { summary: DailySummary }) {
  const parts = [
    { key: 'carbs', label: '탄수화물', g: summary.carbsG, kcal: summary.carbsG * 4, cls: styles.s1 },
    { key: 'protein', label: '단백질', g: summary.proteinG, kcal: summary.proteinG * 4, cls: styles.s2 },
    { key: 'fat', label: '지방', g: summary.fatG, kcal: summary.fatG * 9, cls: styles.s3 },
  ];
  const total = parts.reduce((a, p) => a + p.kcal, 0);
  return (
    <>
      <div className={styles.stack} aria-hidden="true">
        {total > 0 ? (
          parts.map((p) => (
            <span key={p.key} className={`${styles.seg} ${p.cls}`} style={{ flexGrow: p.kcal }} />
          ))
        ) : (
          <span className={styles.segEmpty} />
        )}
      </div>
      <dl className={styles.macroList}>
        {parts.map((p) => (
          <div key={p.key}>
            <dt>
              <span className={`${styles.dot} ${p.cls}`} aria-hidden="true" />
              {p.label}
            </dt>
            <dd>
              {formatGram(p.g)} g<span className={styles.share}>{total > 0 ? `${Math.round((p.kcal / total) * 100)}%` : '–'}</span>
            </dd>
          </div>
        ))}
      </dl>
    </>
  );
}
