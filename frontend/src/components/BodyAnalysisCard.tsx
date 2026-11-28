import { Link } from 'react-router';
import { useBodyAnalysis } from '../api/hooks';
import type { BodyLevel, BodyMetric } from '../api/types';
import { formatShortDate } from '../lib/date';
import ui from '../styles/ui.module.css';
import { ErrorState, Loading } from './QueryState';
import styles from './BodyAnalysisCard.module.css';

const LEVEL: Record<BodyLevel, { icon: string; cls: string | undefined }> = {
  LOW: { icon: '▼', cls: styles.low },
  NORMAL: { icon: '✓', cls: styles.normal },
  HIGH: { icon: '▲', cls: styles.high },
  VERY_HIGH: { icon: '▲▲', cls: styles.veryHigh },
};

/** 비율은 소수 자릿수를 유지하고, 그 밖은 최대 소수 둘째 자리까지. */
export function formatMetric(m: Pick<BodyMetric, 'key' | 'value' | 'unit'>): string {
  const digits = m.key === 'ecwRatio' ? 3 : m.key === 'waistHipRatio' ? 2 : undefined;
  const n = new Intl.NumberFormat('ko-KR', digits
    ? { minimumFractionDigits: digits, maximumFractionDigits: digits }
    : { maximumFractionDigits: 2 }).format(m.value);
  return m.unit ? `${n}${m.unit === '%' || m.unit === 'L' || m.unit === '점' ? '' : ' '}${m.unit}` : n;
}

/** 측정 1건을 결과지 묶음대로 보여 주고, 국제 기준이 있는 항목은 정상 범위 막대와 판정을 붙인다. */
export function BodyAnalysisCard({ id }: { id: number | null }) {
  const analysis = useBodyAnalysis(id);

  return (
    <section className={ui.card} aria-labelledby="body-analysis-title">
      <h2 id="body-analysis-title" className={ui.cardTitle}>
        결과지 분석
        {analysis.data && <span className={styles.date}>{formatShortDate(analysis.data.measuredOn)} 측정</span>}
      </h2>
      {id == null ? (
        <p className={ui.hint}>체성분을 기록하면 결과지처럼 정리하고 국제 기준으로 판정해 드려요.</p>
      ) : analysis.isPending ? (
        <Loading />
      ) : analysis.isError ? (
        <ErrorState error={analysis.error} onRetry={() => analysis.refetch()} />
      ) : (
        <>
          {analysis.data.context.missing.length > 0 && (
            <div className={ui.notice}>
              {analysis.data.context.missing.map((m) => (
                <p key={m}>{m}</p>
              ))}
              <p>
                <Link to="/settings">설정</Link>에서 프로필을 채우면 판정할 수 있어요.
              </p>
            </div>
          )}
          {analysis.data.context.standardWeightKg != null && (
            <p className={styles.context}>
              표준체중(BMI 22) {analysis.data.context.standardWeightKg} kg · 판정 기준: {analysis.data.context.age}세{' '}
              {analysis.data.context.sex === 'MALE' ? '남' : analysis.data.context.sex === 'FEMALE' ? '여' : ''} ·{' '}
              {analysis.data.context.heightCm} cm
            </p>
          )}
          <div className={styles.groups}>
            {analysis.data.groups.map((g) => (
              <div key={g.key} className={styles.group} data-testid={`analysis-${g.key}`}>
                <h3 className={styles.groupTitle}>{g.title}</h3>
                <ul className={styles.items}>
                  {g.items.map((m) => (
                    <MetricRow key={m.key} metric={m} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className={styles.caption}>
            판정은 출처가 있는 국제 기준만 써요. 내장지방 레벨·세포외수분비는 국제 기준이 없어 인바디 제조사 기준이라고 따로 적었어요.
            의료 진단이 아니에요.
          </p>
        </>
      )}
    </section>
  );
}

function MetricRow({ metric: m }: { metric: BodyMetric }) {
  const level = m.level ? LEVEL[m.level] : null;
  const hasRange = m.normalLow != null || m.normalHigh != null;
  return (
    <li className={styles.item} data-testid={`metric-${m.key}`}>
      <div className={styles.head}>
        <span className={styles.label}>{m.label}</span>
        <span className={styles.value}>
          {formatMetric(m)}
          {m.sharePct != null && <span className={styles.share}> ({m.sharePct}%)</span>}
        </span>
        {level && (
          <span className={`${styles.badge} ${level.cls}`}>
            <span aria-hidden="true">{level.icon}</span> {m.levelLabel}
          </span>
        )}
      </div>
      {hasRange && <RangeBar metric={m} />}
      {m.basis && <p className={styles.basis}>{m.basis}</p>}
    </li>
  );
}

/** 정상 범위(가운데 칸)와 값 위치. 한쪽 끝만 있는 기준(예: 7.0 미만이면 낮음)도 같은 모양으로 그린다. */
function RangeBar({ metric: m }: { metric: BodyMetric }) {
  const lo = m.normalLow ?? m.normalHigh! * 0.7;
  const hi = m.normalHigh ?? m.normalLow! * 1.4;
  const span = hi - lo || 1;
  const min = Math.min(lo - span * 0.75, m.value);
  const max = Math.max(hi + span * 0.75, m.value);
  const pos = (v: number) => `${((v - min) / (max - min)) * 100}%`;
  const range = [m.normalLow, m.normalHigh].filter((v) => v != null).join('~');
  const rangeText =
    m.normalLow != null && m.normalHigh != null
      ? `정상 ${range}`
      : m.normalLow != null
        ? `정상 ${m.normalLow} 이상`
        : `정상 ${m.normalHigh} 이하`;
  return (
    <div className={styles.rangeWrap}>
      <div className={styles.track} role="img" aria-label={`${m.label} ${formatMetric(m)}, ${rangeText}${m.levelLabel ? `, ${m.levelLabel}` : ''}`}>
        <span className={styles.normalZone} style={{ left: pos(lo), width: `calc(${pos(hi)} - ${pos(lo)})` }} />
        <span className={`${styles.marker} ${m.level ? LEVEL[m.level].cls : ''}`} style={{ left: pos(m.value) }} />
      </div>
      <span className={styles.rangeText}>{rangeText}</span>
    </div>
  );
}
