import { useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useCreateFood } from '../api/hooks';
import type { Food } from '../api/types';
import ui from '../styles/ui.module.css';
import { Field } from './Field';

interface Props {
  onCreated: (food: Food) => void;
}

const EMPTY = {
  name: '',
  kcal: '',
  carbsG: '',
  proteinG: '',
  fatG: '',
  servingGrams: '',
  sugarsG: '',
  sodiumMg: '',
  saturatedFatG: '',
};
/** 선택 입력(비우면 '정보 없음') */
const OPTIONAL = ['sugarsG', 'sodiumMg', 'saturatedFatG'] as const;
type Key = keyof typeof EMPTY;

/** 사용자 음식 등록(100g 기준). */
export function CustomFoodForm({ onCreated }: Props) {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('');
  const create = useCreateFood();

  const set = (k: Key) => (e: React.ChangeEvent<HTMLInputElement>) => setV((p) => ({ ...p, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setStatus('');
    const errs: Record<string, string> = {};
    if (!v.name.trim()) errs.name = '이름을 입력해 주세요.';
    for (const k of ['kcal', 'carbsG', 'proteinG', 'fatG'] as const) {
      if (v[k] === '' || !(Number(v[k]) >= 0)) errs[k] = '0 이상의 숫자를 입력해 주세요.';
    }
    if (v.servingGrams !== '' && !(Number(v.servingGrams) > 0 && Number(v.servingGrams) <= 5000)) {
      errs.servingGrams = '0 초과 5000 이하로 입력해 주세요.';
    }
    for (const k of OPTIONAL) {
      if (v[k] !== '' && !(Number(v[k]) >= 0)) errs[k] = '0 이상의 숫자를 입력해 주세요.';
    }
    if (v.sugarsG !== '' && Number(v.sugarsG) > Number(v.carbsG)) errs.sugarsG = '당류는 탄수화물보다 많을 수 없어요.';
    if (v.saturatedFatG !== '' && Number(v.saturatedFatG) > Number(v.fatG)) {
      errs.saturatedFatG = '포화지방은 지방보다 많을 수 없어요.';
    }
    setErrors(errs);
    if (Object.keys(errs).length) return;

    create.mutate(
      {
        name: v.name.trim(),
        kcal: Number(v.kcal),
        carbsG: Number(v.carbsG),
        proteinG: Number(v.proteinG),
        fatG: Number(v.fatG),
        servingGrams: v.servingGrams === '' ? null : Number(v.servingGrams),
        sugarsG: v.sugarsG === '' ? null : Number(v.sugarsG),
        sodiumMg: v.sodiumMg === '' ? null : Number(v.sodiumMg),
        saturatedFatG: v.saturatedFatG === '' ? null : Number(v.saturatedFatG),
      },
      {
        onSuccess: (food) => {
          setV(EMPTY);
          setStatus(`'${food.name}'을(를) 등록하고 선택했어요.`);
          onCreated(food);
        },
        onError: (err) => {
          if (err instanceof ApiError) setErrors(err.fieldErrors);
        },
      },
    );
  };

  return (
    <form className={ui.form} onSubmit={submit} noValidate aria-label="음식 직접 등록">
      <p className={ui.hint}>영양 정보는 포장지 등을 참고해 100g 기준으로 입력하세요.</p>
      <Field label="음식 이름" value={v.name} onChange={set('name')} maxLength={100} error={errors.name} required />
      <div className={ui.row}>
        <Field label="칼로리 (kcal/100g)" type="number" inputMode="decimal" min={0} step="0.01" value={v.kcal} onChange={set('kcal')} error={errors.kcal} required />
        <Field label="탄수화물 (g/100g)" type="number" inputMode="decimal" min={0} step="0.01" value={v.carbsG} onChange={set('carbsG')} error={errors.carbsG} required />
        <Field label="단백질 (g/100g)" type="number" inputMode="decimal" min={0} step="0.01" value={v.proteinG} onChange={set('proteinG')} error={errors.proteinG} required />
        <Field label="지방 (g/100g)" type="number" inputMode="decimal" min={0} step="0.01" value={v.fatG} onChange={set('fatG')} error={errors.fatG} required />
      </div>
      <fieldset className={ui.fieldset}>
        <legend>줄여야 할 영양소 (선택, 100g 기준)</legend>
        <p className={ui.hint}>비워 두면 '정보 없음'으로 저장되고 당류·나트륨 합계에서 빠져요.</p>
        <div className={ui.row}>
          <Field label="당류 (g)" type="number" inputMode="decimal" min={0} step="0.01" value={v.sugarsG} onChange={set('sugarsG')} error={errors.sugarsG} />
          <Field label="나트륨 (mg)" type="number" inputMode="decimal" min={0} step="0.01" value={v.sodiumMg} onChange={set('sodiumMg')} error={errors.sodiumMg} />
          <Field label="포화지방 (g)" type="number" inputMode="decimal" min={0} step="0.01" value={v.saturatedFatG} onChange={set('saturatedFatG')} error={errors.saturatedFatG} />
        </div>
      </fieldset>
      <Field
        label="1인분 중량 (g, 선택)"
        hint="입력하면 식단 기록 시 인분 단위를 쓸 수 있어요."
        type="number"
        inputMode="decimal"
        min={0.1}
        max={5000}
        step="0.1"
        value={v.servingGrams}
        onChange={set('servingGrams')}
        error={errors.servingGrams}
      />
      {create.isError && !(create.error instanceof ApiError && Object.keys(create.error.fieldErrors).length) && (
        <p className={ui.formError} role="alert">
          {create.error instanceof ApiError ? create.error.message : '등록하지 못했어요.'}
        </p>
      )}
      <div className={ui.actions}>
        <button type="submit" className={ui.secondary} disabled={create.isPending}>
          {create.isPending ? '등록 중…' : '음식 등록'}
        </button>
      </div>
      <p className={ui.status} role="status">
        {status}
      </p>
    </form>
  );
}
