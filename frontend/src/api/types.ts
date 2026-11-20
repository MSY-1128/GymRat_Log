// 서버 DTO 타입. 숫자 값은 서버 계산값(반올림 전)이며 화면에서 반올림한다.

export type SexForFormula = 'MALE' | 'FEMALE';
export type Goal = 'LOSE' | 'MAINTAIN' | 'GAIN';
export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'SNACK';
export type Source = 'DEMO' | 'USER';

export interface Profile {
  id: number;
  age: number;
  sexForFormula: SexForFormula | null;
  heightCm: number;
  weightKg: number;
  activityFactor: number;
  goal: Goal;
  dailyTargetKcal: number | null;
  bmrKcal: number | null;
  tdeeKcal: number | null;
  updatedAt: string;
}

export interface ProfileInput {
  age: number;
  sexForFormula: SexForFormula | null;
  heightCm: number;
  weightKg: number;
  activityFactor: number;
  goal: Goal;
  dailyTargetKcal: number | null;
}

export interface Food {
  id: number;
  name: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  servingGrams: number | null;
  source: Source;
}

export interface FoodInput {
  name: string;
  kcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
  servingGrams: number | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
}

export interface Exercise {
  id: number;
  name: string;
  met: number;
  source: Source;
}

export interface MealEntry {
  id: number;
  date: string;
  mealType: MealType;
  foodId: number;
  grams: number;
  foodNameSnapshot: string;
  kcalPer100Snapshot: number;
  carbsPer100Snapshot: number;
  proteinPer100Snapshot: number;
  fatPer100Snapshot: number;
  calculatedKcal: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export interface MealInput {
  date: string;
  mealType: MealType;
  foodId: number;
  grams: number;
}

export interface WorkoutEntry {
  id: number;
  date: string;
  exerciseId: number;
  minutes: number;
  nameSnapshot: string;
  weightKgSnapshot: number;
  metSnapshot: number;
  calculatedKcal: number;
}

export interface WorkoutInput {
  date: string;
  exerciseId: number;
  minutes: number;
}

export interface DailySummary {
  date: string;
  consumedKcal: number;
  targetKcal: number | null;
  remainingKcal: number | null;
  exerciseKcal: number;
  exerciseMinutes: number;
  carbsG: number;
  proteinG: number;
  fatG: number;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export const MEAL_TYPES: { value: MealType; label: string }[] = [
  { value: 'BREAKFAST', label: '아침' },
  { value: 'LUNCH', label: '점심' },
  { value: 'DINNER', label: '저녁' },
  { value: 'SNACK', label: '간식' },
];

export const mealTypeLabel = (t: MealType): string =>
  MEAL_TYPES.find((m) => m.value === t)?.label ?? t;
