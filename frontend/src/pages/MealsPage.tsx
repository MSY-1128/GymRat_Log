import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useDeleteMeal, useMeals, useSaveMeal, useSummary } from '../api/hooks';
import { MEAL_TYPES, type MealEntry, type MealType } from '../api/types';
import { CustomFoodForm } from '../components/CustomFoodForm';
import { DateNav } from '../components/DateNav';
import { Field } from '../components/Field';
import { FoodPicker, type PickedFood } from '../components/FoodPicker';
import { Empty, ErrorState, Loading, errorMessage } from '../components/QueryState';
import { formatAmount, formatGram, formatKcal } from '../lib/format';
import { useSelectedDate } from '../lib/useSelectedDate';
import ui from '../styles/ui.module.css';
import styles from './MealsPage.module.css';

type Unit = 'g' | 'serving';

export function MealsPage() {
  const [date, setDate] = useSelectedDate();
  const meals = useMeals(date);
  const summary = useSummary(date);
  const del = useDeleteMeal();
  const [editing, setEditing] = useState<MealEntry | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => setEditing(null), [date]);

  const remove = (m: MealEntry) => {
    if (!window.confirm(`'${m.foodNameSnapshot}' 기록을 삭제할까요?`)) return;
    del.mutate(m.id, {
      onSuccess: () => {
        if (editing?.id === m.id) setEditing(null);
        setStatus('식단 기록을 삭제했어요.');
      },
      onError: (e) => setStatus(errorMessage(e)),
    });
  };

  return (
    <div className={ui.page}>
      <div className={ui.pageHeader}>
        <div>
          <h1 className={ui.title}>식단</h1>
          <p className={ui.subtitle}>음식을 검색하거나 직접 등록해 기록하세요. 영양값은 100g 기준입니다.</p>
        </div>
        <DateNav date={date} onChange={setDate} />
      </div>

      <div className={ui.grid2}>
        <div className={ui.page}>
          <section className={ui.card} aria-labelledby="meal-form-title">
            <h2 id="meal-form-title" className={ui.cardTitle}>
              {editing ? '식단 수정' : '식단 추가'}
            </h2>
            <MealForm
              key={editing?.id ?? 'new'}
              date={date}
              editing={editing}
              onDone={(msg) => {
                setEditing(null);
                setStatus(msg);
              }}
              onCancel={() => setEditing(null)}
            />
          </section>
        </div>

        <section className={ui.card} aria-labelledby="meal-list-title">
          <h2 id="meal-list-title" className={ui.cardTitle}>
            기록
            {summary.isSuccess && (
              <span className={styles.total} data-testid="meal-total">
                합계 {formatKcal(summary.data.consumedKcal)} kcal
              </span>
            )}
          </h2>
          <p className={ui.status} role="status">
            {status}
          </p>
          {meals.isPending ? (
            <Loading />
          ) : meals.isError ? (
            <ErrorState error={meals.error} onRetry={() => meals.refetch()} />
          ) : meals.data.length === 0 ? (
            <Empty>아직 기록이 없어요.</Empty>
          ) : (
            <div className={styles.groups}>
              {MEAL_TYPES.map(({ value, label }) => {
                const items = meals.data.filter((m) => m.mealType === value);
                if (!items.length) return null;
                return (
                  <div key={value}>
                    <h3 className={styles.groupTitle}>
                      {label}
                    </h3>
                    <ul className={ui.list}>
                      {items.map((m) => (
                        <li key={m.id} className={ui.item}>
                          <div className={ui.itemMain}>
                            <div className={ui.itemName}>{m.foodNameSnapshot}</div>
                            <div className={ui.itemMeta}>
                              {formatAmount(m.grams)}g · 탄 {formatGram(m.carbsG)} · 단 {formatGram(m.proteinG)} · 지{' '}
                              {formatGram(m.fatG)}g
                            </div>
                          </div>
                          <div className={ui.itemRight}>
                            <span className={ui.itemKcal}>{formatKcal(m.calculatedKcal)} kcal</span>
                            <div className={ui.actions}>
                              <button
                                type="button"
                                className={`${ui.secondary} ${ui.small}`}
                                onClick={() => setEditing(m)}
                                aria-label={`${m.foodNameSnapshot} 기록 수정`}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className={`${ui.secondary} ${ui.small} ${ui.dangerText}`}
                                onClick={() => remove(m)}
                                disabled={del.isPending}
                                aria-label={`${m.foodNameSnapshot} 기록 삭제`}
                              >
                                삭제
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {summary.isSuccess && (
                <p className={styles.macroLine}>
                  탄수화물 {formatGram(summary.data.carbsG)}g · 단백질 {formatGram(summary.data.proteinG)}g · 지방{' '}
                  {formatGram(summary.data.fatG)}g
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

interface MealFormProps {
  date: string;
  editing: MealEntry | null;
  onDone: (message: string) => void;
  onCancel: () => void;
}

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 10) return 'BREAKFAST';
  if (h < 15) return 'LUNCH';
  if (h < 21) return 'DINNER';
  return 'SNACK';
}

function MealForm({ date, editing, onDone, onCancel }: MealFormProps) {
  const save = useSaveMeal();
  const [food, setFood] = useState<PickedFood | null>(
    editing ? { id: editing.foodId, name: editing.foodNameSnapshot, servingGrams: null } : null,
  );
  const [mealType, setMealType] = useState<MealType>(editing?.mealType ?? defaultMealType());
  const [amount, setAmount] = useState(editing ? String(editing.grams) : '100');
  const [unit, setUnit] = useState<Unit>('g');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const mealTypeId = useId();
  const unitId = useId();
  const firstRef = useRef<HTMLDivElement>(null);

  const servingGrams = food?.servingGrams ?? null;
  const effectiveUnit: Unit = unit === 'serving' && servingGrams != null ? 'serving' : 'g';

  useEffect(() => {
    if (editing) firstRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [editing]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!food) errs.foodId = '음식을 선택해 주세요.';
    const n = Number(amount);
    const grams = Math.round((effectiveUnit === 'serving' && servingGrams != null ? n * servingGrams : n) * 10) / 10;
    if (amount === '' || !Number.isFinite(n) || !(grams > 0)) errs.grams = '0보다 커야 합니다.';
    else if (grams > 5000) errs.grams = '5000g 이하여야 합니다.';
    setErrors(errs);
    if (Object.keys(errs).length || !food) return;

    save.mutate(
      { id: editing?.id, input: { date, mealType, foodId: food.id, grams } },
      {
        onSuccess: () => onDone(editing ? '식단을 수정했어요.' : '식단을 추가했어요.'),
        onError: (err) => {
          if (err instanceof ApiError) setErrors(err.fieldErrors);
        },
      },
    );
  };

  const apiError = save.error;
  const showFormError = save.isError && !(apiError instanceof ApiError && Object.keys(apiError.fieldErrors).length);

  return (
    <>
    <form className={ui.form} onSubmit={submit} noValidate aria-label={editing ? '식단 수정' : '식단 추가'}>
      <div ref={firstRef}>
        <FoodPicker
          selected={food}
          onSelect={(f) => {
            setFood(f);
            if (f.servingGrams == null) setUnit('g');
          }}
          error={errors.foodId}
        />
      </div>
      <div className={ui.field}>
        <label htmlFor={mealTypeId}>식사 구분</label>
        <select
          id={mealTypeId}
          className={ui.input}
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType)}
        >
          {MEAL_TYPES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>
      <div className={ui.row}>
        <Field
          label={effectiveUnit === 'serving' ? '섭취량 (인분)' : '섭취량 (g)'}
          type="number"
          inputMode="decimal"
          min={0.1}
          max={effectiveUnit === 'serving' ? undefined : 5000}
          step="0.1"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.grams}
          hint={
            effectiveUnit === 'serving' && servingGrams != null && Number(amount) > 0
              ? `= ${formatAmount(Math.round(Number(amount) * servingGrams * 10) / 10)}g`
              : undefined
          }
          required
        />
        <div className={ui.field}>
          <label htmlFor={unitId}>단위</label>
          <select
            id={unitId}
            className={ui.input}
            value={effectiveUnit}
            onChange={(e) => setUnit(e.target.value as Unit)}
            disabled={servingGrams == null}
            aria-describedby={servingGrams == null ? unitId + '-hint' : undefined}
          >
            <option value="g">g</option>
            {servingGrams != null && <option value="serving">인분 ({formatAmount(servingGrams)}g)</option>}
          </select>
          {servingGrams == null && (
            <p id={unitId + '-hint'} className={ui.hint}>
              인분은 1인분 중량이 있는 음식만 가능해요.
            </p>
          )}
        </div>
      </div>
      {showFormError && (
        <p className={ui.formError} role="alert">
          {errorMessage(apiError)}
        </p>
      )}
      <div className={ui.actions}>
        <button type="submit" className={ui.button} disabled={save.isPending}>
          {save.isPending ? '저장 중…' : editing ? '수정 저장' : '식단 추가'}
        </button>
        {editing && (
          <button type="button" className={ui.secondary} onClick={onCancel}>
            취소
          </button>
        )}
      </div>
      {editing && <p className={ui.hint}>기존 기록은 저장 당시의 음식 영양값을 유지합니다. 음식을 바꾸면 새 값이 적용돼요.</p>}
    </form>
    <details className={styles.custom}>
      <summary>찾는 음식이 없나요? 직접 등록하기</summary>
      <div className={styles.customBody}>
        <CustomFoodForm
          onCreated={(f) => {
            setFood(f);
            setUnit(f.servingGrams != null ? 'serving' : 'g');
            if (f.servingGrams != null) setAmount('1');
          }}
        />
      </div>
    </details>
    </>
  );
}
