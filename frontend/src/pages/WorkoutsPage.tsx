import { useEffect, useId, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useDeleteWorkout, useExercises, useProfile, useSaveWorkout, useSummary, useWorkouts } from '../api/hooks';
import {
  BODY_PARTS,
  ENERGY_SYSTEMS,
  EQUIPMENT,
  INTENSITIES,
  MINUTES_PER_SET,
  energyLabel,
  equipmentLabel,
  type BodyPart,
  type EnergySystem,
  type Equipment,
  type Intensity,
  type Exercise,
  type WorkoutEntry,
  type WorkoutInput,
} from '../api/types';
import { ExerciseMotion } from '../components/ExerciseMotion';
import { MuscleMap } from '../components/MuscleMap';
import { DateNav } from '../components/DateNav';
import { Field } from '../components/Field';
import { Empty, ErrorState, Loading, errorMessage } from '../components/QueryState';
import { formatAmount, formatKcal } from '../lib/format';
import { useSelectedDate } from '../lib/useSelectedDate';
import { estimateKcal, metForSpeed, workoutBasis, workoutDetail } from '../lib/workout';
import ui from '../styles/ui.module.css';
import meals from './MealsPage.module.css';
import styles from './WorkoutsPage.module.css';

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
          <p className={ui.subtitle}>
            무산소(헬스)는 세트·횟수·무게로, 유산소와 무산소+유산소 운동은 시간과 강도(체감 강도·거리·속도)로 기록해요. 칼로리는 휴식 대사를 포함한 추정치예요.
          </p>
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
              weightKg={editing?.weightKgSnapshot ?? profile.data?.weightKg ?? null}
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
              <span className={meals.total}>
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
                    <div className={ui.itemName}>
                      {w.nameSnapshot}
                      <span className={styles.badge}>{energyLabel(w.energySystem)}</span>
                    </div>
                    <div className={ui.itemMeta}>{workoutDetail(w)}</div>
                    <div className={ui.itemMeta}>
                      {workoutBasis(w)} · 기록 당시 체중 {formatAmount(w.weightKgSnapshot)}kg
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
          <div className={`${ui.info} ${ui.spaced}`}>
            <p className={ui.hint}>
              • 헬스: 들어 올린 무게로 칼로리를 구하는 검증된 식은 없어서, 세트 수로 운동 시간(1세트 ≈ 수행+휴식{' '}
              {MINUTES_PER_SET}분)을 추정해 MET로 계산해요. 무게·횟수는 볼륨(세트×횟수×무게) 기록용이에요.
            </p>
            <p className={ui.hint}>• 유산소·무산소+유산소: MET × 3.5 × 체중(kg) ÷ 200 × 분. MET는 체감 강도(가볍게·보통·힘들게)로 정해요.</p>
            <p className={ui.hint}>
              • 걷기·달리기·자전거·수영·로잉머신은 거리나 속도를 넣으면 평균 속도에 맞는 MET를 써요(예: 달리기 시속 8km ≈
              MET 8.3, 10km ≈ 10).
            </p>
            <p className={ui.hint}>
              • 운동 소모량은 섭취 목표에 자동으로 더하지 않아요. 활동계수에 이미 운동이 포함되어 있을 수 있어요.
            </p>
          </div>
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

/** 종목 선택값: 헬스면 'GYM', 그 밖의 운동은 운동 ID */
type Sport = 'GYM' | number;
/** 시간 운동의 강도 기준 */
type Basis = 'LEVEL' | 'DISTANCE' | 'SPEED';

function WorkoutForm(props: FormProps) {
  const exercises = useExercises();
  if (exercises.isPending) return <Loading label="운동 목록을 불러오는 중…" />;
  if (exercises.isError) return <ErrorState error={exercises.error} onRetry={() => exercises.refetch()} />;
  if (exercises.data.length === 0) return <Empty>등록된 운동이 없어요.</Empty>;
  return <WorkoutFormInner {...props} exercises={exercises.data} />;
}

function WorkoutFormInner({ date, editing, weightKg, onDone, onCancel, exercises }: FormProps & { exercises: Exercise[] }) {
  const save = useSaveWorkout();
  const gymAll = exercises.filter((x) => x.kind === 'STRENGTH');
  const timeAll = exercises.filter((x) => x.kind === 'TIME');
  const editingIsGym = editing?.mode === 'SETS';
  const editingExercise = editing ? exercises.find((x) => x.id === editing.exerciseId) : undefined;

  const [category, setCategory] = useState<EnergySystem>(
    editingExercise ? (editingIsGym && editingExercise.energySystem === 'MIXED' ? 'ANAEROBIC' : editingExercise.energySystem) : 'ANAEROBIC',
  );
  const [sport, setSport] = useState<Sport>(editing ? (editingIsGym ? 'GYM' : editing.exerciseId) : 'GYM');
  const [part, setPart] = useState<BodyPart>(editing?.bodyPart ?? 'CHEST');
  const [gymId, setGymId] = useState<number | null>(editingIsGym ? editing!.exerciseId : null);
  const [equip, setEquip] = useState<Equipment | 'ALL'>('ALL');
  const [sets, setSets] = useState(editing?.sets != null ? String(editing.sets) : '3');
  const [reps, setReps] = useState(editing?.reps != null ? String(editing.reps) : '10');
  const [lifted, setLifted] = useState(editing?.liftedKg != null ? String(editing.liftedKg) : '');
  const [minutes, setMinutes] = useState(editing?.minutes != null ? String(editing.minutes) : editing ? '' : '30');
  const [basis, setBasis] = useState<Basis>(
    editing?.mode === 'DISTANCE' ? 'DISTANCE' : editing?.intensityBasis === 'SPEED' ? 'SPEED' : editing?.intensityBasis === 'DISTANCE' ? 'DISTANCE' : 'LEVEL',
  );
  const [level, setLevel] = useState<Intensity>(editing?.intensity ?? 'MODERATE');
  const [km, setKm] = useState(editing?.distanceKm != null ? String(editing.distanceKm) : '');
  const [speed, setSpeed] = useState(editing?.speedKmh != null ? String(editing.speedKmh) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const name = useId();

  // 유형별 종목: 무산소 = 헬스 + 요가·필라테스, 무산소+유산소 = 헬스(점프·스윙 등) + 구기·격투 종목
  const gym = category === 'MIXED' ? gymAll.filter((x) => x.energySystem === 'MIXED') : category === 'ANAEROBIC' ? gymAll : [];
  const others = timeAll.filter((x) => x.energySystem === category);
  const chooseCategory = (c: EnergySystem) => {
    setCategory(c);
    const hasGym = c === 'ANAEROBIC' || gymAll.some((x) => x.energySystem === 'MIXED');
    const first = timeAll.find((x) => x.energySystem === c);
    setSport(c === 'ANAEROBIC' && hasGym ? 'GYM' : (first?.id ?? 'GYM'));
    setErrors({});
  };

  const isGym = sport === 'GYM';
  const sportExercise = isGym ? null : (timeAll.find((x) => x.id === sport) ?? null);
  const gymParts = BODY_PARTS.filter((p) => gym.some((x) => x.bodyPart === p.value));
  const activePart = gymParts.some((p) => p.value === part) ? part : (gymParts[0]?.value ?? part);
  const inPart = gym.filter((x) => x.bodyPart === activePart);
  const partEquipment = EQUIPMENT.filter((e) => inPart.some((x) => x.equipment === e.value));
  const partExercises = equip === 'ALL' ? inPart : inPart.filter((x) => x.equipment === equip);
  // 부위나 도구를 바꾸면 목록의 첫 종목이 선택된 상태로 시작한다
  const gymExercise = partExercises.find((x) => x.id === gymId) ?? partExercises[0] ?? null;
  const choosePart = (p: BodyPart) => {
    setPart(p);
    setEquip('ALL');
  };

  const canPace = (sportExercise?.speedMetCurve.length ?? 0) > 0;
  const effectiveBasis: Basis = canPace ? basis : 'LEVEL';

  const n = (s: string) => (s.trim() === '' ? NaN : Number(s));
  const m = n(minutes);
  // 거리·속도 중 입력한 쪽으로 나머지를 계산한다
  const pace =
    effectiveBasis === 'DISTANCE'
      ? n(km) > 0 && m > 0
        ? { speed: Math.round(((n(km) * 60) / m) * 100) / 100, km: n(km) }
        : null
      : effectiveBasis === 'SPEED'
        ? n(speed) > 0 && m > 0
          ? { speed: n(speed), km: Math.round(((n(speed) * m) / 60) * 100) / 100 }
          : null
        : null;
  const levelMet = (x: Exercise, i: Intensity) => (i === 'LIGHT' ? x.metLight : i === 'VIGOROUS' ? x.metVigorous : x.met) ?? x.met;
  const timeMet = sportExercise
    ? effectiveBasis === 'LEVEL'
      ? levelMet(sportExercise, level)
      : pace && metForSpeed(sportExercise.speedMetCurve, pace.speed)
    : null;
  const estimate = isGym
    ? gymExercise && estimateKcal({ mode: 'SETS', met: gymExercise.met, sets: n(sets) || 0 }, weightKg)
    : timeMet != null
      ? estimateKcal({ mode: 'TIME', met: timeMet, minutes: m || 0 }, weightKg)
      : null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    let input: WorkoutInput | null = null;
    if (isGym) {
      const s = n(sets);
      const r = n(reps);
      const l = n(lifted);
      if (!gymExercise) errs.exerciseId = '운동 종목을 선택해 주세요.';
      if (!(Number.isInteger(s) && s >= 1 && s <= 50)) errs.sets = '1~50 사이 정수로 입력해 주세요.';
      if (!(Number.isInteger(r) && r >= 1 && r <= 100)) errs.reps = '1~100 사이 정수로 입력해 주세요.';
      if (!(l >= 0 && l <= 500)) errs.liftedKg = '0~500kg으로 입력해 주세요. 맨몸 운동은 0이에요.';
      if (gymExercise) input = { date, exerciseId: gymExercise.id, mode: 'SETS', sets: s, reps: r, liftedKg: Math.round(l * 10) / 10 };
    } else {
      if (!sportExercise) errs.exerciseId = '종목을 선택해 주세요.';
      if (!(Number.isInteger(m) && m >= 1 && m <= 1440)) errs.minutes = '1~1440분 사이 정수로 입력해 주세요.';
      if (effectiveBasis === 'DISTANCE' && !(n(km) > 0 && n(km) <= 300)) errs.distanceKm = '0보다 크고 300km 이하로 입력해 주세요.';
      if (effectiveBasis === 'SPEED' && !(n(speed) >= 0.5 && n(speed) <= 80)) errs.speedKmh = '시속 0.5~80km로 입력해 주세요.';
      if (!errs.distanceKm && !errs.speedKmh && !errs.minutes && pace && !(pace.speed >= 0.5 && pace.speed <= 80))
        errs[effectiveBasis === 'DISTANCE' ? 'distanceKm' : 'speedKmh'] =
          `시간에 비해 거리가 맞지 않아요. 평균 시속 ${formatAmount(pace.speed)}km예요.`;
      if (sportExercise) {
        const base = { date, exerciseId: sportExercise.id, mode: 'TIME' as const, minutes: m };
        input =
          effectiveBasis === 'LEVEL'
            ? { ...base, intensity: level }
            : effectiveBasis === 'DISTANCE'
              ? { ...base, distanceKm: Math.round(n(km) * 100) / 100 }
              : { ...base, speedKmh: Math.round(n(speed) * 100) / 100 };
      }
    }
    setErrors(errs);
    if (Object.keys(errs).length || !input) return;
    save.mutate(
      { id: editing?.id, input },
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
  const shown = isGym ? gymExercise : sportExercise;

  return (
    <form className={ui.form} onSubmit={submit} noValidate aria-label={editing ? '운동 수정' : '운동 추가'}>
      <div className={styles.parts3} role="radiogroup" aria-label="운동 유형">
        {ENERGY_SYSTEMS.map((c) => (
          <label key={c.value} className={styles.part}>
            <input type="radio" name={name + '-cat'} checked={category === c.value} onChange={() => chooseCategory(c.value)} />
            {c.label}
          </label>
        ))}
      </div>

      <fieldset className={styles.group}>
        <legend className={styles.legend}>종목</legend>
        <div className={styles.chips}>
          {gym.length > 0 && (
            <label className={`${styles.chip} ${styles.gymChip}`}>
              <input type="radio" name={name + '-sport'} checked={isGym} onChange={() => setSport('GYM')} />
              헬스
            </label>
          )}
          {others.map((x) => (
            <label key={x.id} className={styles.chip}>
              <input type="radio" name={name + '-sport'} checked={sport === x.id} onChange={() => setSport(x.id)} />
              {x.name}
            </label>
          ))}
        </div>
      </fieldset>

      {shown?.motion && (
        <ExerciseMotion
          key={shown.id}
          name={shown.name}
          motion={shown.motion}
          equipment={shown.equipment}
          primary={shown.primaryMuscles}
          secondary={shown.secondaryMuscles}
        />
      )}

      {isGym ? (
        <>
          <fieldset className={styles.group}>
            <legend className={styles.legend}>부위</legend>
            <div className={styles.parts}>
              {gymParts.map((p) => (
                <label key={p.value} className={styles.part}>
                  <input type="radio" name={name + '-part'} checked={activePart === p.value} onChange={() => choosePart(p.value)} />
                  {p.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className={styles.gymPick}>
            <fieldset className={`${styles.group} ${styles.picker}`}>
              <legend className={styles.legend}>
                운동 <span className={styles.count}>{partExercises.length}개</span>
              </legend>
              {partEquipment.length > 1 && (
                <div className={styles.equipments} role="radiogroup" aria-label="도구">
                  {[{ value: 'ALL' as const, label: '전체' }, ...partEquipment].map((e) => (
                    <label key={e.value} className={styles.equipment}>
                      <input type="radio" name={name + '-equip'} checked={equip === e.value} onChange={() => setEquip(e.value)} />
                      {e.label}
                    </label>
                  ))}
                </div>
              )}
              {partExercises.length === 0 ? (
                <p className={ui.hint}>이 부위의 운동이 없어요.</p>
              ) : (
                <div className={styles.exerciseList}>
                  {partExercises.map((x) => (
                    <label key={x.id} className={styles.exercise}>
                      <input type="radio" name={name + '-gym'} checked={gymExercise?.id === x.id} onChange={() => setGymId(x.id)} />
                      <span>{x.name}</span>
                      <span className={styles.met}>
                        {x.equipment ? `${equipmentLabel(x.equipment)} · ` : ''}MET {formatAmount(x.met)}
                        {x.energySystem === 'MIXED' && ' · 무산소+유산소'}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              {errors.exerciseId && <p className={ui.fieldError}>{errors.exerciseId}</p>}
            </fieldset>
            {gymExercise && (
              <MuscleMap name={gymExercise.name} primary={gymExercise.primaryMuscles} secondary={gymExercise.secondaryMuscles} />
            )}
          </div>

          <div className={styles.row3}>
            <Field label="세트" type="number" inputMode="numeric" min={1} max={50} value={sets} onChange={(e) => setSets(e.target.value)} error={errors.sets} required />
            <Field label="횟수 (회)" type="number" inputMode="numeric" min={1} max={100} value={reps} onChange={(e) => setReps(e.target.value)} error={errors.reps} required />
            <Field label="무게 (kg)" type="number" inputMode="decimal" min={0} max={500} step="0.5" value={lifted} onChange={(e) => setLifted(e.target.value)} error={errors.liftedKg} placeholder="맨몸 0" required />
          </div>
          {n(sets) > 0 && n(reps) > 0 && n(lifted) >= 0 && (
            <p className={ui.hint} data-testid="volume">
              볼륨 {formatKcal(n(sets) * n(reps) * n(lifted))}kg · 약 {formatAmount(n(sets) * MINUTES_PER_SET)}분 추정
            </p>
          )}
        </>
      ) : (
        <>
          <Field label="시간 (분)" type="number" inputMode="numeric" min={1} max={1440} step={1} value={minutes} onChange={(e) => setMinutes(e.target.value)} error={errors.minutes} required />
          {canPace && (
            <div className={styles.modes} role="radiogroup" aria-label="강도 기준">
              {(
                [
                  ['LEVEL', '체감 강도'],
                  ['DISTANCE', '거리'],
                  ['SPEED', '속도'],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className={styles.mode}>
                  <input type="radio" name={name + '-basis'} checked={basis === v} onChange={() => setBasis(v)} />
                  {label}
                </label>
              ))}
            </div>
          )}
          {effectiveBasis === 'LEVEL' && sportExercise && (
            <div className={styles.levels} role="radiogroup" aria-label="강도">
              {INTENSITIES.map((i) => (
                <label key={i.value} className={styles.level}>
                  <input type="radio" name={name + '-level'} checked={level === i.value} onChange={() => setLevel(i.value)} />
                  <span>{i.label}</span>
                  <span className={styles.met}>MET {formatAmount(levelMet(sportExercise, i.value))}</span>
                </label>
              ))}
            </div>
          )}
          {effectiveBasis === 'DISTANCE' && (
            <Field label="거리 (km)" type="number" inputMode="decimal" min={0.01} max={300} step="0.01" value={km} onChange={(e) => setKm(e.target.value)} error={errors.distanceKm} required />
          )}
          {effectiveBasis === 'SPEED' && (
            <Field label="속도 (km/h)" type="number" inputMode="decimal" min={0.5} max={80} step="0.1" value={speed} onChange={(e) => setSpeed(e.target.value)} error={errors.speedKmh} required />
          )}
          {effectiveBasis !== 'LEVEL' && pace && timeMet != null && (
            <p className={ui.hint} data-testid="pace">
              {effectiveBasis === 'DISTANCE' ? `평균 시속 ${formatAmount(pace.speed)}km` : `거리 약 ${formatAmount(pace.km)}km`} · 속도 기준 MET{' '}
              {formatAmount(timeMet)}
            </p>
          )}
          {!canPace && sportExercise && <p className={ui.hint}>{sportExercise.name}은(는) 시간과 체감 강도로 기록해요.</p>}
          {errors.intensity && <p className={ui.fieldError}>{errors.intensity}</p>}
        </>
      )}

      <p className={styles.estimate} data-testid="estimate">
        {estimate != null ? (
          <>
            예상 소모 <strong>{formatKcal(estimate)} kcal</strong>
            {weightKg != null && <span> · 체중 {formatAmount(weightKg)}kg 기준</span>}
          </>
        ) : (
          '값을 입력하면 예상 소모 칼로리를 보여 드려요.'
        )}
      </p>
      {editing && (
        <p className={ui.hint}>
          수정해도 기록 당시 체중({formatAmount(editing.weightKgSnapshot)}kg)을 유지하고, 종목이나 강도를 바꿀 때만 새 MET를 적용해요.
        </p>
      )}
      {(errors.mode || showFormError) && (
        <p className={ui.formError} role="alert">
          {errors.mode ?? errorMessage(apiError)}
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
