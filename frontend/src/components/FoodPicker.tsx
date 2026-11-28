import { useId, useState } from 'react';
import { useDeleteFood, useFoods } from '../api/hooks';
import type { Food } from '../api/types';
import { formatAmount, formatKcal } from '../lib/format';
import { useDebounced } from '../lib/useDebounced';
import ui from '../styles/ui.module.css';
import { Empty, ErrorState, errorMessage, Loading } from './QueryState';
import styles from './FoodPicker.module.css';

export type PickedFood = Pick<Food, 'id' | 'name' | 'servingGrams'> & Partial<Food>;

interface Props {
  selected: PickedFood | null;
  onSelect: (food: PickedFood) => void;
  /** 선택된 음식을 목록에서 지웠을 때 */
  onRemoved?: () => void;
  error?: string;
}

const MAX_QUERY = 50;

export function FoodPicker({ selected, onSelect, onRemoved, error }: Props) {
  const [text, setText] = useState('');
  const [page, setPage] = useState(0);
  const q = useDebounced(text.trim(), 300);
  const foods = useFoods(q, page);
  const inputId = useId();
  const groupName = useId();

  const del = useDeleteFood();
  const [status, setStatus] = useState('');

  /** 내 음식 목록에서 지운다. 지난 식단 기록은 남고, 식약처 음식은 DB 검색에서 다시 고르면 돌아온다. */
  const remove = (f: Food) => {
    const note = f.source === 'MFDS' ? '\n식약처 DB 검색에서 다시 고르면 돌아와요.' : '';
    if (!window.confirm(`'${f.name}'을(를) 내 음식에서 삭제할까요?\n지난 식단 기록은 그대로 남아요.${note}`)) return;
    setStatus('');
    del.mutate(f.id, {
      onSuccess: () => {
        setStatus(`'${f.name}'을(를) 내 음식에서 삭제했어요.`);
        if (selected?.id === f.id) onRemoved?.();
        // 마지막 항목을 지워 빈 페이지가 되면 앞 페이지로
        if (foods.data && foods.data.items.length === 1 && page > 0) setPage((p) => p - 1);
      },
    });
  };

  const totalPages = foods.data ? Math.max(1, Math.ceil(foods.data.totalElements / foods.data.size)) : 1;

  return (
    <div className={styles.picker}>
      <div className={ui.field}>
        <label htmlFor={inputId}>음식 검색</label>
        <input
          id={inputId}
          type="search"
          className={ui.input}
          placeholder="예: 현미밥"
          value={text}
          maxLength={MAX_QUERY}
          onChange={(e) => {
            setText(e.target.value);
            setPage(0);
          }}
          aria-invalid={error ? true : undefined}
        />
        {error && <p className={ui.fieldError}>{error}</p>}
      </div>

      {foods.isPending ? (
        <Loading label="음식을 찾는 중…" />
      ) : foods.isError ? (
        <ErrorState error={foods.error} onRetry={() => foods.refetch()} />
      ) : foods.data.items.length === 0 ? (
        <Empty>{q ? `'${q}' 검색 결과가 없어요. 아래에서 식약처 DB를 찾거나 직접 등록할 수 있어요.` : '등록된 음식이 없어요.'}</Empty>
      ) : (
        <fieldset className={ui.fieldset}>
          <legend className="visually-hidden">음식 선택 (100g 기준)</legend>
          <div className={styles.results}>
            {foods.data.items.map((f) => (
              <div key={f.id} className={styles.row}>
                <label className={styles.option}>
                  <input
                    type="radio"
                    name={groupName}
                    value={f.id}
                    checked={selected?.id === f.id}
                    onChange={() => onSelect(f)}
                  />
                  <span className={styles.optionName}>
                    {f.name}
                    {f.source === 'DEMO' && <span className={ui.badge}>DEMO</span>}
                    {f.source === 'MFDS' && <span className={ui.badge}>식약처</span>}
                  </span>
                  <span className={styles.optionMeta}>
                    {f.volumeBased ? '100mL≈g' : '100g'} {formatKcal(f.kcal)} kcal
                    {f.servingGrams != null && ` · 1인분 ${formatAmount(f.servingGrams)}g`}
                  </span>
                </label>
                {f.source !== 'DEMO' && (
                  <button
                    type="button"
                    className={`${ui.secondary} ${ui.small} ${ui.dangerText}`}
                    onClick={() => remove(f)}
                    disabled={del.isPending}
                    aria-label={`${f.name} 내 음식에서 삭제`}
                  >
                    삭제
                  </button>
                )}
              </div>
            ))}
          </div>
          {totalPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={`${ui.secondary} ${ui.small}`}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                이전
              </button>
              <span className={ui.muted} aria-live="polite">
                {page + 1} / {totalPages}
              </span>
              <button
                type="button"
                className={`${ui.secondary} ${ui.small}`}
                onClick={() => setPage((p) => p + 1)}
                disabled={page + 1 >= totalPages}
              >
                다음
              </button>
            </div>
          )}
        </fieldset>
      )}
      {selected && (
        <p className={styles.selected}>
          선택됨: <strong>{selected.name}</strong>
        </p>
      )}
      {del.isError && (
        <p className={ui.formError} role="alert">
          {errorMessage(del.error)}
        </p>
      )}
      <p className={ui.status} role="status">
        {status}
      </p>
    </div>
  );
}
