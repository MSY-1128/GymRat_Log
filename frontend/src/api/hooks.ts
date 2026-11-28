import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { BodyCompositionInput, Credentials, FoodInput, Goal, MealInput, MfdsKind, ProfileInput, User, WorkoutInput } from './types';

export const keys = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  foods: (q: string, page: number) => ['foods', q, page] as const,
  externalFoods: (q: string, page: number, kind: MfdsKind, maker: string) =>
    ['external-foods', q, kind, maker, page] as const,
  barcode: (code: string) => ['barcode', code] as const,
  exercises: ['exercises'] as const,
  meals: (date: string) => ['meals', date] as const,
  workouts: (date: string) => ['workouts', date] as const,
  summary: (date: string) => ['summary', date] as const,
  stats: (from: string, to: string) => ['stats', from, to] as const,
  limits: (date: string) => ['limits', date] as const,
  mealPlan: (goal: string, variant: number) => ['meal-plan', goal, variant] as const,
  body: (from: string, to: string) => ['body', from, to] as const,
  bodyAnalysis: (id: number) => ['body-analysis', id] as const,
};

/** 로그인 사용자. 로그인하지 않았으면 data === null. */
export const useMe = () =>
  useQuery({ queryKey: keys.me, queryFn: api.me, staleTime: Infinity, retry: false });

/**
 * 로그인 사용자를 바꾸고 이전 사용자의 캐시(식단·운동 등)를 지운다.
 * qc.clear()는 화면이 구독 중인 me 쿼리까지 지워 화면이 바뀌지 않으므로, me는 값만 바꿔 화면에 알린다.
 */
export function resetSession(qc: QueryClient, user: User | null) {
  qc.removeQueries({ predicate: (q) => q.queryKey[0] !== keys.me[0] });
  qc.setQueryData(keys.me, user);
}

/** 로그인·가입 성공 시 새 사용자로 시작한다. */
function useStartSession() {
  const qc = useQueryClient();
  return (user: User) => resetSession(qc, user);
}

export function useLogin() {
  const start = useStartSession();
  return useMutation({ mutationFn: (input: Credentials) => api.login(input), onSuccess: start });
}

export function useSignup() {
  const start = useStartSession();
  return useMutation({ mutationFn: (input: Credentials) => api.signup(input), onSuccess: start });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.logout,
    // 서버 세션이 이미 끝났어도(401) 화면은 로그아웃 상태로 만든다
    onSettled: () => resetSession(qc, null),
  });
}

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: api.getProfile });

export const useFoods = (q: string, page: number) =>
  useQuery({
    queryKey: keys.foods(q, page),
    queryFn: () => api.searchFoods(q, page),
    placeholderData: keepPreviousData,
  });

/** 바코드 → 영양성분 후보. 버튼을 누를 때만 조회하고 자동 재시도하지 않는다(외부 API 한도 보호). */
export const useBarcodeLookup = (code: string) =>
  useQuery({
    queryKey: keys.barcode(code),
    queryFn: () => api.lookupBarcode(code),
    enabled: code !== '',
    staleTime: 10 * 60_000,
    retry: false,
  });

/**
 * 식약처 DB 검색. 외부 API 트래픽(개발계정 일일 한도)을 아끼기 위해 검색 버튼으로만 조회하고,
 * 결과는 10분 캐시하며 실패해도 자동 재시도하지 않는다.
 */
export const useExternalFoods = (q: string, page: number, kind: MfdsKind, maker = '') =>
  useQuery({
    queryKey: keys.externalFoods(q, page, kind, maker),
    queryFn: () => api.searchExternalFoods(q, page, kind, maker),
    enabled: q !== '' || maker !== '',
    staleTime: 10 * 60_000,
    retry: false,
    placeholderData: keepPreviousData,
  });

export const useExercises = () =>
  useQuery({ queryKey: keys.exercises, queryFn: api.getExercises, staleTime: 5 * 60_000 });

export const useMeals = (date: string) => useQuery({ queryKey: keys.meals(date), queryFn: () => api.getMeals(date) });

export const useWorkouts = (date: string) =>
  useQuery({ queryKey: keys.workouts(date), queryFn: () => api.getWorkouts(date) });

export const useSummary = (date: string) =>
  useQuery({ queryKey: keys.summary(date), queryFn: () => api.getSummary(date) });

export const useStats = (from: string, to: string) =>
  useQuery({ queryKey: keys.stats(from, to), queryFn: () => api.getStats(from, to) });

/** 하루 당류·나트륨·포화지방과 상한·최근 7일 평균 비교. 식단을 바꾸면 'limits'를 무효화한다. */
export const useLimitGuide = (date: string) =>
  useQuery({ queryKey: keys.limits(date), queryFn: () => api.getLimitGuide(date) });

/** 목표별 식단표. 프로필이 바뀌면 다시 계산한다. */
export const useMealPlan = (goal: Goal, variant: number, enabled = true) =>
  useQuery({
    queryKey: keys.mealPlan(goal, variant),
    queryFn: () => api.getMealPlan(goal, variant),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });

export const useBodyCompositions = (from: string, to: string) =>
  useQuery({
    queryKey: keys.body(from, to),
    queryFn: () => api.getBodyCompositions(from, to),
    placeholderData: keepPreviousData,
  });

/** 저장 성공 후 관련 Query(목록·요약·차트)를 무효화한다. */
function useInvalidate() {
  const qc = useQueryClient();
  return (...prefixes: string[]) =>
    Promise.all(prefixes.map((p) => qc.invalidateQueries({ queryKey: [p] })));
}

export function useSaveProfile() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: ProfileInput) => api.saveProfile(input),
    onSuccess: () => invalidate('profile', 'summary', 'stats', 'limits', 'meal-plan', 'body-analysis'),
  });
}

/** 체성분이 바뀌면 프로필의 BMR·제지방량·단백질 목표도 다시 계산된다. */
/** 측정 1건의 정형화된 분석. 프로필(성별·나이·키)이 바뀌면 다시 계산한다. */
export const useBodyAnalysis = (id: number | null) =>
  useQuery({ queryKey: keys.bodyAnalysis(id ?? 0), queryFn: () => api.getBodyAnalysis(id!), enabled: id != null });

export function useSaveBodyComposition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: BodyCompositionInput }) =>
      id == null ? api.createBodyComposition(input) : api.updateBodyComposition(id, input),
    onSuccess: () => invalidate('body', 'body-analysis', 'profile', 'limits', 'meal-plan'),
  });
}

export function useDeleteBodyComposition() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deleteBodyComposition(id),
    onSuccess: () => invalidate('body', 'body-analysis', 'profile', 'limits', 'meal-plan'),
  });
}

export function useCreateFood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: FoodInput) => api.createFood(input),
    onSuccess: () => invalidate('foods'),
  });
}

/** 내 음식 목록에서 지운다(식약처 음식은 숨김, 지난 식단 기록은 그대로). */
export function useDeleteFood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deleteFood(id),
    onSuccess: () => invalidate('foods'),
  });
}

export function useImportFood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (externalCode: string) => api.importFood(externalCode),
    // 검색 결과의 '이미 가져옴' 표시와 내 음식 목록을 갱신한다
    onSuccess: () => invalidate('foods', 'external-foods', 'barcode'),
  });
}

export function useSaveMeal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: MealInput }) =>
      id == null ? api.createMeal(input) : api.updateMeal(id, input),
    onSuccess: () => invalidate('meals', 'summary', 'stats', 'limits'),
  });
}

export function useDeleteMeal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deleteMeal(id),
    onSuccess: () => invalidate('meals', 'summary', 'stats', 'limits'),
  });
}

export function useSaveWorkout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: WorkoutInput }) =>
      id == null ? api.createWorkout(input) : api.updateWorkout(id, input),
    onSuccess: () => invalidate('workouts', 'summary', 'stats', 'limits'),
  });
}

export function useDeleteWorkout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deleteWorkout(id),
    onSuccess: () => invalidate('workouts', 'summary', 'stats', 'limits'),
  });
}
