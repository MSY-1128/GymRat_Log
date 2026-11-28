import { useLimitGuide } from '../api/hooks';
import { MEAL_TYPES, type LimitItem, type LimitStatus } from '../api/types';
import { formatKcal } from '../lib/format';
import ui from '../styles/ui.module.css';
import { ErrorState, Loading } from './QueryState';
import styles from './LimitNutrients.module.css';

const STATUS: Record<LimitStatus, { label: string; icon: string; cls: string | undefined }> = {
  NO_RECORD: { label: '기록 없음', icon: '–', cls: styles.none },
  OK: { label: '적정', icon: '✓', cls: styles.ok },
  NEAR: { label: '주의', icon: '!', cls: styles.near },
  OVER: { label: '초과', icon: '▲', cls: styles.over },
};

const BASIS = { TARGET: '설정한 하루 목표', TDEE: '프로필로 계산한 유지 열량', DEFAULT: '프로필이 없어 성인 기준' };

/** 나트륨은 정수, 당류·포화지방은 소수 첫째 자리. */
export function formatLimit(n: number | null, unit: string): string {
  if (n == null) return '—';
  const v = unit === 'mg' ? formatKcal(n) : new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(n);
  return `${v}${unit}`;
}

const mealLabel = (t: string) => MEAL_TYPES.find((m) => m.value === t)?.label ?? t;

/** 하루 당류·나트륨·포화지방 섭취를 상한·최근 7일 평균과 비교하고 줄일 부분을 안내한다. */
export function LimitNutrients({ date }: { date: string }) {
  const guide = useLimitGuide(date);

  return (
    <section className={ui.card} aria-labelledby="limits-title">
      <h2 id="limits-title" className={ui.cardTitle}>
        당류·나트륨·포화지방
      </h2>
      {guide.isPending ? (
        <Loading />
      ) : guide.isError ? (
        <ErrorState error={guide.error} onRetry={() => guide.refetch()} />
      ) : (
        <>
          <p className={styles.basis}>
            상한 기준 열량 {formatKcal(guide.data.referenceKcal)}kcal({BASIS[guide.data.referenceBasis]}) · 평균은 최근 7일 중
            기록한 {guide.data.averageDays}일
          </p>
          <ul className={styles.items}>
            {guide.data.items.map((item) => (
              <Meter key={item.nutrient} item={item} />
            ))}
          </ul>

          {guide.data.mealCount > 0 && guide.data.advice.length === 0 && (
            <p className={styles.allOk}>
              <span aria-hidden="true">✓</span> 오늘은 세 영양소 모두 상한의 80% 안이에요.
            </p>
          )}
          {guide.data.advice.length > 0 && (
            <div className={styles.advice} aria-label="줄여야 할 부분">
              <h3 className={styles.adviceTitle}>줄여야 할 부분</h3>
              {guide.data.advice.map((a) => {
                const unit = a.nutrient === 'SODIUM' ? 'mg' : 'g';
                return (
                  <div
                    key={a.nutrient}
                    className={`${styles.adviceItem} ${a.level === 'WARN' ? styles.adviceWarn : styles.adviceInfo}`}
                    data-testid={`advice-${a.nutrient}`}
                  >
                    <p className={styles.adviceMessage}>
                      <span className={styles.adviceIcon} aria-hidden="true">
                        {a.level === 'WARN' ? '▲' : '!'}
                      </span>
                      {a.message}
                    </p>
                    {a.topFoods.length > 0 && (
                      <p className={styles.topFoods}>
                        많이 먹은 음식:{' '}
                        {a.topFoods
                          .map((f) => `${f.name} ${formatLimit(f.amount, unit)}(${mealLabel(f.mealType)})`)
                          .join(' · ')}
                      </p>
                    )}
                    <ul className={styles.tips}>
                      {a.tips.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** 막대 하나: 오늘 섭취(채움) · 상한(세로선) · 7일 평균(삼각 표시). 수치는 글자로도 보여 준다. */
function Meter({ item }: { item: LimitItem }) {
  const s = STATUS[item.status];
  const scale = Math.max(item.limit * 1.5, item.today, item.average ?? 0) || 1;
  const pct = (v: number) => `${Math.min(100, (v / scale) * 100)}%`;
  return (
    <li className={styles.item} data-testid={`limit-${item.nutrient}`}>
      <div className={styles.head}>
        <span className={styles.name}>{item.label}</span>
        <span className={`${styles.status} ${s.cls}`}>
          <span aria-hidden="true">{s.icon}</span> {s.label}
        </span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-label={`${item.label} 상한 대비 오늘 섭취`}
        aria-valuemin={0}
        aria-valuemax={Math.round(item.limit)}
        aria-valuenow={Math.round(item.today)}
        aria-valuetext={`${formatLimit(item.today, item.unit)}, 상한 ${formatLimit(item.limit, item.unit)}의 ${item.percent}%`}
      >
        <span className={`${styles.fill} ${s.cls}`} style={{ width: pct(item.today) }} />
        <span className={styles.limitLine} style={{ left: pct(item.limit) }} />
        {item.average != null && <span className={styles.avgMark} style={{ left: pct(item.average) }} />}
      </div>
      <div className={styles.numbers}>
        <span>
          오늘 <strong>{formatLimit(item.today, item.unit)}</strong> / 상한 {formatLimit(item.limit, item.unit)} ({item.percent}
          %)
        </span>
        <span className={styles.avg}>
          <span className={styles.avgKey} aria-hidden="true" /> 7일 평균 {formatLimit(item.average, item.unit)}
        </span>
      </div>
      {item.todayMissing > 0 && (
        <p className={styles.missing}>{item.label} 정보가 없는 기록 {item.todayMissing}개는 합계에서 빠졌어요.</p>
      )}
      <p className={styles.limitBasis}>{item.limitBasis}</p>
    </li>
  );
}
