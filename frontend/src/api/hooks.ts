import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { FoodInput, MealInput, ProfileInput, WorkoutInput } from './types';

export const keys = {
  profile: ['profile'] as const,
  foods: (q: string, page: number) => ['foods', q, page] as const,
  exercises: ['exercises'] as const,
  meals: (date: string) => ['meals', date] as const,
  workouts: (date: string) => ['workouts', date] as const,
  summary: (date: string) => ['summary', date] as const,
  stats: (from: string, to: string) => ['stats', from, to] as const,
};

export const useProfile = () => useQuery({ queryKey: keys.profile, queryFn: api.getProfile });

export const useFoods = (q: string, page: number) =>
  useQuery({
    queryKey: keys.foods(q, page),
    queryFn: () => api.searchFoods(q, page),
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
