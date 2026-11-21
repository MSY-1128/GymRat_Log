import { Bar, BarChart, CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useStats } from '../api/hooks';
import { DateNav } from '../components/DateNav';
import { ErrorState, Loading } from '../components/QueryState';
import { addDays, formatShortDate } from '../lib/date';
import { formatGram, formatKcal, roundKcal } from '../lib/format';
import { useSelectedDate } from '../lib/useSelectedDate';
import { cssVar, useTheme } from '../lib/theme';
import { useMemo } from 'react';
import ui from '../styles/ui.module.css';
import styles from './HistoryPage.module.css';

// 차트 색은 테마 토큰(--series-1·2, dataviz 팔레트 검증 통과)에서 읽는다. 범례와 표 보기를 함께 제공한다.
function useChartColors() {
  const { resolved } = useTheme();
  return useMemo(
    () => ({
      intake: cssVar('--series-1') || '#2a78d6',
      burn: cssVar('--series-2') || '#eb6834',
      grid: cssVar('--chart-grid') || '#e8e8e1',
      axis: cssVar('--chart-axis') || '#c9c9bf',
      muted: cssVar('--text-muted') || '#5d6158',
      text: cssVar('--text') || '#0f110e',
      surface: cssVar('--surface') || '#ffffff',
      soft: cssVar('--surface-2') || '#f6f6f2',
      border: cssVar('--border') || '#e5e5de',
    }),
    [resolved],
  );
}

export function HistoryPage() {
  const [date, setDate] = useSelectedDate();
  const from = addDays(date, -6);
  const stats = useStats(from, date);
  const c = useChartColors();

  const data =
    stats.data?.map((d) => ({
      label: formatShortDate(d.date),
      date: d.date,
      consumed: roundKcal(d.consumedKcal),
      exercise: roundKcal(d.exerciseKcal),
    })) ?? [];
  const target = stats.data?.find((d) => d.targetKcal != null)?.targetKcal ?? null;
  const days = stats.data ?? [];
  const recorded = days.filter((d) => d.consumedKcal > 0);
  const avgConsumed = recorded.length ? recorded.reduce((a, d) => a + d.consumedKcal, 0) / recorded.length : null;
  const totalExercise = days.reduce((a, d) => a + d.exerciseKcal, 0);

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>기록</h1>
          <p className={ui.subtitle}>
            최근 7일 ({formatShortDate(from)} ~ {formatShortDate(date)}) · 기록이 없는 날은 0으로 표시해요.
          </p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>

      {stats.isPending ? (
        <Loading label="통계를 불러오는 중…" />
      ) : stats.isError ? (
        <ErrorState error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        <>
          <div className={ui.grid3}>
            <section className={ui.card}>
              <h2 className={styles.statLabel}>기록한 날 평균 섭취</h2>
              <p className={styles.stat}>{avgConsumed == null ? '—' : `${formatKcal(avgConsumed)} kcal`}</p>
              <p className={styles.caption}>{recorded.length}일 기록</p>
            </section>
            <section className={ui.card}>
              <h2 className={styles.statLabel}>7일 운동 소모 추정</h2>
              <p className={styles.stat}>{formatKcal(totalExercise)} kcal</p>
              <p className={styles.caption}>{days.reduce((a, d) => a + d.exerciseMinutes, 0)}분</p>
            </section>
            <section className={ui.card}>
              <h2 className={styles.statLabel}>현재 섭취 목표</h2>
              <p className={styles.stat}>{target == null ? '미설정' : `${formatKcal(target)} kcal`}</p>
              <p className={styles.caption}>설정에서 직접 지정</p>
            </section>
          </div>

          <section className={ui.card} aria-labelledby="chart-title">
            <h2 id="chart-title" className={ui.cardTitle}>
              일별 섭취 · 운동 소모 (kcal)
            </h2>
            <div className={styles.chart} role="img" aria-label="최근 7일 섭취 칼로리와 운동 소모 추정 막대 차트. 아래 표에 같은 값이 있습니다.">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }} barGap={2} barCategoryGap="24%">
                  <CartesianGrid vertical={false} stroke={c.grid} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.axis }} tick={{ fill: c.muted, fontSize: 12 }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={52} />
                  <Tooltip
                    cursor={{ fill: c.soft }}
                    formatter={(value, name) => [`${formatKcal(Number(value))} kcal`, String(name)]}
                    contentStyle={{ borderRadius: 14, border: `1px solid ${c.border}`, background: c.surface, color: c.text, fontSize: 13 }}
                    labelStyle={{ color: c.text, fontWeight: 700 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 13 }} formatter={(v) => <span style={{ color: c.text }}>{v}</span>} />
                  {target != null && (
                    <ReferenceLine
                      y={target}
                      stroke={c.muted}
                      strokeDasharray="4 4"
                      label={{ value: `목표 ${formatKcal(target)}`, position: 'insideTopRight', fill: c.muted, fontSize: 12 }}
                    />
                  )}
                  <Bar dataKey="consumed" name="섭취" fill={c.intake} radius={[4, 4, 0, 0]} maxBarSize={28} />
                  <Bar dataKey="exercise" name="운동 소모" fill={c.burn} radius={[4, 4, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className={styles.caption}>운동 소모는 섭취 목표에 더하지 않고 따로 표시해요.</p>
          </section>

          <section className={ui.card} aria-labelledby="table-title">
            <h2 id="table-title" className={ui.cardTitle}>
              일별 표
            </h2>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">날짜</th>
                    <th scope="col">섭취 (kcal)</th>
                    <th scope="col">남은 (kcal)</th>
                    <th scope="col">운동 (kcal)</th>
                    <th scope="col">운동 (분)</th>
                    <th scope="col">탄/단/지 (g)</th>
                  </tr>
                </thead>
                <tbody>
                  {[...days].reverse().map((d) => (
                    <tr key={d.date} aria-current={d.date === date ? 'date' : undefined}>
                      <th scope="row">
                        <button type="button" className={styles.dayLink} onClick={() => setDate(d.date)}>
                          {formatShortDate(d.date)}
                        </button>
                      </th>
                      <td>{formatKcal(d.consumedKcal)}</td>
                      <td className={d.remainingKcal != null && d.remainingKcal < 0 ? styles.over : undefined}>
                        {d.remainingKcal == null ? '미설정' : formatKcal(d.remainingKcal)}
                      </td>
                      <td>{formatKcal(d.exerciseKcal)}</td>
                      <td>{d.exerciseMinutes}</td>
                      <td>
                        {formatGram(d.carbsG)} / {formatGram(d.proteinG)} / {formatGram(d.fatG)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
