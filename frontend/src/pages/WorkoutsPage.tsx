import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useDeleteWorkout, useExercises, useProfile, useSaveWorkout, useSummary, useWorkouts } from '../api/hooks';
import type { WorkoutEntry } from '../api/types';
import { DateNav } from '../components/DateNav';
import { Field } from '../components/Field';
import { Empty, ErrorState, Loading, errorMessage } from '../components/QueryState';
import { formatAmount, formatKcal } from '../lib/format';
import { useSelectedDate } from '../lib/useSelectedDate';
import ui from '../styles/ui.module.css';
import styles from './MealsPage.module.css';

export function WorkoutsPage() {
  const [date, setDate] = useSelectedDate();
  const workouts = useWorkouts(date);
  const summary = useSummary(date);
  const profile = useProfile();
  const del = useDeleteWorkout();
  const [editing, setEditing] = useState<WorkoutEntry | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => setEditing(null), [date]);

  const remove = (w: WorkoutEntry) => {
    if (!window.confirm(`'${w.nameSnapshot}' 기록을 삭제할까요?`)) return;
    del.mutate(w.id, {
      onSuccess: () => {
        if (editing?.id === w.id) setEditing(null);
        setStatus('운동 기록을 삭제했어요.');
      },
      onError: (e) => setStatus(errorMessage(e)),
    });
  };

  const noProfile = profile.isSuccess && profile.data == null;

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>운동</h1>
          <p className={ui.subtitle}>MET × 3.5 × 체중(kg) ÷ 200 × 분으로 계산한, 휴식 대사를 포함한 총 소모 추정치예요.</p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>

      <div className={ui.grid2}>
        <section className={ui.card} aria-labelledby="workout-form-title">
          <h2 id="workout-form-title" className={ui.cardTitle}>
            {editing ? '운동 수정' : '운동 추가'}
          </h2>
          {noProfile && !editing ? (
            <p className={ui.notice}>
              운동 칼로리는 프로필 체중으로 계산해요. 먼저 <Link to={`/settings?date=${date}`}>설정</Link>에서 프로필을
              저장해 주세요.
            </p>
          ) : (
            <WorkoutForm
              key={editing?.id ?? 'new'}
              date={date}
              editing={editing}
              weightKg={profile.data?.weightKg ?? null}
              onDone={(msg) => {
                setEditing(null);
                setStatus(msg);
              }}
              onCancel={() => setEditing(null)}
            />
          )}
        </section>

        <section className={ui.card} aria-labelledby="workout-list-title">
          <h2 id="workout-list-title" className={ui.cardTitle}>
            기록
            {summary.isSuccess && (
              <span className={styles.total}>
                {summary.data.exerciseMinutes}분 · {formatKcal(summary.data.exerciseKcal)} kcal
              </span>
            )}
          </h2>
          <p className={ui.status} role="status">
            {status}
          </p>
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
                    <div className={ui.itemMeta}>
                      {w.minutes}분 · MET {formatAmount(w.metSnapshot)} · 기록 당시 체중 {formatAmount(w.weightKgSnapshot)}kg
                    </div>
                  </div>
                  <div className={ui.itemRight}>
                    <span className={ui.itemKcal}>{formatKcal(w.calculatedKcal)} kcal</span>
                    <div className={ui.actions}>
                      <button
                        type="button"
                        className={`${ui.secondary} ${ui.small}`}
                        onClick={() => setEditing(w)}
                        aria-label={`${w.nameSnapshot} 기록 수정`}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        className={`${ui.secondary} ${ui.small} ${ui.dangerText}`}
                        onClick={() => remove(w)}
                        disabled={del.isPending}
                        aria-label={`${w.nameSnapshot} 기록 삭제`}
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <p className={`${ui.info} ${ui.spaced}`}>
            운동 소모량은 섭취 목표에 자동으로 더하지 않아요. 설정의 활동계수에 이미 운동이 포함되어 있을 수 있으니
            중복 계산에 유의하세요.
          </p>
        </section>
      </div>
    </div>
  );
}

interface FormProps {
  date: string;
  editing: WorkoutEntry | null;
  weightKg: number | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}

function WorkoutForm({ date, editing, weightKg, onDone, onCancel }: FormProps) {
  const exercises = useExercises();
  const save = useSaveWorkout();
  const [exerciseId, setExerciseId] = useState<string>(editing ? String(editing.exerciseId) : '');
  const [minutes, setMinutes] = useState(editing ? String(editing.minutes) : '30');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const selectId = useId();

  useEffect(() => {
    if (!exerciseId && exercises.data?.[0]) setExerciseId(String(exercises.data[0].id));
  }, [exercises.data, exerciseId]);

  if (exercises.isPending) return <Loading label="운동 목록을 불러오는 중…" />;
  if (exercises.isError) return <ErrorState error={exercises.error} onRetry={() => exercises.refetch()} />;
  if (exercises.data.length === 0) return <Empty>등록된 운동이 없어요. demo 프로필로 실행하면 샘플 운동이 추가돼요.</Empty>;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const m = Number(minutes);
    if (!exerciseId) errs.exerciseId = '운동을 선택해 주세요.';
    if (minutes === '' || !Number.isInteger(m) || m < 1 || m > 1440) errs.minutes = '1~1440분 사이 정수로 입력해 주세요.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    save.mutate(
      { id: editing?.id, input: { date, exerciseId: Number(exerciseId), minutes: m } },
      {
        onSuccess: () => onDone(editing ? '운동을 수정했어요.' : '운동을 추가했어요.'),
        onError: (err) => {
          if (err instanceof ApiError) setErrors(err.fieldErrors);
        },
      },
    );
  };

  const apiError = save.error;
  const showFormError = save.isError && !(apiError instanceof ApiError && Object.keys(apiError.fieldErrors).length);

  return (
    <form className={ui.form} onSubmit={submit} noValidate aria-label={editing ? '운동 수정' : '운동 추가'}>
      <div className={ui.field}>
        <label htmlFor={selectId}>운동 종류</label>
        <select
          id={selectId}
          className={ui.input}
          value={exerciseId}
          onChange={(e) => setExerciseId(e.target.value)}
          aria-invalid={errors.exerciseId ? true : undefined}
        >
          {exercises.data.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} · MET {formatAmount(x.met)}
              {x.source === 'DEMO' ? ' (샘플)' : ''}
            </option>
          ))}
        </select>
        {errors.exerciseId && <p className={ui.fieldError}>{errors.exerciseId}</p>}
      </div>
      <Field
        label="시간 (분)"
        type="number"
        inputMode="numeric"
        min={1}
        max={1440}
        step={1}
        value={minutes}
        onChange={(e) => setMinutes(e.target.value)}
        error={errors.minutes}
        required
      />
      <p className={ui.hint}>
        {editing
          ? `수정해도 기록 당시 체중(${formatAmount(editing.weightKgSnapshot)}kg)을 유지하고, 운동 종류를 바꿀 때만 새 MET를 적용해요.`
          : weightKg != null
            ? `현재 프로필 체중 ${formatAmount(weightKg)}kg이 이 기록에 저장돼요.`
            : ''}
      </p>
      {showFormError && (
        <p className={ui.formError} role="alert">
          {errorMessage(apiError)}
          {apiError instanceof ApiError && apiError.code === 'PROFILE_REQUIRED' && (
            <>
              {' '}
              <Link to={`/settings?date=${date}`}>설정으로 이동</Link>
            </>
          )}
        </p>
      )}
      <div className={ui.actions}>
        <button type="submit" className={ui.button} disabled={save.isPending}>
          {save.isPending ? '저장 중…' : editing ? '수정 저장' : '운동 추가'}
        </button>
        {editing && (
          <button type="button" className={ui.secondary} onClick={onCancel}>
            취소
          </button>
        )}
      </div>
    </form>
  );
}
