import type {
  ApiErrorBody,
  BodyComposition,
  BodyCompositionInput,
  Credentials,
  User,
  DailySummary,
  Exercise,
  BarcodeLookup,
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

const CSRF_COOKIE = 'XSRF-TOKEN';
const CSRF_HEADER = 'X-XSRF-TOKEN';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function readCookie(name: string): string | null {
  const hit = document.cookie.split('; ').find((c) => c.startsWith(name + '='));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : null;
}

/** 서버가 XSRF-TOKEN 쿠키를 내려주도록 한 번 호출한다(로그인 직후에는 토큰이 새로 바뀐다). */
async function csrfToken(refresh = false): Promise<string | null> {
  const current = readCookie(CSRF_COOKIE);
  if (current && !refresh) return current;
  try {
    await fetch(BASE + '/auth/csrf', { credentials: 'same-origin' });
  } catch {
    // 아래 본 요청에서 네트워크 오류로 처리된다
  }
  return readCookie(CSRF_COOKIE);
}

/** 로그인 세션이 끊겼을 때(401) 호출할 함수. 앱이 등록한다. */
let onUnauthorized: () => void = () => {};
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}

async function request<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (!SAFE_METHODS.has(method)) {
    const token = await csrfToken(retried);
    if (token) headers[CSRF_HEADER] = token;
  }
  let res: Response;
  try {
    res = await fetch(BASE + path, { ...init, method, headers, credentials: 'same-origin' });
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: '서버에 연결할 수 없습니다. 백엔드가 실행 중인지 확인해 주세요.',
    });
  }
  // CSRF 토큰이 바뀐 경우(로그인·로그아웃 직후 등) 새 토큰으로 한 번만 다시 시도한다
  if (res.status === 403 && !SAFE_METHODS.has(method) && !retried) {
    return request<T>(path, init, true);
  }
  if (res.status === 401 && !path.startsWith('/auth/')) {
    onUnauthorized();
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
  /** 로그인하지 않았으면 null */
  me: async (): Promise<User | null> => {
    try {
      return await request<User>('/auth/me');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },
  login: (input: Credentials) => request<User>('/auth/login', json('POST', input)),
  signup: (input: Credentials) => request<User>('/auth/signup', json('POST', input)),
  logout: () => request<null>('/auth/logout', { method: 'POST' }),

  getProfile: () => request<Profile | null>('/profile'),
  saveProfile: (input: ProfileInput) => request<Profile>('/profile', json('PUT', input)),

  searchFoods: (query: string, page: number, size = 10) =>
    request<Page<Food>>('/foods' + q({ q: query, page, size })),
  createFood: (input: FoodInput) => request<Food>('/foods', json('POST', input)),
  searchExternalFoods: (query: string, page: number, kind: MfdsKind, maker = '') =>
    request<ExternalFoodPage>('/foods/external' + q({ q: query, page, kind, ...(maker ? { maker } : {}) })),
  lookupBarcode: (code: string) => request<BarcodeLookup>('/foods/barcode/' + encodeURIComponent(code)),
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

  getBodyCompositions: (from: string, to: string) =>
    request<BodyComposition[]>('/body-compositions' + q({ from, to })),
  createBodyComposition: (input: BodyCompositionInput) =>
    request<BodyComposition>('/body-compositions', json('POST', input)),
  updateBodyComposition: (id: number, input: BodyCompositionInput) =>
    request<BodyComposition>(`/body-compositions/${id}`, json('PUT', input)),
  deleteBodyComposition: (id: number) => request<null>(`/body-compositions/${id}`, { method: 'DELETE' }),
};
