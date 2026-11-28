import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useSaveBodyComposition } from '../api/hooks';
import { SEGMENTS, type BodyComposition, type BodyCompositionInput, type SegmentValues } from '../api/types';
import { todayString } from '../lib/date';
import ui from '../styles/ui.module.css';
import { Field } from './Field';
import { errorMessage } from './QueryState';
import styles from './InbodyForm.module.css';

/** 입력 칸 하나. key는 서버 필드 경로(부위별은 segmentalLean.rightArm 형태). */
interface Spec {
  key: string;
  label: string;
  min: number;
  max: number;
  /** 소수 자릿수(0이면 정수) */
  digits: number;
  hint?: string;
}

/** 인바디 결과지 순서 그대로 묶은 입력 항목. 범위는 서버 검증과 같다. */
export const SHEET: { key: string; title: string; note?: string; fields: Spec[]; optionalGroup?: boolean }[] = [
  {
    key: 'composition',
    title: '체성분분석',
    note: '체수분 + 단백질 + 무기질 + 체지방량 = 체중이에요. 넷 다 넣으면 합이 맞는지 확인해요.',
    fields: [
      { key: 'bodyWaterL', label: '체수분 (L)', min: 10, max: 150, digits: 1 },
      { key: 'proteinKg', label: '단백질 (kg)', min: 1, max: 40, digits: 1 },
      { key: 'mineralKg', label: '무기질 (kg)', min: 0.5, max: 15, digits: 2 },
      { key: 'bodyFatMassKg', label: '체지방량 (kg)', min: 1, max: 250, digits: 1 },
    ],
  },
  {
    key: 'muscleFat',
    title: '골격근·지방분석 · 비만분석',
    note: '체지방률과 체지방량은 하나만 넣어도 나머지를 계산해요.',
    fields: [
      { key: 'skeletalMuscleKg', label: '골격근량 (kg)', min: 5, max: 100, digits: 1 },
      { key: 'bodyFatPct', label: '체지방률 (%)', min: 3, max: 70, digits: 1 },
    ],
  },
  {
    key: 'segmentalLean',
    title: '부위별 근육분석 (kg)',
    optionalGroup: true,
    fields: SEGMENTS.map((s) => ({
      key: `segmentalLean.${s.key}`,
      label: s.label,
      min: s.key === 'trunk' ? 1 : s.key.endsWith('Arm') ? 0.1 : 0.5,
      max: s.key === 'trunk' ? 120 : s.key.endsWith('Arm') ? 30 : 50,
      digits: s.key === 'trunk' ? 1 : 2,
    })),
  },
  {
    key: 'segmentalFat',
    title: '부위별 체지방분석 (kg)',
    optionalGroup: true,
    fields: SEGMENTS.map((s) => ({
      key: `segmentalFat.${s.key}`,
      label: s.label,
      min: 0,
      max: s.key === 'trunk' ? 150 : s.key.endsWith('Arm') ? 40 : 60,
      digits: 1,
    })),
  },
  {
    key: 'research',
    title: '연구항목',
    fields: [
      { key: 'measuredBmrKcal', label: '기초대사량 (kcal)', min: 500, max: 5000, digits: 0 },
      { key: 'visceralFatLevel', label: '내장지방 레벨', min: 1, max: 30, digits: 0 },
      { key: 'ecwRatio', label: '세포외수분비', min: 0.3, max: 0.5, digits: 3, hint: '예: 0.380' },
      { key: 'waistHipRatio', label: '복부지방률', min: 0.5, max: 1.5, digits: 2, hint: '예: 0.85' },
      { key: 'inbodyScore', label: '인바디 점수', min: 0, max: 100, digits: 0 },
    ],
  },
];

const ALL_FIELDS = SHEET.flatMap((g) => g.fields);

/** 기록 → 입력 칸 값. 서버가 계산해 채운 값(체지방률·체지방량)도 그대로 보여 준다. */
function initialValues(b: BodyComposition | null): Record<string, string> {
  const v: Record<string, string> = {};
  const str = (n: number | null | undefined) => (n == null ? '' : String(n));
  for (const f of ALL_FIELDS) {
    if (!b) {
      v[f.key] = '';
      continue;
    }
    const [head, seg] = f.key.split('.');
    if (seg) {
      const values = head === 'segmentalLean' ? b.segmentalLean : b.segmentalFat;
      v[f.key] = str(values?.[seg as keyof SegmentValues]);
    } else {
      const source: Record<string, number | null> = { ...b, bodyFatMassKg: b.fatMassKg } as unknown as Record<
        string,
        number | null
      >;
      v[f.key] = str(source[f.key]);
    }
  }
  return v;
}

/** 소수 자릿수에 맞춰 반올림(정형화). */
const roundTo = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

export function InbodyForm({
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
  const [weight, setWeight] = useState(editing ? String(editing.weightKg) : '');
  const [values, setValues] = useState(() => initialValues(editing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasSegments =
    ALL_FIELDS.some((f) => f.key.startsWith('segmental') && values[f.key]) ||
    Object.keys(errors).some((k) => k.startsWith('segmental'));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    const w = weight.trim() === '' ? null : Number(weight);
    if (!date) errs.measuredOn = '측정일을 입력해 주세요.';
    if (w == null || !(w >= 30 && w <= 350)) errs.weightKg = '30~350kg 사이로 입력해 주세요.';
    const parsed: Record<string, number | null> = {};
    for (const f of ALL_FIELDS) {
      const raw = (values[f.key] ?? '').trim();
      if (raw === '') {
        parsed[f.key] = null;
        continue;
      }
      const n = Number(raw);
      if (!Number.isFinite(n) || n < f.min || n > f.max || (f.digits === 0 && !Number.isInteger(n))) {
        errs[f.key] = `${f.min}~${f.max}${f.digits === 0 ? ' 사이 정수' : ''}로 입력하거나 비워 두세요.`;
      } else {
        parsed[f.key] = roundTo(n, f.digits);
      }
    }
    // 서버도 검사하지만(제지방량 기준 등) 바로 알 수 있는 것은 먼저 알려 준다
    const muscle = parsed.skeletalMuscleKg;
    if (w != null && muscle != null && !errs.skeletalMuscleKg && muscle >= w) {
      errs.skeletalMuscleKg = '골격근량은 체중보다 작아야 해요.';
    }
    const fatMass = parsed.bodyFatMassKg;
    if (w != null && fatMass != null && !errs.bodyFatMassKg && fatMass >= w) {
      errs.bodyFatMassKg = '체지방량은 체중보다 작아야 해요.';
    }
    setErrors(errs);
    if (Object.keys(errs).length || w == null) return;

    const seg = (prefix: string): SegmentValues => ({
      rightArm: parsed[`${prefix}.rightArm`] ?? null,
      leftArm: parsed[`${prefix}.leftArm`] ?? null,
      trunk: parsed[`${prefix}.trunk`] ?? null,
      rightLeg: parsed[`${prefix}.rightLeg`] ?? null,
      leftLeg: parsed[`${prefix}.leftLeg`] ?? null,
    });
    const p = (k: string) => parsed[k] ?? null;
    const input: BodyCompositionInput = {
      measuredOn: date,
      weightKg: roundTo(w, 1),
      bodyWaterL: p('bodyWaterL'),
      proteinKg: p('proteinKg'),
      mineralKg: p('mineralKg'),
      bodyFatMassKg: p('bodyFatMassKg'),
      skeletalMuscleKg: p('skeletalMuscleKg'),
      bodyFatPct: p('bodyFatPct'),
      segmentalLean: seg('segmentalLean'),
      segmentalFat: seg('segmentalFat'),
      measuredBmrKcal: p('measuredBmrKcal'),
      visceralFatLevel: p('visceralFatLevel'),
      ecwRatio: p('ecwRatio'),
      waistHipRatio: p('waistHipRatio'),
      inbodyScore: p('inbodyScore'),
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

  const group = (g: (typeof SHEET)[number]) => (
    <fieldset key={g.key} className={styles.group}>
      <legend>{g.title}</legend>
      {g.note && <p className={ui.hint}>{g.note}</p>}
      <div className={g.key.startsWith('segmental') ? styles.segments : styles.fields}>
        {g.fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            type="number"
            inputMode={f.digits === 0 ? 'numeric' : 'decimal'}
            min={f.min}
            max={f.max}
            step={f.digits === 0 ? 1 : 1 / 10 ** f.digits}
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            error={errors[f.key]}
            hint={f.hint}
            placeholder="선택"
          />
        ))}
      </div>
      {errors[g.key] && <p className={ui.fieldError}>{errors[g.key]}</p>}
    </fieldset>
  );

  return (
    <form className={ui.form} onSubmit={submit} noValidate aria-label={editing ? '체성분 수정' : '체성분 기록'}>
      <div className={ui.row}>
        <Field label="측정일" type="date" max={todayString()} value={date} onChange={(e) => setDate(e.target.value)} error={errors.measuredOn} required />
        <Field label="체중 (kg)" type="number" inputMode="decimal" min={30} max={350} step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} error={errors.weightKg} required />
      </div>
      {SHEET.filter((g) => !g.optionalGroup).slice(0, 2).map(group)}
      <details className={styles.more} open={hasSegments || undefined}>
        <summary>부위별 분석 입력 (결과지에 있으면)</summary>
        <div className={styles.moreBody}>{SHEET.filter((g) => g.optionalGroup).map(group)}</div>
      </details>
      {SHEET.filter((g) => g.key === 'research').map(group)}
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
        같은 날은 한 번만 기록돼요. 단위는 결과지와 같고(체수분 L, 나머지 kg), 소수 자릿수는 저장할 때 맞춰요.{' '}
        <Link to="/settings">설정</Link>의 성별·나이·키로 국제 기준 판정을 해요.
      </p>
    </form>
  );
}
