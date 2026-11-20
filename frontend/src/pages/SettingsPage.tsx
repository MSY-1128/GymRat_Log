import { useId, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useProfile, useSaveProfile } from '../api/hooks';
import type { Goal, Profile, SexForFormula } from '../api/types';
import { Field } from '../components/Field';
import { ErrorState, Loading, errorMessage } from '../components/QueryState';
import { formatKcal } from '../lib/format';
import ui from '../styles/ui.module.css';

const ACTIVITY = [
  { value: 1.2, label: '1.2 · 거의 움직이지 않음 (주로 앉아서 생활)' },
  { value: 1.375, label: '1.375 · 가벼운 활동 (주 1~3회 운동)' },
  { value: 1.55, label: '1.55 · 보통 활동 (주 3~5회 운동)' },
  { value: 1.725, label: '1.725 · 많은 활동 (주 6~7회 운동)' },
  { value: 1.9, label: '1.9 · 매우 많은 활동 (고강도·육체 노동)' },
];

const GOALS: { value: Goal; label: string }[] = [
  { value: 'LOSE', label: '감량' },
  { value: 'MAINTAIN', label: '유지' },
  { value: 'GAIN', label: '증량' },
];

const SEXES: { value: SexForFormula | ''; label: string }[] = [
  { value: 'MALE', label: '남성 계산식 (+5)' },
  { value: 'FEMALE', label: '여성 계산식 (−161)' },
  { value: '', label: '선택 안 함' },
];

export function SettingsPage() {
  const profile = useProfile();

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>설정</h1>
          <p className={ui.subtitle}>성인 참고용 프로필입니다. 입력 범위는 검증용이며 건강 권장 범위가 아니에요.</p>
        </div>
      </div>
      {profile.isPending ? (
        <Loading label="프로필을 불러오는 중…" />
      ) : profile.isError ? (
        <ErrorState error={profile.error} onRetry={() => profile.refetch()} />
      ) : (
        <div className={ui.grid2}>
          <section className={ui.card} aria-labelledby="profile-title">
            <h2 id="profile-title" className={ui.cardTitle}>
              프로필
            </h2>
            <ProfileForm profile={profile.data} />
          </section>
          <section className={ui.card} aria-labelledby="calc-title">
            <h2 id="calc-title" className={ui.cardTitle}>
              계산 결과와 설명
            </h2>
            {profile.data == null ? (
              <p className={ui.notice}>아직 저장된 프로필이 없어요. 저장하면 서버가 BMR/TDEE를 계산해요.</p>
            ) : profile.data.bmrKcal == null ? (
              <p className={ui.info}>계산식용 성별을 선택하지 않아 BMR/TDEE를 계산하지 않았어요.</p>
            ) : (
              <dl className={ui.list}>
                <div className={ui.item}>
                  <dt>BMR (기초대사량)</dt>
                  <dd className={ui.itemKcal} data-testid="bmr">
                    {formatKcal(profile.data.bmrKcal)} kcal
                  </dd>
                </div>
                <div className={ui.item}>
                  <dt>TDEE (BMR × 활동계수 {profile.data.activityFactor})</dt>
                  <dd className={ui.itemKcal}>{formatKcal(profile.data.tdeeKcal)} kcal</dd>
                </div>
              </dl>
            )}
            <div className={`${ui.info} ${ui.spaced}`}>
              <p className={ui.hint}>
                • BMR은 Mifflin-St Jeor 참고식(10×체중kg + 6.25×키cm − 5×나이 + 상수)으로 계산합니다. “계산식용 성별”은
                이 상수(남성 +5, 여성 −161)를 고르기 위한 값일 뿐이며, 선택하지 않으면 BMR/TDEE를 표시하지 않아요.
              </p>
              <p className={ui.hint}>
                • 목표(감량/유지/증량)는 기록용이며, 하루 섭취 목표 칼로리는 직접 입력해요. 앱이 자동으로 정하지
                않아요.
              </p>
              <p className={ui.hint}>
                • 운동 소모량은 섭취 목표에 자동으로 더하지 않아요. 활동계수에 이미 운동이 포함될 수 있어 중복 계산에
                유의하세요.
              </p>
              <p className={ui.hint}>• 운동 기록은 저장 시점의 체중을 사용하므로, 체중을 바꿔도 과거 기록은 그대로예요.</p>
              <p className={ui.hint}>• 모든 수치는 참고용 추정치이며 의료적 조언이 아니에요.</p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ProfileForm({ profile }: { profile: Profile | null }) {
  const save = useSaveProfile();
  const [age, setAge] = useState(profile ? String(profile.age) : '');
  const [sex, setSex] = useState<SexForFormula | ''>(profile?.sexForFormula ?? '');
  const [height, setHeight] = useState(profile ? String(profile.heightCm) : '');
  const [weight, setWeight] = useState(profile ? String(profile.weightKg) : '');
  const [factor, setFactor] = useState(profile ? String(Number(profile.activityFactor)) : '1.2');
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? 'MAINTAIN');
  const [target, setTarget] = useState(profile?.dailyTargetKcal != null ? String(profile.dailyTargetKcal) : '');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const factorId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setStatus('');
    const errs: Record<string, string> = {};
    const n = (s: string) => (s.trim() === '' ? NaN : Number(s));
    const a = n(age);
    const h = n(height);
    const w = n(weight);
    const t = n(target);
    if (!Number.isInteger(a) || a < 19 || a > 100) errs.age = '19~100 사이 정수로 입력해 주세요.';
    if (!(h >= 100 && h <= 250)) errs.heightCm = '100~250cm 사이로 입력해 주세요.';
    if (!(w >= 30 && w <= 350)) errs.weightKg = '30~350kg 사이로 입력해 주세요.';
    if (target.trim() !== '' && !(Number.isInteger(t) && t >= 1 && t <= 10000))
      errs.dailyTargetKcal = '1~10000 사이 정수로 입력하거나 비워 두세요.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    save.mutate(
      {
        age: a,
        sexForFormula: sex === '' ? null : sex,
        heightCm: Math.round(h * 10) / 10,
        weightKg: Math.round(w * 10) / 10,
        activityFactor: Number(factor),
        goal,
        dailyTargetKcal: target.trim() === '' ? null : t,
      },
      {
        onSuccess: () => setStatus('프로필을 저장했어요.'),
        onError: (err) => {
          if (err instanceof ApiError) setErrors(err.fieldErrors);
        },
      },
    );
  };

  return (
    <form className={ui.form} onSubmit={submit} noValidate aria-label="프로필">
      <div className={ui.row}>
        <Field label="나이 (만)" type="number" inputMode="numeric" min={19} max={100} value={age} onChange={(e) => setAge(e.target.value)} error={errors.age} required />
        <Field label="섭취 목표 (kcal, 선택)" type="number" inputMode="numeric" min={1} max={10000} value={target} onChange={(e) => setTarget(e.target.value)} error={errors.dailyTargetKcal} placeholder="미설정" />
        <Field label="키 (cm)" type="number" inputMode="decimal" min={100} max={250} step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} error={errors.heightCm} required />
        <Field label="체중 (kg)" type="number" inputMode="decimal" min={30} max={350} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} error={errors.weightKg} required />
      </div>

      <fieldset className={ui.fieldset}>
        <legend>계산식용 성별</legend>
        <div className={ui.choices}>
          {SEXES.map((s) => (
            <label key={s.value || 'none'} className={ui.choice}>
              <input type="radio" name="sexForFormula" value={s.value} checked={sex === s.value} onChange={() => setSex(s.value)} />
              {s.label}
            </label>
          ))}
        </div>
        <p className={ui.hint}>BMR 계산식의 상수 선택에만 쓰여요. 선택하지 않으면 BMR/TDEE를 계산하지 않아요.</p>
      </fieldset>

      <div className={ui.field}>
        <label htmlFor={factorId}>활동계수</label>
        <select id={factorId} className={ui.input} value={factor} onChange={(e) => setFactor(e.target.value)}>
          {ACTIVITY.map((a) => (
            <option key={a.value} value={String(a.value)}>
              {a.label}
            </option>
          ))}
        </select>
        {errors.activityFactor && <p className={ui.fieldError}>{errors.activityFactor}</p>}
      </div>

      <fieldset className={ui.fieldset}>
        <legend>목표</legend>
        <div className={ui.choices}>
          {GOALS.map((g) => (
            <label key={g.value} className={ui.choice}>
              <input type="radio" name="goal" value={g.value} checked={goal === g.value} onChange={() => setGoal(g.value)} />
              {g.label}
            </label>
          ))}
        </div>
      </fieldset>

      {save.isError && !(save.error instanceof ApiError && Object.keys(save.error.fieldErrors).length) && (
        <p className={ui.formError} role="alert">
          {errorMessage(save.error)}
        </p>
      )}
      <div className={ui.actions}>
        <button type="submit" className={ui.button} disabled={save.isPending}>
          {save.isPending ? '저장 중…' : '프로필 저장'}
        </button>
      </div>
      <p className={ui.status} role="status">
        {status}
      </p>
    </form>
  );
}
