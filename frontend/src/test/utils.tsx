import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import type { DailySummary, Exercise, ExternalFood, Food, MealEntry, Profile, WorkoutEntry } from '../api/types';

export function renderWithProviders(ui: ReactElement, route = '/') {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 0 }, mutations: { retry: false } },
  });
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
    profile: null as Profile | null,
    foods: [
      { id: 1, name: '현미밥', kcal: 150, carbsG: 32, proteinG: 3, fatG: 1, servingGrams: 210, source: 'DEMO', volumeBased: false },
      { id: 2, name: '닭가슴살', kcal: 165, carbsG: 0, proteinG: 31, fatG: 3.6, servingGrams: null, source: 'DEMO', volumeBased: false },
    ] as Food[],
    /** 식약처 DB 검색 결과(서버가 정규화한 형태) */
    external: [] as ExternalFood[],
    exercises: [{ id: 1, name: '달리기', met: 8, source: 'DEMO' }] as Exercise[],
    meals: [] as MealEntry[],
    workouts: [] as WorkoutEntry[],
    nextId: 100,
    /** 특정 경로에 대해 다음 N번 강제로 실패시킨다. */
    failures: new Map<string, { count: number; status: number; body: unknown }>(),
    calls: [] as { method: string; path: string; body: unknown }[],
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

  const handler = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace('/api/v1', '');
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ method, path, body });

    const fail = state.failures.get(`${method} ${path}`);
    if (fail && fail.count > 0) {
      fail.count -= 1;
      return json(fail.status, fail.body);
    }

    const date = url.searchParams.get('date') ?? '';
    if (method === 'GET' && path === '/profile') return state.profile ? json(200, state.profile) : json(204, null);
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
      const items = state.external.filter((f) => f.name.includes(q));
      return json(200, { items, page: 0, size: 20, totalElements: items.length, excluded: 0 });
    }
    if (method === 'POST' && path === '/foods/import') {
      const ext = state.external.find((f) => f.externalCode === body.externalCode);
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
      state.profile = { id: 1, ...body, bmrKcal: null, tdeeKcal: null, updatedAt: new Date().toISOString() };
      return json(200, state.profile);
    }
    return json(404, { code: 'NOT_FOUND', message: '없음', fieldErrors: {} });
  };

  const fetchMock = vi.fn(handler);
  vi.stubGlobal('fetch', fetchMock);
  return { state, fetchMock };
}
