import { useId, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { useBarcodeLookup, useExternalFoods, useImportFood } from '../api/hooks';
import type { BarcodeLookup, ExternalFood, Food, MfdsKind } from '../api/types';
import { formatAmount, formatGram, formatKcal } from '../lib/format';
import ui from '../styles/ui.module.css';
import { Empty, ErrorState, errorMessage, Loading } from './QueryState';
import styles from './ExternalFoodSearch.module.css';

interface Props {
  onImported: (food: Food) => void;
}

type Mode = 'name' | 'barcode';

const KINDS: { value: MfdsKind; label: string }[] = [
  { value: 'GENERIC', label: '일반 식품·음식' },
  { value: 'BRAND', label: '브랜드·외식 메뉴' },
  { value: 'ALL', label: '전체' },
];

const NUTRIENT_LABEL = { carbsG: '탄수화물', proteinG: '단백질', fatG: '지방' } as const;
const MAX_QUERY = 50;
const MAX_MAKER = 30;
const BARCODE = /^\d{8,14}$/;

const MATCH_NOTE: Record<BarcodeLookup['match'], string> = {
  REPORT_NO: '품목제조보고번호로 연결된 영양정보예요.',
  NAME: '제품명으로 찾은 후보예요. 같은 제품인지 확인하고 골라 주세요.',
  NO_NUTRITION: '제품은 찾았지만 식약처 영양성분DB에 없어요. 이름 검색이나 직접 입력을 이용해 주세요.',
  NOT_FOUND: '이 바코드로 등록된 제품을 찾지 못했어요. 숫자를 다시 확인해 주세요.',
};

/** 식약처 식품영양성분DB(이름·브랜드) 또는 바코드(식품안전나라)로 찾아 내 음식으로 가져와 바로 선택. */
export function ExternalFoodSearch({ onImported }: Props) {
  const [mode, setMode] = useState<Mode>('name');
  const [status, setStatus] = useState('');
  const [importError, setImportError] = useState('');
  const importFood = useImportFood();
  const id = useId();

  const pick = (item: ExternalFood, refetch: () => unknown) => {
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
        if (err instanceof ApiError && err.code === 'MFDS_SEARCH_EXPIRED') void refetch();
      },
    });
  };

  const reset = () => {
    setStatus('');
    setImportError('');
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.modes} role="radiogroup" aria-label="찾는 방법">
        {(
          [
            ['name', '이름·브랜드'],
            ['barcode', '바코드'],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className={styles.mode}>
            <input
              type="radio"
              name={id + '-mode'}
              value={value}
              checked={mode === value}
              onChange={() => {
                setMode(value);
                reset();
              }}
            />
            {label}
          </label>
        ))}
      </div>

      {mode === 'name' ? (
        <NameSearch onPick={pick} onSubmit={reset} busy={importFood.isPending} />
      ) : (
        <BarcodeSearch onPick={pick} onSubmit={reset} busy={importFood.isPending} />
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
        출처: 식품의약품안전처 식품영양성분DB(공공데이터포털)
        {mode === 'barcode' && ' · 바코드 제품정보는 식품안전나라'}. 값은 참고용 추정치예요.
      </p>
    </div>
  );
}

interface SearchProps {
  onPick: (item: ExternalFood, refetch: () => unknown) => void;
  onSubmit: () => void;
  busy: boolean;
}

function NameSearch({ onPick, onSubmit, busy }: SearchProps) {
  const [text, setText] = useState('');
  const [maker, setMaker] = useState('');
  const [kind, setKind] = useState<MfdsKind>('GENERIC');
  const [search, setSearch] = useState({ q: '', maker: '', kind: 'GENERIC' as MfdsKind, page: 0 });
  const result = useExternalFoods(search.q, search.page, search.kind, search.maker);
  const id = useId();
  const active = search.q !== '' || search.maker !== '';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
    const m = maker.trim();
    // 일반 식품(품목대표)에는 업체명이 없으므로 브랜드를 넣으면 브랜드·외식 범위로 찾는다
    const k = m && kind === 'GENERIC' ? 'BRAND' : kind;
    setKind(k);
    setSearch({ q: text.trim(), maker: m, kind: k, page: 0 });
  };

  const data = result.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.totalElements / data.size)) : 1;
  const label = [search.q && `'${search.q}'`, search.maker && `브랜드 '${search.maker}'`].filter(Boolean).join(' · ');

  return (
    <>
      <form className={ui.form} onSubmit={submit} role="search" aria-label="식약처 식품영양성분DB 검색">
        <div className={styles.searchRow}>
          <div className={ui.field}>
            <label htmlFor={id}>식약처 DB 검색어</label>
            <input
              id={id}
              type="search"
              className={ui.input}
              placeholder="예: 현미밥, 불고기버거"
              value={text}
              maxLength={MAX_QUERY}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className={ui.field}>
            <label htmlFor={id + '-maker'}>브랜드 (선택)</label>
            <input
              id={id + '-maker'}
              type="search"
              className={ui.input}
              placeholder="예: 맥도날드, 농심"
              value={maker}
              maxLength={MAX_MAKER}
              onChange={(e) => setMaker(e.target.value)}
            />
          </div>
          <button type="submit" className={ui.secondary} disabled={text.trim() === '' && maker.trim() === ''}>
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
                  name={id + '-kind'}
                  value={k.value}
                  checked={kind === k.value}
                  onChange={() => {
                    setKind(k.value);
                    if (active) setSearch({ ...search, kind: k.value, page: 0 });
                  }}
                />
                {k.label}
              </label>
            ))}
          </div>
        </fieldset>
      </form>

      {!active ? null : result.isPending ? (
        <Loading label="식약처 DB에서 찾는 중…" />
      ) : result.isError ? (
        <ErrorState error={result.error} onRetry={() => result.refetch()} />
      ) : result.data.items.length === 0 ? (
        <Empty>
          {`${label} 검색 결과가 없어요.`}
          {search.kind !== 'ALL' && ' 검색 범위를 바꿔 보세요.'}
        </Empty>
      ) : (
        <>
          <p className={ui.hint} aria-live="polite">
            {`전체 ${result.data.totalElements.toLocaleString('ko-KR')}건`}
            {search.q && ' · 이름이 가까운 순으로 정렬(페이지 안에서)'}
            {result.data.excluded > 0 && ` · 영양 정보가 부족한 ${result.data.excluded}건 제외`}
          </p>
          <ResultList
            label="식약처 DB 검색 결과"
            items={result.data.items}
            busy={busy}
            onPick={(f) => onPick(f, () => result.refetch())}
          />
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
    </>
  );
}

function BarcodeSearch({ onPick, onSubmit, busy }: SearchProps) {
  const [text, setText] = useState('');
  const [code, setCode] = useState('');
  const [invalid, setInvalid] = useState(false);
  const result = useBarcodeLookup(code);
  const id = useId();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
    const digits = text.replace(/[\s-]/g, '');
    if (!BARCODE.test(digits)) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setCode(digits);
  };

  return (
    <>
      <form className={ui.form} onSubmit={submit} role="search" aria-label="바코드로 찾기">
        <div className={styles.searchRow}>
          <div className={ui.field}>
            <label htmlFor={id}>바코드 번호</label>
            <input
              id={id}
              className={ui.input}
              inputMode="numeric"
              autoComplete="off"
              placeholder="포장지 바코드 아래 숫자 13자리"
              value={text}
              maxLength={20}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? id + '-err' : undefined}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <button type="submit" className={ui.secondary} disabled={text.trim() === ''}>
            조회
          </button>
        </div>
        {invalid && (
          <p id={id + '-err'} className={ui.formError}>
            바코드는 숫자 8~14자리로 입력해 주세요.
          </p>
        )}
      </form>

      {code === '' || invalid ? null : result.isPending ? (
        <Loading label="바코드 제품을 찾는 중…" />
      ) : result.isError ? (
        <ErrorState error={result.error} onRetry={() => result.refetch()} />
      ) : (
        <>
          {result.data.product && (
            <div className={styles.product} aria-label="바코드 제품">
              <div className={styles.name}>{result.data.product.productName ?? '이름 없음'}</div>
              <div className={styles.meta}>
                {[result.data.product.makerName, result.data.product.category, result.data.barcode]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          )}
          <p className={result.data.match === 'REPORT_NO' ? ui.hint : styles.matchNote} aria-live="polite">
            {MATCH_NOTE[result.data.match]}
          </p>
          {result.data.items.length > 0 && (
            <ResultList
              label="바코드 영양정보 후보"
              items={result.data.items}
              busy={busy}
              onPick={(f) => onPick(f, () => result.refetch())}
            />
          )}
        </>
      )}
    </>
  );
}

function ResultList({
  label,
  items,
  busy,
  onPick,
}: {
  label: string;
  items: ExternalFood[];
  busy: boolean;
  onPick: (f: ExternalFood) => void;
}) {
  return (
    <ul className={styles.results} aria-label={label}>
      {items.map((f) => (
        <li key={f.externalCode} className={styles.item}>
          <div className={styles.main}>
            <div className={styles.name}>
              {f.name}
              {f.restaurant ? (
                <span className={`${ui.badge} ${styles.dine}`}>외식</span>
              ) : (
                f.dbClassName && <span className={ui.badge}>{f.dbClassName}</span>
              )}
            </div>
            <div className={styles.meta}>
              {f.category && `${f.category} · `}
              100g당 {formatKcal(f.kcal)} kcal · 탄 {formatGram(f.carbsG)} · 단 {formatGram(f.proteinG)} · 지{' '}
              {formatGram(f.fatG)}g
              {f.servingGrams != null && ` · 1인분 ${formatAmount(f.servingGrams)}g`}
            </div>
            {f.volumeBased && <div className={styles.note}>원본은 {f.basisLabel} 기준 · 1mL ≈ 1g으로 계산해요</div>}
            {f.missingNutrients.length > 0 && (
              <div className={styles.note}>
                {f.missingNutrients.map((n) => NUTRIENT_LABEL[n]).join('·')} 정보 없음(0으로 계산)
              </div>
            )}
          </div>
          <button
            type="button"
            className={`${ui.secondary} ${ui.small}`}
            onClick={() => onPick(f)}
            disabled={busy}
            aria-label={`${f.name} ${f.importedFoodId != null ? '선택' : '가져와서 선택'}`}
          >
            {f.importedFoodId != null ? '선택' : '가져와서 선택'}
          </button>
        </li>
      ))}
    </ul>
  );
}
