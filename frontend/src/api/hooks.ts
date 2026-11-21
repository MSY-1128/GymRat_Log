import { keepPreviousData, type QueryClient, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { Credentials, FoodInput, MealInput, MfdsKind, ProfileInput, User, WorkoutInput } from './types';

export const keys = {
  me: ['me'] as const,
  profile: ['profile'] as const,
  foods: (q: string, page: number) => ['foods', q, page] as const,
  externalFoods: (q: string, page: number, kind: MfdsKind) => ['external-foods', q, kind, page] as const,
  exercises: ['exercises'] as const,
  meals: (date: string) => ['meals', date] as const,
  workouts: (date: string) => ['workouts', date] as const,
  summary: (date: string) => ['summary', date] as const,
  stats: (from: string, to: string) => ['stats', from, to] as const,
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

/**
 * 식약처 DB 검색. 외부 API 트래픽(개발계정 일일 한도)을 아끼기 위해 검색 버튼으로만 조회하고,
 * 결과는 10분 캐시하며 실패해도 자동 재시도하지 않는다.
 */
export const useExternalFoods = (q: string, page: number, kind: MfdsKind) =>
  useQuery({
    queryKey: keys.externalFoods(q, page, kind),
    queryFn: () => api.searchExternalFoods(q, page, kind),
    enabled: q !== '',
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
    onSuccess: () => invalidate('profile', 'summary', 'stats'),
  });
}

export function useCreateFood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: FoodInput) => api.createFood(input),
    onSuccess: () => invalidate('foods'),
  });
}

export function useImportFood() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (externalCode: string) => api.importFood(externalCode),
    // 검색 결과의 '이미 가져옴' 표시와 내 음식 목록을 갱신한다
    onSuccess: () => invalidate('foods', 'external-foods'),
  });
}

export function useSaveMeal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: MealInput }) =>
      id == null ? api.createMeal(input) : api.updateMeal(id, input),
    onSuccess: () => invalidate('meals', 'summary', 'stats'),
  });
}

export function useDeleteMeal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deleteMeal(id),
    onSuccess: () => invalidate('meals', 'summary', 'stats'),
  });
}

export function useSaveWorkout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: WorkoutInput }) =>
      id == null ? api.createWorkout(input) : api.updateWorkout(id, input),
    onSuccess: () => invalidate('workouts', 'summary', 'stats'),
  });
}

export function useDeleteWorkout() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: number) => api.deleteWorkout(id),
    onSuccess: () => invalidate('workouts', 'summary', 'stats'),
  });
}
