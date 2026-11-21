import { useId, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useExternalFoods, useImportFood } from '../api/hooks';
import type { ExternalFood, Food, MfdsKind } from '../api/types';
import { formatAmount, formatGram, formatKcal } from '../lib/format';
import ui from '../styles/ui.module.css';
import { Empty, ErrorState, errorMessage, Loading } from './QueryState';
import styles from './ExternalFoodSearch.module.css';

interface Props {
  onImported: (food: Food) => void;
}

const KINDS: { value: MfdsKind; label: string }[] = [
  { value: 'GENERIC', label: '일반 식품·음식' },
  { value: 'BRAND', label: '브랜드 상품' },
  { value: 'ALL', label: '전체' },
];

const NUTRIENT_LABEL = { carbsG: '탄수화물', proteinG: '단백질', fatG: '지방' } as const;
const MAX_QUERY = 50;

/** 식약처 식품영양성분DB 검색 → 고른 식품을 내 음식으로 가져와 바로 선택. */
export function ExternalFoodSearch({ onImported }: Props) {
  const [text, setText] = useState('');
  const [kind, setKind] = useState<MfdsKind>('GENERIC');
  const [search, setSearch] = useState({ q: '', kind: 'GENERIC' as MfdsKind, page: 0 });
  const [status, setStatus] = useState('');
  const [importError, setImportError] = useState('');
  const result = useExternalFoods(search.q, search.page, search.kind);
  const importFood = useImportFood();
  const inputId = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setStatus('');
    setImportError('');
    setSearch({ q: text.trim(), kind, page: 0 });
  };

  const pick = (item: ExternalFood) => {
    setStatus('');
    setImportError('');
    importFood.mutate(item.externalCode, {
      onSuccess: (food) => {
        setStatus(`'${food.name}'을(를) 내 음식에 추가하고 선택했어요.`);
        onImported(food);
      },
      onError: (err) => {
        setImportError(errorMessage(err));
        // 서버 보관 기간이 지난 검색 결과는 다시 조회한다
        if (err instanceof ApiError && err.code === 'MFDS_SEARCH_EXPIRED') void result.refetch();
      },
    });
  };

  const data = result.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 1;

  return (
    <div className={styles.wrap}>
      <form className={ui.form} onSubmit={submit} role="search" aria-label="식약처 식품영양성분DB 검색">
        <div className={styles.searchRow}>
          <div className={ui.field}>
            <label htmlFor={inputId}>식약처 DB 검색어</label>
            <input
              id={inputId}
              type="search"
              className={ui.input}
              placeholder="예: 현미밥, 닭가슴살"
              value={text}
              maxLength={MAX_QUERY}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <button type="submit" className={ui.secondary} disabled={text.trim() === ''}>
            검색
          </button>
        </div>
        <fieldset className={ui.fieldset}>
          <legend>검색 범위</legend>
          <div className={ui.choices}>
            {KINDS.map((k) => (
              <label key={k.value} className={ui.choice}>
                <input
                  type="radio"
                  name={inputId + '-kind'}
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => {
                    setKind(k.value);
                    if (search.q) setSearch({ q: search.q, kind: k.value, page: 0 });
                  }}
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      {search.q === '' ? null : result.isPending ? (
        <Loading label="식약처 DB에서 찾는 중…" />
      ) : result.isError ? (
        <ErrorState error={result.error} onRetry={() => result.refetch()} />
      ) : result.data.items.length === 0 ? (
        <Empty>
          {`'${search.q}' 검색 결과가 없어요.`}
          {search.kind !== 'ALL' && ' 검색 범위를 바꿔 보세요.'}
        </Empty>
      ) : (
        <>
          <p className={ui.hint} aria-live="polite">
            {`전체 ${result.data.totalElements.toLocaleString('ko-KR')}건 · 이름이 가까운 순으로 정렬(페이지 안에서)`}
            {result.data.excluded > 0 && ` · 영양 정보가 부족한 ${result.data.excluded}건 제외`}
          </p>
          <ul className={styles.results} aria-label="식약처 DB 검색 결과">
            {result.data.items.map((f) => (
              <li key={f.externalCode} className={styles.item}>
                <div className={styles.main}>
                  <div className={styles.name}>
                    {f.name}
                    {f.dbClassName && <span className={ui.badge}>{f.dbClassName}</span>}
                  </div>
                  <div className={styles.meta}>
                    {f.category && `${f.category} · `}
                    100g당 {formatKcal(f.kcal)} kcal · 탄 {formatGram(f.carbsG)} · 단 {formatGram(f.proteinG)} · 지{' '}
                    {formatGram(f.fatG)}g
                    {f.servingGrams != null && ` · 1인분 ${formatAmount(f.servingGrams)}g`}
                  </div>
                  {f.volumeBased && (
                    <div className={styles.note}>원본은 {f.basisLabel} 기준 · 1mL ≈ 1g으로 계산해요</div>
                  )}
                  {f.missingNutrients.length > 0 && (
                    <div className={styles.note}>
                      {f.missingNutrients.map((n) => NUTRIENT_LABEL[n]).join('·')} 정보 없음(0으로 계산)
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className={`${ui.secondary} ${ui.small}`}
                  onClick={() => pick(f)}
                  disabled={importFood.isPending}
                  aria-label={`${f.name} ${f.importedFoodId != null ? '선택' : '가져와서 선택'}`}
                >
                  {f.importedFoodId != null ? '선택' : '가져와서 선택'}
                </button>
              </li>
            ))}
          </ul>
          {totalPages > 1 && (
            <div className={styles.pager}>
              <button
                type="button"
                className={`${ui.secondary} ${ui.small}`}
                onClick={() => setSearch((s) => ({ ...s, page: Math.max(0, s.page - 1) }))}
                disabled={search.page === 0 || result.isFetching}
              >
                이전
              </button>
              <span className={ui.muted}>
                {search.page + 1} / {totalPages.toLocaleString('ko-KR')}
              </span>
              <button
                type="button"
                className={`${ui.secondary} ${ui.small}`}
                onClick={() => setSearch((s) => ({ ...s, page: s.page + 1 }))}
                disabled={search.page + 1 >= totalPages || result.isFetching}
              >
                다음
              </button>
            </div>
          )}
        </>
      )}

      {importError && (
        <p className={ui.formError} role="alert">
          {importError}
        </p>
      )}
      <p className={ui.status} role="status">
        {status}
      </p>
      <p className={styles.source}>
        출처: 식품의약품안전처 식품영양성분DB(공공데이터포털). 값은 참고용 추정치예요.
      </p>
    </div>
  );
}
