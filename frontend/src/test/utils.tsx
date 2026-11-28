import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { createQueryClient } from '../api/queryClient';
import type {
  BarcodeLookup,
  BodyAnalysis,
  BodyComposition,
  BodyPart,
  DailySummary,
  EnergySystem,
  Equipment,
  Exercise,
  ExternalFood,
  Food,
  Goal,
  LimitAdvice,
  LimitGuide,
  LimitItem,
  MealEntry,
  MealPlan,
  Muscle,
  Profile,
  User,
  WorkoutEntry,
} from '../api/types';

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
/** 시간 운동 픽스처(강도별 MET·속도 곡선) */
function timeEx(id: number, name: string, energySystem: EnergySystem, metLight: number, met: number, metVigorous: number, curve: [number, number][], motion: string): Exercise {
  return {
    id, name, met, source: 'CATALOG', kind: 'TIME', energySystem, bodyPart: null, metLight, metVigorous,
    speedMetCurve: curve.map(([speedKmh, m]) => ({ speedKmh, met: m })), equipment: null, primaryMuscles: [], secondaryMuscles: [], motion,
  };
}

/** 헬스 종목 픽스처 */
function gymEx(id: number, name: string, met: number, bodyPart: BodyPart, equipment: Equipment, primaryMuscles: Muscle[], secondaryMuscles: Muscle[], motion: string): Exercise {
  return {
    id, name, met, source: 'CATALOG', kind: 'STRENGTH', energySystem: 'ANAEROBIC', bodyPart, metLight: null, metVigorous: null,
    speedMetCurve: [], equipment, primaryMuscles, secondaryMuscles, motion,
  };
}

/** 서버 Calculator.metForSpeed와 같은 식 */
function metForSpeed(curve: { speedKmh: number; met: number }[], v: number): number {
  const first = curve[0]!;
  const last = curve[curve.length - 1]!;
  if (v <= first.speedKmh) return first.met;
  if (v >= last.speedKmh) return last.met;
  const i = curve.findIndex((p) => p.speedKmh >= v);
  const a = curve[i - 1]!;
  const b = curve[i]!;
  return Math.round((a.met + ((b.met - a.met) * (v - a.speedKmh)) / (b.speedKmh - a.speedKmh)) * 100) / 100;
}

/** 테스트가 넣는 체성분 기록. 측정일·체중·ID 외에는 결과지에 있는 값만 넣으면 된다. */
export type BodyFixture = Pick<BodyComposition, 'id' | 'measuredOn' | 'weightKg'> & Partial<BodyComposition>;

/** 분석 응답 예시: 서버와 같은 체지방률 기준(남 20~39세 8~20%, 여 21~33%)만 판정한다. */
export function analysisFixture(b: BodyComposition, profile: Profile | null): BodyAnalysis {
  const sex = profile?.sexForFormula ?? null;
  const [lo, hi, obese] = sex === 'FEMALE' ? [21, 33, 39] : [8, 20, 25];
  const pct = b.bodyFatPct;
  const level = sex == null || pct == null ? null : pct < lo ? 'LOW' : pct <= hi ? 'NORMAL' : pct < obese ? 'HIGH' : 'VERY_HIGH';
  const label = { LOW: '체지방 부족', NORMAL: '건강 범위', HIGH: '과체지방', VERY_HIGH: '비만' } as const;
  const metric = (key: string, labelText: string, unit: string, value: number) => ({
    key, label: labelText, unit, value, sharePct: null, level: null, levelLabel: null, normalLow: null, normalHigh: null, basis: null,
  });
  const groups: BodyAnalysis['groups'] = [
    { key: 'MUSCLE_FAT', title: '골격근·지방분석', items: [metric('weight', '체중', 'kg', b.weightKg)] },
  ];
  if (pct != null) {
    groups.push({
      key: 'OBESITY',
      title: '비만분석',
      items: [{
        ...metric('bodyFatPct', '체지방률', '%', pct),
        level,
        levelLabel: level ? label[level] : null,
        normalLow: level ? lo : null,
        normalHigh: level ? hi : null,
        basis: level ? 'Gallagher 외 2000 (AJCN) 나이·성별 건강 범위' : null,
      }],
    });
  }
  return {
    id: b.id,
    measuredOn: b.measuredOn,
    context: {
      sex,
      age: profile?.age ?? null,
      heightCm: profile?.heightCm ?? null,
      standardWeightKg: profile ? Math.round(22 * (profile.heightCm / 100) ** 2 * 10) / 10 : null,
      missing: sex == null ? ['프로필에 성별이 없어 체지방률·복부지방률·사지근육지수는 판정하지 않았어요.'] : [],
    },
    groups,
  };
}

/** 식단표 응답 예시:끼니마다 현미밥(1)·닭가슴살(2). variant가 홀수면 점심 양이 달라진다. */
export function planFixture(goal: Goal, variant: number): MealPlan {
  const n = (kcal: number, carbsG: number, proteinG: number, fatG: number) => ({
    kcal, carbsG, proteinG, fatG, sugarsG: 0.4, sodiumMg: 60, saturatedFatG: 1,
  });
  const meal = (mealType: MealPlan['meals'][number]['mealType'], sharePercent: number, rice: number, chicken: number) => ({
    mealType,
    sharePercent,
    target: { ...n(500, 60, 30, 10), sugarsG: null, sodiumMg: null, saturatedFatG: null },
    total: n(rice * 1.5 + chicken * 1.65, rice * 0.32, rice * 0.03 + chicken * 0.31, chicken * 0.036),
    items: [
      { foodId: 1, name: '현미밥', role: 'CARB' as const, grams: rice, nutrition: n(rice * 1.5, rice * 0.32, rice * 0.03, rice * 0.01) },
      { foodId: 2, name: '닭가슴살', role: 'PROTEIN' as const, grams: chicken, nutrition: n(chicken * 1.65, 0, chicken * 0.31, chicken * 0.036) },
    ],
  });
  return {
    goal,
    variant,
    body: {
      source: 'PROFILE', measuredOn: null, weightKg: 70, bodyFatPct: null, leanMassKg: null, skeletalMuscleKg: null,
      bmrKcal: 1650, bmrSource: 'PROFILE', bodyFatLevel: null, bodyFatLabel: null, bodyFatNormalLow: null,
      bodyFatNormalHigh: null,
    },
    targets: {
      weightKg: 70, tdeeKcal: 2000, kcal: goal === 'GAIN' ? 2200 : goal === 'LOSE' ? 1600 : 2000,
      kcalRule: '유지 열량 기준', proteinG: 126, proteinPerKg: 1.8, proteinRule: '체중 1kg당 1.8g',
      fatG: 61, fatPercent: 25, carbsG: 280, carbsPerKg: 4,
    },
    meals: [
      meal('BREAKFAST', 25, 150, 100),
      meal('LUNCH', 30, variant % 2 ? 250 : 200, 150),
      meal('DINNER', 30, 200, 150),
      meal('SNACK', 15, 100, 50),
    ],
    total: n(2200, 280, 130, 60),
    notes: ['단백질을 4번에 나눠 먹어요.'],
  };
}

export function createFakeServer() {
  const state = {
    /** 로그인한 사용자(null이면 로그아웃 상태). 기본은 로그인 상태. */
    user: { id: 1, username: 'tester' } as User | null,
    accounts: [{ id: 1, username: 'tester', password: 'password-123' }],
    csrfIssued: 0,
    profile: null as Profile | null,
    foods: [
      { id: 1, name: '현미밥', kcal: 150, carbsG: 32, proteinG: 3, fatG: 1, servingGrams: 210, source: 'DEMO', volumeBased: false, sugarsG: 0.2, sodiumMg: 2, saturatedFatG: 0.2 },
      { id: 2, name: '닭가슴살', kcal: 165, carbsG: 0, proteinG: 31, fatG: 3.6, servingGrams: null, source: 'DEMO', volumeBased: false, sugarsG: null, sodiumMg: null, saturatedFatG: null },
    ] as Food[],
    /** 식약처 DB 검색 결과(서버가 정규화한 형태) */
    external: [] as ExternalFood[],
    /** 바코드 조회 결과(서버 응답 형태) */
    barcodes: {} as Record<string, BarcodeLookup>,
    exercises: [
      timeEx(1, '달리기', 'AEROBIC', 6, 8.3, 11, [[6.4, 6], [8, 8.3], [9.7, 9.8], [11.3, 11]], 'run'),
      timeEx(2, '테니스', 'MIXED', 5, 7.3, 8, [], 'racket'),
      gymEx(3, '벤치프레스', 5, 'CHEST', 'BARBELL', ['CHEST'], ['FRONT_DELT', 'TRICEPS'], 'bench'),
      gymEx(4, '푸시업', 3.8, 'CHEST', 'BODYWEIGHT', ['CHEST'], ['FRONT_DELT', 'TRICEPS', 'ABS'], 'pushup'),
      gymEx(5, '스쿼트', 6, 'LEGS', 'BARBELL', ['QUADS', 'GLUTES'], ['ADDUCTORS', 'HAMSTRINGS'], 'squat'),
      timeEx(6, '요가', 'ANAEROBIC', 2.3, 3, 4, [], 'yoga'),
      { ...gymEx(7, '점프 스쿼트', 8, 'LEGS', 'BODYWEIGHT', ['QUADS', 'GLUTES'], ['CALVES'], 'squat:jump'), energySystem: 'MIXED' },
    ] as Exercise[],
    meals: [] as MealEntry[],
    workouts: [] as WorkoutEntry[],
    /** 체성분 기록(서버 응답 형태: 체지방량·제지방량 포함) */
    bodies: [] as BodyFixture[],
    /** 줄여야 할 부분 안내(테스트가 넣는다) */
    limitAdvice: [] as LimitAdvice[],
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
      exerciseMinutes: Math.round(ws.reduce((a, w) => a + w.durationMinutes, 0)),
      carbsG: meals.reduce((a, m) => a + m.carbsG, 0),
      proteinG: meals.reduce((a, m) => a + m.proteinG, 0),
      fatG: meals.reduce((a, m) => a + m.fatG, 0),
      sugarsG: meals.reduce((a, m) => a + (m.sugarsG ?? 0), 0),
      sodiumMg: meals.reduce((a, m) => a + (m.sodiumMg ?? 0), 0),
      saturatedFatG: meals.reduce((a, m) => a + (m.saturatedFatG ?? 0), 0),
      mealCount: meals.length,
      sugarsMissing: meals.filter((m) => m.sugarsG == null).length,
      sodiumMissing: meals.filter((m) => m.sodiumMg == null).length,
      saturatedFatMissing: meals.filter((m) => m.saturatedFatG == null).length,
    };
  };

  /** 서버와 같은 상한(2,000kcal 기준)·상태 규칙. 7일 평균은 오늘 값으로 둔다. */
  const limitGuide = (date: string): LimitGuide => {
    const s = summary(date);
    const kcal = state.profile?.dailyTargetKcal ?? 2000;
    const rows: [LimitItem['nutrient'], string, string, number, number, number][] = [
      ['SODIUM', '나트륨', 'mg', s.sodiumMg, 2000, s.sodiumMissing],
      ['SUGARS', '당류', 'g', s.sugarsG, Math.round(kcal * 0.2 / 4 * 10) / 10, s.sugarsMissing],
      ['SATURATED_FAT', '포화지방', 'g', s.saturatedFatG, Math.round(kcal * 0.07 / 9 * 10) / 10, s.saturatedFatMissing],
    ];
    const status = (v: number, limit: number): LimitItem['status'] =>
      s.mealCount === 0 ? 'NO_RECORD' : v > limit ? 'OVER' : v > limit * 0.8 ? 'NEAR' : 'OK';
    return {
      date,
      referenceKcal: kcal,
      referenceBasis: state.profile?.dailyTargetKcal != null ? 'TARGET' : 'DEFAULT',
      averageFrom: date,
      averageDays: s.mealCount > 0 ? 1 : 0,
      mealCount: s.mealCount,
      items: rows.map(([nutrient, label, unit, today, limit, missing]) => ({
        nutrient, label, unit, today, todayMissing: missing, average: s.mealCount > 0 ? today : null, limit,
        limitBasis: '기준', percent: Math.round((today / limit) * 100), status: status(today, limit),
        averageStatus: status(today, limit),
      })),
      advice: state.limitAdvice,
    };
  };

  /** 서버처럼 정형화: 체지방률·체지방량 중 하나로 나머지를 채우고 빠진 항목은 null. */
  const bodyView = (b: BodyFixture & { bodyFatMassKg?: number | null }): BodyComposition => {
    const { bodyFatMassKg, ...rest } = b;
    const w = b.weightKg;
    const r1 = (n: number) => Math.round(n * 10) / 10;
    const fat = b.fatMassKg ?? bodyFatMassKg ?? (b.bodyFatPct == null ? null : r1((w * b.bodyFatPct) / 100));
    const pct = b.bodyFatPct ?? (fat == null ? null : r1((fat / w) * 100));
    const none = { rightArm: null, leftArm: null, trunk: null, rightLeg: null, leftLeg: null };
    const lean = b.segmentalLean ?? none;
    const limbs = [lean.rightArm, lean.leftArm, lean.rightLeg, lean.leftLeg];
    return {
      bodyWaterL: null,
      proteinKg: null,
      mineralKg: null,
      skeletalMuscleKg: null,
      measuredBmrKcal: null,
      visceralFatLevel: null,
      ecwRatio: null,
      waistHipRatio: null,
      inbodyScore: null,
      ...rest,
      bodyFatPct: pct,
      fatMassKg: fat,
      leanMassKg: fat == null ? null : r1(w - fat),
      segmentalLean: lean,
      segmentalFat: b.segmentalFat ?? none,
      appendicularLeanKg: limbs.every((v) => v != null) ? r1(limbs.reduce((a, v) => a! + v!, 0)!) : null,
    };
  };

  /** 서버와 같은 규칙으로 BMR 방식·제지방량·단백질 목표를 붙인다(키·몸무게 공식 값은 생략). */
  const profileView = (): Profile => {
    const p = state.profile!;
    const byDateDesc = state.bodies.map(bodyView).sort((a, b) => b.measuredOn.localeCompare(a.measuredOn));
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
    if (method === 'GET' && path === '/nutrition/limits') return json(200, limitGuide(date));
    if (method === 'GET' && path === '/nutrition/meal-plan') {
      if (!state.profile) return json(409, { code: 'PROFILE_REQUIRED', message: '식단표를 만들려면 설정에서 프로필을 저장해 주세요.' });
      return json(200, planFixture((url.searchParams.get('goal') ?? 'MAINTAIN') as Goal, Number(url.searchParams.get('variant') ?? 0)));
    }
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
    if (method === 'POST' && path === '/foods') {
      const food: Food = {
        id: state.nextId++,
        ...body,
        sugarsG: body.sugarsG ?? null,
        sodiumMg: body.sodiumMg ?? null,
        saturatedFatG: body.saturatedFatG ?? null,
        source: 'USER',
        volumeBased: false,
      };
      state.foods.push(food);
      return json(201, food);
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
        sugarsG: ext.sugarsG,
        sodiumMg: ext.sodiumMg,
        saturatedFatG: ext.saturatedFatG,
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
        sugarsG: food.sugarsG == null ? null : food.sugarsG * r,
        sodiumMg: food.sodiumMg == null ? null : food.sodiumMg * r,
        saturatedFatG: food.saturatedFatG == null ? null : food.saturatedFatG * r,
      };
      state.meals.push(entry);
      return json(201, entry);
    }
    const delMeal = /^\/meals\/(\d+)$/.exec(path);
    if (method === 'DELETE' && delMeal) {
      state.meals = state.meals.filter((m) => m.id !== Number(delMeal[1]));
      return json(204, null);
    }
    const workoutId = /^\/workouts\/(\d+)$/.exec(path);
    if ((method === 'POST' && path === '/workouts') || (method === 'PUT' && workoutId)) {
      if (!state.profile)
        return json(409, { code: 'PROFILE_REQUIRED', message: '운동 기록 전에 설정에서 프로필(체중)을 저장해 주세요.' });
      const ex = state.exercises.find((x) => x.id === body.exerciseId);
      if (!ex) return json(404, { code: 'NOT_FOUND', message: '운동을(를) 찾을 수 없습니다.', fieldErrors: {} });
      const prev = workoutId ? state.workouts.find((w) => w.id === Number(workoutId[1])) : undefined;
      const bw = prev?.weightKgSnapshot ?? state.profile.weightKg;
      const mode = body.mode === 'SETS' ? 'SETS' : 'TIME';
      // 시간 운동: 체감 강도 또는 속도(거리 ÷ 시간)로 MET를 정한다
      const basis = mode === 'SETS' ? null : body.distanceKm != null ? 'DISTANCE' : body.speedKmh != null ? 'SPEED' : 'LEVEL';
      const intensity = basis === 'LEVEL' ? (body.intensity ?? 'MODERATE') : null;
      const speed = basis === 'DISTANCE' ? Math.round(((body.distanceKm * 60) / body.minutes) * 100) / 100 : basis === 'SPEED' ? body.speedKmh : null;
      const km = basis === 'DISTANCE' ? body.distanceKm : basis === 'SPEED' ? Math.round(((body.speedKmh * body.minutes) / 60) * 100) / 100 : null;
      const met =
        mode === 'SETS' ? ex.met : speed != null ? metForSpeed(ex.speedMetCurve, speed) : intensity === 'LIGHT' ? ex.metLight! : intensity === 'VIGOROUS' ? ex.metVigorous! : ex.met;
      const duration = mode === 'SETS' ? body.sets * 2.5 : body.minutes;
      const entry: WorkoutEntry = {
        id: prev?.id ?? state.nextId++,
        date: body.date,
        exerciseId: ex.id,
        mode,
        minutes: mode === 'SETS' ? null : body.minutes,
        distanceKm: km,
        sets: mode === 'SETS' ? body.sets : null,
        reps: mode === 'SETS' ? body.reps : null,
        liftedKg: mode === 'SETS' ? body.liftedKg : null,
        volumeKg: mode === 'SETS' ? body.sets * body.reps * body.liftedKg : null,
        durationMinutes: duration,
        bodyPart: ex.bodyPart,
        nameSnapshot: ex.name,
        weightKgSnapshot: bw,
        metSnapshot: met,
        kcalPerKgKmSnapshot: null,
        intensityBasis: basis,
        intensity,
        speedKmh: speed,
        energySystem: ex.energySystem,
        calculatedKcal: ((met * 3.5 * bw) / 200) * duration,
      };
      state.workouts = [...state.workouts.filter((w) => w.id !== entry.id), entry];
      return json(workoutId ? 200 : 201, entry);
    }
    if (method === 'DELETE' && workoutId) {
      state.workouts = state.workouts.filter((w) => w.id !== Number(workoutId[1]));
      return json(204, null);
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
        .map(bodyView)
        .filter((b) => b.measuredOn >= from && b.measuredOn <= to)
        .sort((a, b) => a.measuredOn.localeCompare(b.measuredOn));
      return json(200, items);
    }
    const analysisId = /^\/body-compositions\/(\d+)\/analysis$/.exec(path);
    if (method === 'GET' && analysisId) {
      const fixture = state.bodies.find((x) => x.id === Number(analysisId[1]));
      if (!fixture) return json(404, { code: 'NOT_FOUND', message: '체성분 기록을(를) 찾을 수 없습니다.', fieldErrors: {} });
      return json(200, analysisFixture(bodyView(fixture), state.profile));
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
