import { useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ApiError } from '../api/client';
import {
  useBodyCompositions,
  useDeleteBodyComposition,
  useProfile,
  useSaveBodyComposition,
  useSaveProfile,
} from '../api/hooks';
import type { BodyComposition, BodyCompositionInput, Profile } from '../api/types';
import { Field } from '../components/Field';
import { Empty, ErrorState, Loading, errorMessage } from '../components/QueryState';
import { addDays, formatShortDate, todayString } from '../lib/date';
import { formatAmount, formatGram } from '../lib/format';
import { cssVar, useTheme } from '../lib/theme';
import ui from '../styles/ui.module.css';
import styles from './BodyPage.module.css';

const RANGES = [
  { value: 28, label: '4주' },
  { value: 84, label: '12주' },
  { value: 365, label: '1년' },
  { value: 1825, label: '전체' },
] as const;

export function BodyPage() {
  const today = todayString();
  const [days, setDays] = useState<number>(84);
  const from = addDays(today, -(days - 1));
  const list = useBodyCompositions(from, today);
  const profile = useProfile();
  const del = useDeleteBodyComposition();
  const [editing, setEditing] = useState<BodyComposition | null>(null);
  const [status, setStatus] = useState('');

  const entries = list.data ?? [];
  const latest = entries.at(-1) ?? null;

  const remove = (b: BodyComposition) => {
    if (!window.confirm(`${formatShortDate(b.measuredOn)} 체성분 기록을 삭제할까요?`)) return;
    del.mutate(b.id, {
      onSuccess: () => {
        if (editing?.id === b.id) setEditing(null);
        setStatus('체성분 기록을 삭제했어요.');
      },
      onError: (e) => setStatus(errorMessage(e)),
    });
  };

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>체성분</h1>
          <p className={ui.subtitle}>인바디 결과지를 보고 입력하세요. 체중만 필수이고 나머지는 있는 값만 넣으면 돼요.</p>
        </div>
        <div className={styles.ranges} role="radiogroup" aria-label="기간">
          {RANGES.map((r) => (
            <label key={r.value} className={styles.range}>
              <input type="radio" name="body-range" checked={days === r.value} onChange={() => setDays(r.value)} />
              {r.label}
            </label>
          ))}
        </div>
      </div>

      <div className={ui.grid2}>
        <section className={ui.card} aria-labelledby="body-form-title">
          <h2 id="body-form-title" className={ui.cardTitle}>
            {editing ? '체성분 수정' : '체성분 기록'}
          </h2>
          <BodyForm
            key={editing?.id ?? 'new'}
            editing={editing}
            onDone={(msg) => {
              setEditing(null);
              setStatus(msg);
            }}
            onCancel={() => setEditing(null)}
          />
          {profile.data && latest && <WeightSync profile={profile.data} latest={latest} />}
        </section>

        <section className={ui.card} aria-labelledby="body-change-title">
          <h2 id="body-change-title" className={ui.cardTitle}>
            변화
            <span className={styles.cardHint}>{RANGES.find((r) => r.value === days)?.label} · 첫 측정 → 마지막 측정</span>
          </h2>
          {list.isPending ? (
            <Loading />
          ) : list.isError ? (
            <ErrorState error={list.error} onRetry={() => list.refetch()} />
          ) : entries.length < 2 ? (
            <Empty>두 번 이상 기록하면 기간 동안의 변화를 보여 드려요.</Empty>
          ) : (
            <Changes entries={entries} />
          )}
        </section>
      </div>

      {entries.length > 0 && (
        <section className={ui.card} aria-labelledby="body-chart-title">
          <h2 id="body-chart-title" className={ui.cardTitle}>
            추이 (kg)
          </h2>
          <TrendChart entries={entries} />
          <p className={styles.caption}>체지방량은 체지방률을 입력한 날만 표시돼요. 아래 표에 같은 값이 있어요.</p>
        </section>
      )}

      <section className={ui.card} aria-labelledby="body-list-title">
        <h2 id="body-list-title" className={ui.cardTitle}>
          측정 기록
        </h2>
        <p className={ui.status} role="status">
          {status}
        </p>
        {list.isPending ? (
          <Loading />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : entries.length === 0 ? (
          <Empty>이 기간에 기록이 없어요.</Empty>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">측정일</th>
                  <th scope="col">체중</th>
                  <th scope="col">체지방률</th>
                  <th scope="col">체지방량</th>
                  <th scope="col">골격근량</th>
                  <th scope="col">제지방량</th>
                  <th scope="col">기초대사량</th>
                  <th scope="col">내장지방</th>
                  <th scope="col">
                    <span className={styles.srOnly}>관리</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...entries].reverse().map((b) => (
                  <tr key={b.id} aria-current={editing?.id === b.id ? 'true' : undefined}>
                    <th scope="row">{formatShortDate(b.measuredOn)}</th>
                    <td>{formatGram(b.weightKg)} kg</td>
                    <td>{b.bodyFatPct == null ? '—' : `${formatGram(b.bodyFatPct)}%`}</td>
                    <td>{b.fatMassKg == null ? '—' : `${formatGram(b.fatMassKg)} kg`}</td>
                    <td>{b.skeletalMuscleKg == null ? '—' : `${formatGram(b.skeletalMuscleKg)} kg`}</td>
                    <td>{b.leanMassKg == null ? '—' : `${formatGram(b.leanMassKg)} kg`}</td>
                    <td>{b.measuredBmrKcal == null ? '—' : `${b.measuredBmrKcal} kcal`}</td>
                    <td>{b.visceralFatLevel ?? '—'}</td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={`${ui.secondary} ${ui.small}`}
                          onClick={() => setEditing(b)}
                          aria-label={`${formatShortDate(b.measuredOn)} 기록 수정`}
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          className={`${ui.secondary} ${ui.small} ${ui.dangerText}`}
                          onClick={() => remove(b)}
                          disabled={del.isPending}
                          aria-label={`${formatShortDate(b.measuredOn)} 기록 삭제`}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

const str = (n: number | null | undefined) => (n == null ? '' : String(n));

function BodyForm({
  editing,
  onDone,
  onCancel,
}: {
  editing: BodyComposition | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const save = useSaveBodyComposition();
  const [date, setDate] = useState(editing?.measuredOn ?? todayString());
  const [weight, setWeight] = useState(str(editing?.weightKg));
  const [fat, setFat] = useState(str(editing?.bodyFatPct));
  const [muscle, setMuscle] = useState(str(editing?.skeletalMuscleKg));
  const [bmr, setBmr] = useState(str(editing?.measuredBmrKcal));
  const [visceral, setVisceral] = useState(str(editing?.visceralFatLevel));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const num = (s: string) => (s.trim() === '' ? null : Number(s));
    const w = num(weight);
    const f = num(fat);
    const m = num(muscle);
    const b = num(bmr);
    const v = num(visceral);
    if (!date) errs.measuredOn = '측정일을 입력해 주세요.';
    if (w == null || !(w >= 30 && w <= 350)) errs.weightKg = '30~350kg 사이로 입력해 주세요.';
    if (f != null && !(f >= 3 && f <= 70)) errs.bodyFatPct = '3~70% 사이로 입력하거나 비워 두세요.';
    if (m != null && !(m >= 5 && m <= 100)) errs.skeletalMuscleKg = '5~100kg 사이로 입력하거나 비워 두세요.';
    else if (m != null && w != null && m >= w) errs.skeletalMuscleKg = '골격근량은 체중보다 작아야 해요.';
    if (b != null && !(Number.isInteger(b) && b >= 500 && b <= 5000))
      errs.measuredBmrKcal = '500~5000 사이 정수로 입력하거나 비워 두세요.';
    if (v != null && !(Number.isInteger(v) && v >= 1 && v <= 30))
      errs.visceralFatLevel = '1~30 사이 정수로 입력하거나 비워 두세요.';
    setErrors(errs);
    if (Object.keys(errs).length || w == null) return;

    const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);
    const input: BodyCompositionInput = {
      measuredOn: date,
      weightKg: r1(w)!,
      bodyFatPct: r1(f),
      skeletalMuscleKg: r1(m),
      measuredBmrKcal: b,
      visceralFatLevel: v,
    };
    save.mutate(
      { id: editing?.id, input },
      {
        onSuccess: () => onDone(editing ? '체성분 기록을 수정했어요.' : '체성분을 기록했어요.'),
        onError: (err) => {
          if (err instanceof ApiError) setErrors(err.fieldErrors);
        },
      },
    );
  };

  const showFormError =
    save.isError && !(save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length);

  return (
    <form className={ui.form} onSubmit={submit} noValidate aria-label={editing ? '체성분 수정' : '체성분 기록'}>
      <div className={ui.row}>
        <Field label="측정일" type="date" max={todayString()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.measuredOn} required />
        <Field label="체중 (kg)" type="number" inputMode="decimal" min={30} max={350} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} error={errors.weightKg} required />
        <Field label="체지방률 (%)" type="number" inputMode="decimal" min={3} max={70} step="0.1" value={fat} onChange={(e) => setFat(e.target.value)} error={errors.bodyFatPct} placeholder="선택" />
        <Field label="골격근량 (kg)" type="number" inputMode="decimal" min={5} max={100} step="0.1" value={muscle} onChange={(e) => setMuscle(e.target.value)} error={errors.skeletalMuscleKg} placeholder="선택" />
        <Field label="기초대사량 (kcal)" type="number" inputMode="numeric" min={500} max={5000} value={bmr} onChange={(e) => setBmr(e.target.value)} error={errors.measuredBmrKcal} placeholder="선택" />
        <Field label="내장지방 레벨" type="number" inputMode="numeric" min={1} max={30} value={visceral} onChange={(e) => setVisceral(e.target.value)} error={errors.visceralFatLevel} placeholder="선택" />
      </div>
      {showFormError && (
        <p className={ui.formError} role="alert">
          {errorMessage(save.error)}
        </p>
      )}
      <div className={ui.actions}>
        <button type="submit" className={ui.button} disabled={save.isPending}>
          {save.isPending ? '저장 중…' : editing ? '수정 저장' : '기록하기'}
        </button>
        {editing && (
          <button type="button" className={ui.secondary} onClick={onCancel}>
            취소
          </button>
        )}
      </div>
      <p className={ui.hint}>
        같은 날은 한 번만 기록돼요. 체지방률을 넣으면 체지방량·제지방량을 계산하고, <Link to="/settings">설정</Link>에서
        기초대사량 계산 방식을 바꿀 수 있어요.
      </p>
    </form>
  );
}

/** 최근 측정 체중이 프로필 체중과 다르면 프로필에 반영할 수 있게 한다(운동 칼로리·키·몸무게 공식이 프로필 체중을 씀). */
function WeightSync({ profile, latest }: { profile: Profile; latest: BodyComposition }) {
  const save = useSaveProfile();
  const [done, setDone] = useState(false);
  if (done) return <p className={`${ui.status} ${ui.spaced}`}>프로필 체중을 {formatAmount(latest.weightKg)}kg으로 바꿨어요.</p>;
  if (Number(profile.weightKg) === Number(latest.weightKg)) return null;
  const apply = () =>
    save.mutate(
      {
        age: profile.age,
        sexForFormula: profile.sexForFormula,
        heightCm: profile.heightCm,
        weightKg: latest.weightKg,
        activityFactor: profile.activityFactor,
        goal: profile.goal,
        dailyTargetKcal: profile.dailyTargetKcal,
        bmrMethod: profile.bmrMethod,
        proteinGPerKgLean: profile.proteinGPerKgLean,
      },
      { onSuccess: () => setDone(true) },
    );
  return (
    <div className={`${ui.notice} ${ui.spaced} ${styles.sync}`}>
      <p>
        최근 측정 체중({formatAmount(latest.weightKg)}kg, {formatShortDate(latest.measuredOn)})이 프로필 체중(
        {formatAmount(profile.weightKg)}kg)과 달라요. 운동 소모 칼로리와 키·몸무게 공식은 프로필 체중을 써요.
      </p>
      <button type="button" className={`${ui.secondary} ${ui.small}`} onClick={apply} disabled={save.isPending}>
        프로필 체중을 {formatAmount(latest.weightKg)}kg으로 바꾸기
      </button>
      {save.isError && <p className={ui.fieldError}>{errorMessage(save.error)}</p>}
    </div>
  );
}

/** 기간의 첫 측정과 마지막 측정 차이. 값이 있는 측정끼리만 비교한다. */
function Changes({ entries }: { entries: BodyComposition[] }) {
  const diff = (pick: (b: BodyComposition) => number | null) => {
    const has = entries.flatMap((b) => {
      const v = pick(b);
      return v == null ? [] : [{ v, on: b.measuredOn }];
    });
    const first = has[0];
    const last = has.at(-1);
    if (has.length < 2 || !first || !last) return null;
    return { delta: last.v - first.v, last: last.v, from: first.on, to: last.on };
  };
  const rows = [
    { key: 'weight', label: '체중', d: diff((b) => b.weightKg) },
    { key: 'muscle', label: '골격근량', d: diff((b) => b.skeletalMuscleKg) },
    { key: 'fat', label: '체지방량', d: diff((b) => b.fatMassKg) },
  ];
  return (
    <>
      <dl className={styles.changes}>
        {rows.map((r) => (
          <div key={r.key} data-testid={`change-${r.key}`}>
            <dt>{r.label}</dt>
            {r.d == null ? (
              <dd className={styles.changeNone}>측정 2회 필요</dd>
            ) : (
              <dd>
                <span className={styles.delta}>{signed(r.d.delta)} kg</span>
                <span className={styles.changeMeta}>
                  현재 {formatGram(r.d.last)} kg · {formatShortDate(r.d.from)}→{formatShortDate(r.d.to)}
                </span>
              </dd>
            )}
          </div>
        ))}
      </dl>
      <p className={styles.caption}>
        체성분 측정은 수분 상태에 따라 1~2kg씩 흔들릴 수 있어요. 한 번의 차이보다 여러 번의 흐름을 보세요.
      </p>
    </>
  );
}

function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  if (r === 0) return '0.0';
  return (r > 0 ? '+' : '−') + formatGram(Math.abs(r));
}

function useChartColors() {
  const { resolved } = useTheme();
  return useMemo(
    () => ({
      weight: cssVar('--series-1') || '#2a78d6',
      fat: cssVar('--series-2') || '#eb6834',
      muscle: cssVar('--series-3') || '#1baf7a',
      grid: cssVar('--chart-grid') || '#e8e8e1',
      axis: cssVar('--chart-axis') || '#c9c9bf',
      muted: cssVar('--text-muted') || '#5d6158',
      text: cssVar('--text') || '#0f110e',
      surface: cssVar('--surface') || '#ffffff',
      border: cssVar('--border') || '#e5e5de',
    }),
    [resolved],
  );
}

/** 체중·골격근량·체지방량(모두 kg, 한 축). 값이 없는 측정일은 건너뛰고 앞뒤 점을 잇는다. */
function TrendChart({ entries }: { entries: BodyComposition[] }) {
  const c = useChartColors();
  const data = entries.map((b) => ({
    label: formatShortDate(b.measuredOn),
    weight: b.weightKg,
    muscle: b.skeletalMuscleKg,
    fat: b.fatMassKg == null ? null : Math.round(b.fatMassKg * 10) / 10,
  }));
  const series = [
    { key: 'weight', name: '체중', color: c.weight },
    { key: 'muscle', name: '골격근량', color: c.muscle },
    { key: 'fat', name: '체지방량', color: c.fat },
  ];
  return (
    <div
      className={styles.chart}
      role="img"
      aria-label="체중, 골격근량, 체지방량 추이 선 차트. 아래 측정 기록 표에 같은 값이 있습니다."
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: c.axis }} tick={{ fill: c.muted, fontSize: 12 }} />
          <YAxis tickLine={false} axisLine={false} tick={{ fill: c.muted, fontSize: 12 }} width={44} domain={['auto', 'auto']} />
          <Tooltip
            formatter={(value, name) => [`${formatGram(Number(value))} kg`, String(name)]}
            contentStyle={{ borderRadius: 14, border: `1px solid ${c.border}`, background: c.surface, color: c.text, fontSize: 13 }}
            labelStyle={{ color: c.text, fontWeight: 700 }}
            cursor={{ stroke: c.axis, strokeWidth: 1 }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} formatter={(v) => <span style={{ color: c.text }}>{v}</span>} />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color}
              strokeWidth={2}
              dot={{ r: 4, strokeWidth: 2, stroke: c.surface, fill: s.color }}
              activeDot={{ r: 6, strokeWidth: 2, stroke: c.surface }}
              connectNulls
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
