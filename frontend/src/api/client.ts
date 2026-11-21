import type {
  ApiErrorBody,
  DailySummary,
  Exercise,
  ExternalFoodPage,
  Food,
  FoodInput,
  MealEntry,
  MealInput,
  MfdsKind,
  Page,
  Profile,
  ProfileInput,
  WorkoutEntry,
  WorkoutInput,
} from './types';

const BASE = '/api/v1';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.fieldErrors = body.fieldErrors ?? {};
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...init,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해 주세요.',
    });
  }
  if (res.status === 204) {
    return null as T;
  }
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = body as Partial<ApiErrorBody> | null;
    throw new ApiError(res.status, {
      code: err?.code ?? 'HTTP_' + res.status,
      message: err?.message ?? '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      fieldErrors: err?.fieldErrors ?? {},
    });
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({ method, body: JSON.stringify(data) });
const q = (params: Record<string, string | number>) =>
  '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

export const api = {
  getProfile: () => request<Profile | null>('/profile'),
  saveProfile: (input: ProfileInput) => request<Profile>('/profile', json('PUT', input)),

  searchFoods: (query: string, page: number, size = 10) =>
    request<Page<Food>>('/foods' + q({ q: query, page, size })),
  createFood: (input: FoodInput) => request<Food>('/foods', json('POST', input)),
  searchExternalFoods: (query: string, page: number, kind: MfdsKind) =>
    request<ExternalFoodPage>('/foods/external' + q({ q: query, page, kind })),
  importFood: (externalCode: string) => request<Food>('/foods/import', json('POST', { externalCode })),

  getExercises: () => request<Exercise[]>('/exercises'),

  getMeals: (date: string) => request<MealEntry[]>('/meals' + q({ date })),
  createMeal: (input: MealInput) => request<MealEntry>('/meals', json('POST', input)),
  updateMeal: (id: number, input: MealInput) => request<MealEntry>(`/meals/${id}`, json('PUT', input)),
  deleteMeal: (id: number) => request<null>(`/meals/${id}`, { method: 'DELETE' }),

  getWorkouts: (date: string) => request<WorkoutEntry[]>('/workouts' + q({ date })),
  createWorkout: (input: WorkoutInput) => request<WorkoutEntry>('/workouts', json('POST', input)),
  updateWorkout: (id: number, input: WorkoutInput) =>
    request<WorkoutEntry>(`/workouts/${id}`, json('PUT', input)),
  deleteWorkout: (id: number) => request<null>(`/workouts/${id}`, { method: 'DELETE' }),

  getSummary: (date: string) => request<DailySummary>('/summary' + q({ date })),
  getStats: (from: string, to: string) => request<DailySummary[]>('/stats' + q({ from, to })),
};
