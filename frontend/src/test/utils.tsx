import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { createQueryClient } from '../api/queryClient';
import type { BarcodeLookup, BodyComposition, DailySummary, Exercise, ExternalFood, Food, MealEntry, Profile, User, WorkoutEntry } from '../api/types';

export function renderWithProviders(ui: ReactElement, route = '/') {
  const client = createQueryClient(true);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

const json = (status: number, body: unknown) =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

/** 테스트용 인메모리 API. 계산은 서버 규칙과 동일하게 흉내 낸다. */
export function createFakeServer() {
  const state = {
    /** 로그인한 사용자(null이면 로그아웃 상태). 기본은 로그인 상태. */
    user: { id: 1, username: 'tester' } as User | null,
    accounts: [{ id: 1, username: 'tester', password: 'password-123' }],
    csrfIssued: 0,
    profile: null as Profile | null,
    foods: [
      { id: 1, name: '현미밥', kcal: 150, carbsG: 32, proteinG: 3, fatG: 1, servingGrams: 210, source: 'DEMO', volumeBased: false },
      { id: 2, name: '닭가슴살', kcal: 165, carbsG: 0, proteinG: 31, fatG: 3.6, servingGrams: null, source: 'DEMO', volumeBased: false },
    ] as Food[],
    /** 식약처 DB 검색 결과(서버가 정규화한 형태) */
    external: [] as ExternalFood[],
    /** 바코드 조회 결과(서버 응답 형태) */
    barcodes: {} as Record<string, BarcodeLookup>,
    exercises: [{ id: 1, name: '달리기', met: 8, source: 'DEMO' }] as Exercise[],
    meals: [] as MealEntry[],
    workouts: [] as WorkoutEntry[],
    /** 체성분 기록(서버 응답 형태: 체지방량·제지방량 포함) */
    bodies: [] as BodyComposition[],
    nextId: 100,
    /** 특정 경로에 대해 다음 N번 강제로 실패시킨다. */
    failures: new Map<string, { count: number; status: number; body: unknown }>(),
    calls: [] as { method: string; path: string; body: unknown; csrf?: string }[],
  };

  const summary = (date: string): DailySummary => {
    const meals = state.meals.filter((m) => m.date === date);
    const ws = state.workouts.filter((w) => w.date === date);
    const consumed = meals.reduce((a, m) => a + m.calculatedKcal, 0);
    const target = state.profile?.dailyTargetKcal ?? null;
    return {
      date,
      consumedKcal: consumed,
      targetKcal: target,
      remainingKcal: target == null ? null : target - consumed,
      exerciseKcal: ws.reduce((a, w) => a + w.calculatedKcal, 0),
      exerciseMinutes: ws.reduce((a, w) => a + w.minutes, 0),
      carbsG: meals.reduce((a, m) => a + m.carbsG, 0),
      proteinG: meals.reduce((a, m) => a + m.proteinG, 0),
      fatG: meals.reduce((a, m) => a + m.fatG, 0),
    };
  };

  const bodyView = (b: Omit<BodyComposition, 'fatMassKg' | 'leanMassKg'>): BodyComposition => ({
    ...b,
    fatMassKg: b.bodyFatPct == null ? null : (b.weightKg * b.bodyFatPct) / 100,
    leanMassKg: b.bodyFatPct == null ? null : (b.weightKg * (100 - b.bodyFatPct)) / 100,
  });

  /** 서버와 같은 규칙으로 BMR 방식·제지방량·단백질 목표를 붙인다(키·몸무게 공식 값은 생략). */
  const profileView = (): Profile => {
    const p = state.profile!;
    const byDateDesc = [...state.bodies].sort((a, b) => b.measuredOn.localeCompare(a.measuredOn));
    const fat = byDateDesc.find((b) => b.leanMassKg != null) ?? null;
    const measured = byDateDesc.find((b) => b.measuredBmrKcal != null) ?? null;
    const lean = fat?.leanMassKg ?? null;
    let applied: Profile['bmrAppliedMethod'] = null;
    let bmr: number | null = null;
    let basis: string | null = null;
    if (p.bmrMethod === 'MEASURED' && measured) {
      [applied, bmr, basis] = ['MEASURED', measured.measuredBmrKcal, measured.measuredOn];
    } else if (p.bmrMethod === 'BODY_FAT' && lean != null) {
      [applied, bmr, basis] = ['BODY_FAT', 370 + 21.6 * lean, fat!.measuredOn];
    }
    return {
      ...p,
      bmrMethod: p.bmrMethod ?? 'FORMULA',
      bmrAppliedMethod: applied ?? (p.sexForFormula ? 'FORMULA' : null),
      bmrMeasuredOn: basis,
      bmrKcal: bmr,
      tdeeKcal: bmr == null ? null : bmr * p.activityFactor,
      leanMassKg: lean,
      leanMassMeasuredOn: fat?.measuredOn ?? null,
      proteinGPerKgLean: p.proteinGPerKgLean ?? null,
      proteinTargetG: p.proteinGPerKgLean != null && lean != null ? p.proteinGPerKgLean * lean : null,
    };
  };

  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace('/api/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const csrf = (init?.headers as Record<string, string> | undefined)?.['X-XSRF-TOKEN'];
    state.calls.push({ method, path, body, csrf });

    const fail = state.failures.get(`${method} ${path}`);
    if (fail && fail.count > 0) {
      fail.count -= 1;
      return json(fail.status, fail.body);
    }

    // ---- 인증 ----
    if (method === 'GET' && path === '/auth/csrf') {
      state.csrfIssued += 1;
      document.cookie = `XSRF-TOKEN=tok-${state.csrfIssued}; path=/`;
      return json(204, null);
    }
    if (method === 'GET' && path === '/auth/me') {
      return state.user ? json(200, state.user) : json(401, { code: 'UNAUTHORIZED', message: '로그인이 필요해요.' });
    }
    if (method === 'POST' && path === '/auth/login') {
      const acc = state.accounts.find(
        (a) => a.username.toLowerCase() === String(body.username).toLowerCase() && a.password === body.password,
      );
      if (!acc)
        return json(401, { code: 'INVALID_CREDENTIALS', message: '아이디 또는 비밀번호가 올바르지 않아요.', fieldErrors: {} });
      state.user = { id: acc.id, username: acc.username };
      return json(200, state.user);
    }
    if (method === 'POST' && path === '/auth/signup') {
      if (state.accounts.some((a) => a.username.toLowerCase() === String(body.username).toLowerCase()))
        return json(409, {
          code: 'USERNAME_TAKEN',
          message: '이미 사용 중인 아이디예요.',
          fieldErrors: { username: '이미 사용 중인 아이디예요.' },
        });
      const acc = { id: state.nextId++, username: body.username, password: body.password };
      state.accounts.push(acc);
      state.user = { id: acc.id, username: acc.username };
      return json(201, state.user);
    }
    if (method === 'POST' && path === '/auth/logout') {
      state.user = null;
      return json(204, null);
    }
    if (!state.user) return json(401, { code: 'UNAUTHORIZED', message: '로그인이 필요해요.' });

    const date = url.searchParams.get('date') ?? '';
    if (method === 'GET' && path === '/profile') return state.profile ? json(200, profileView()) : json(204, null);
    if (method === 'GET' && path === '/summary') return json(200, summary(date));
    if (method === 'GET' && path === '/meals') return json(200, state.meals.filter((m) => m.date === date));
    if (method === 'GET' && path === '/workouts') return json(200, state.workouts.filter((w) => w.date === date));
    if (method === 'GET' && path === '/exercises') return json(200, state.exercises);
    if (method === 'GET' && path === '/foods') {
      const q = url.searchParams.get('q') ?? '';
      const items = state.foods.filter((f) => f.name.includes(q));
      return json(200, { items, page: 0, size: 10, totalElements: items.length });
    }
    if (method === 'GET' && path === '/foods/external') {
      const q = url.searchParams.get('q') ?? '';
      const maker = url.searchParams.get('maker') ?? '';
      const items = state.external.filter((f) => f.name.includes(q) && (f.makerName ?? '').includes(maker));
      return json(200, { items, page: 0, size: 20, totalElements: items.length, excluded: 0 });
    }
    if (method === 'GET' && path.startsWith('/foods/barcode/')) {
      const code = path.slice('/foods/barcode/'.length);
      const hit = state.barcodes[code];
      return json(200, hit ?? { barcode: code, product: null, match: 'NOT_FOUND', items: [] });
    }
    if (method === 'POST' && path === '/foods/import') {
      const ext = [...state.external, ...Object.values(state.barcodes).flatMap((b) => b.items)].find(
        (f) => f.externalCode === body.externalCode,
      );
      if (!ext) return json(409, { code: 'MFDS_SEARCH_EXPIRED', message: '검색 결과가 만료되었어요.', fieldErrors: {} });
      const existing = state.foods.find((f) => f.id === ext.importedFoodId);
      if (existing) return json(200, existing);
      const food: Food = {
        id: state.nextId++,
        name: ext.name,
        kcal: ext.kcal,
        carbsG: ext.carbsG,
        proteinG: ext.proteinG,
        fatG: ext.fatG,
        servingGrams: ext.servingGrams,
        source: 'MFDS',
        volumeBased: ext.volumeBased,
      };
      state.foods.push(food);
      ext.importedFoodId = food.id;
      return json(200, food);
    }
    if (method === 'POST' && path === '/meals') {
      const food = state.foods.find((f) => f.id === body.foodId);
      if (!food) return json(404, { code: 'NOT_FOUND', message: '음식을(를) 찾을 수 없습니다.', fieldErrors: {} });
      const r = body.grams / 100;
      const entry: MealEntry = {
        id: state.nextId++,
        date: body.date,
        mealType: body.mealType,
        foodId: food.id,
        grams: body.grams,
        foodNameSnapshot: food.name,
        kcalPer100Snapshot: food.kcal,
        carbsPer100Snapshot: food.carbsG,
        proteinPer100Snapshot: food.proteinG,
        fatPer100Snapshot: food.fatG,
        calculatedKcal: food.kcal * r,
        carbsG: food.carbsG * r,
        proteinG: food.proteinG * r,
        fatG: food.fatG * r,
      };
      state.meals.push(entry);
      return json(201, entry);
    }
    const delMeal = /^\/meals\/(\d+)$/.exec(path);
    if (method === 'DELETE' && delMeal) {
      state.meals = state.meals.filter((m) => m.id !== Number(delMeal[1]));
      return json(204, null);
    }
    if (method === 'POST' && path === '/workouts') {
      if (!state.profile)
        return json(409, { code: 'PROFILE_REQUIRED', message: '운동 기록 전에 설정에서 프로필(체중)을 저장해 주세요.' });
    }
    if (method === 'PUT' && path === '/profile') {
      state.profile = { id: 1, ...body, updatedAt: new Date().toISOString() } as Profile;
      return json(200, profileView());
    }

    // ---- 체성분 ----
    if (method === 'GET' && path === '/body-compositions') {
      const from = url.searchParams.get('from') ?? '';
      const to = url.searchParams.get('to') ?? '';
      const items = state.bodies
        .filter((b) => b.measuredOn >= from && b.measuredOn <= to)
        .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
      return json(200, items);
    }
    const bodyId = /^\/body-compositions\/(\d+)$/.exec(path);
    if ((method === 'POST' && path === '/body-compositions') || (method === 'PUT' && bodyId)) {
      const id = bodyId ? Number(bodyId[1]) : state.nextId++;
      if (state.bodies.some((b) => b.measuredOn === body.measuredOn && b.id !== id))
        return json(409, {
          code: 'DUPLICATE_DATE',
          message: '이 날짜에는 이미 기록이 있어요.',
          fieldErrors: { measuredOn: '이 날짜에는 이미 기록이 있어요.' },
        });
      const entry = bodyView({ id, ...body });
      state.bodies = [...state.bodies.filter((b) => b.id !== id), entry];
      return json(bodyId ? 200 : 201, entry);
    }
    if (method === 'DELETE' && bodyId) {
      state.bodies = state.bodies.filter((b) => b.id !== Number(bodyId[1]));
      return json(204, null);
    }
    return json(404, { code: 'NOT_FOUND', message: '없음', fieldErrors: {} });
  };

  document.cookie = 'XSRF-TOKEN=; max-age=0; path=/';
  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  return { state, fetchMock };
}
