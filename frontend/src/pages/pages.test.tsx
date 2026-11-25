import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { createFakeServer, renderWithProviders } from '../test/utils';

const DAY = '2026-03-10';

describe('TodayPage', () => {
  it('shows an error with retry and recovers after retry', async () => {
    const { state } = createFakeServer();
    state.failures.set('GET /summary', {
      count: 1,
      status: 500,
      body: { code: 'INTERNAL_ERROR', message: '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
    });
    state.meals.push({
      id: 1, date: DAY, mealType: 'LUNCH', foodId: 1, grams: 200, foodNameSnapshot: '현미밥',
      kcalPer100Snapshot: 150, carbsPer100Snapshot: 32, proteinPer100Snapshot: 3, fatPer100Snapshot: 1,
      calculatedKcal: 300, carbsG: 64, proteinG: 6, fatG: 2,
    });

    renderWithProviders(<App />, `/?date=${DAY}`);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('일시적인 오류가 발생했습니다');
    await userEvent.click(within(alert).getByRole('button', { name: '다시 시도' }));

    expect(await screen.findByTestId('consumed-kcal')).toHaveTextContent('300');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    // 목표 미설정이면 남은 칼로리는 '미설정'
    expect(screen.getByText('미설정')).toBeInTheDocument();
  });

  it('shows a network error message when the backend is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))));
    renderWithProviders(<App />, `/?date=${DAY}`);
    const alerts = await screen.findAllByRole('alert');
    expect(alerts[0]).toHaveTextContent('서버에 연결할 수 없습니다');
  });
});

describe('MealsPage', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('adds a meal through the API and refreshes the list and totals', async () => {
    const { state } = createFakeServer();
    const user = userEvent.setup();
    renderWithProviders(<App />, `/meals?date=${DAY}`);

    expect(await screen.findByText('아직 기록이 없어요.')).toBeInTheDocument();
    expect(await screen.findByTestId('meal-total')).toHaveTextContent('합계 0 kcal');

    await user.click(await screen.findByRole('radio', { name: /닭가슴살/ }));
    const mealTypes = screen.getByRole('group', { name: '식사 구분' });
    await user.click(within(mealTypes).getByRole('radio', { name: '저녁' }));
    expect(within(mealTypes).getByRole('radio', { name: '저녁' })).toBeChecked();
    const grams = screen.getByLabelText('섭취량 (g)');
    await user.clear(grams);
    await user.type(grams, '150');
    await user.click(screen.getByRole('button', { name: '식단 추가' }));

    // 서버로 보낸 값(클라이언트 계산값은 보내지 않음)
    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/meals')?.body).toEqual({
        date: DAY,
        mealType: 'DINNER',
        foodId: 2,
        grams: 150,
      }),
    );
    // 저장 성공 후 목록·합계 Query가 다시 조회되어 갱신된다
    const list = await screen.findByRole('list');
    expect(within(list).getByText('닭가슴살')).toBeInTheDocument();
    expect(within(list).getByText('248 kcal')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('meal-total')).toHaveTextContent('합계 248 kcal'));
    expect(screen.getByText('식단을 추가했어요.')).toBeInTheDocument();
  });

  it('converts servings to grams only for foods with servingGrams', async () => {
    const { state } = createFakeServer();
    const user = userEvent.setup();
    renderWithProviders(<App />, `/meals?date=${DAY}`);

    await user.click(await screen.findByRole('radio', { name: /닭가슴살/ }));
    expect(screen.getByLabelText('단위')).toBeDisabled();

    await user.click(screen.getByRole('radio', { name: /현미밥/ }));
    await user.selectOptions(screen.getByLabelText('단위'), 'serving');
    const amount = screen.getByLabelText('섭취량 (인분)');
    await user.clear(amount);
    await user.type(amount, '1.5');
    await user.click(screen.getByRole('button', { name: '식단 추가' }));

    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/meals')?.body).toMatchObject({
        foodId: 1,
        grams: 315,
      }),
    );
  });

  it('shows server field errors and client validation without calling the API', async () => {
    const { state } = createFakeServer();
    const user = userEvent.setup();
    renderWithProviders(<App />, `/meals?date=${DAY}`);

    await user.click(await screen.findByRole('button', { name: '식단 추가' }));
    expect(await screen.findByText('음식을 선택해 주세요.')).toBeInTheDocument();
    expect(state.calls.some((c) => c.method === 'POST')).toBe(false);

    state.failures.set('POST /meals', {
      count: 1,
      status: 400,
      body: { code: 'VALIDATION_ERROR', message: '입력값을 확인해 주세요.', fieldErrors: { grams: '5000 이하여야 합니다.' } },
    });
    await user.click(await screen.findByRole('radio', { name: /현미밥/ }));
    await user.click(screen.getByRole('button', { name: '식단 추가' }));
    expect(await screen.findByText('5000 이하여야 합니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('섭취량 (g)')).toHaveAttribute('aria-invalid', 'true');
  });

  it('groups records by meal and adds to a meal from its group', async () => {
    const { state } = createFakeServer();
    state.meals.push({
      id: 7, date: DAY, mealType: 'SNACK', foodId: 1, grams: 100, foodNameSnapshot: '현미밥',
      kcalPer100Snapshot: 150, carbsPer100Snapshot: 32, proteinPer100Snapshot: 3, fatPer100Snapshot: 1,
      calculatedKcal: 150, carbsG: 32, proteinG: 3, fatG: 1,
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, `/meals?date=${DAY}`);

    // 네 끼니가 모두 보이고, 기록이 있는 끼니엔 소계가 붙는다
    expect(await screen.findByTestId('meal-group-SNACK')).toHaveTextContent('150 kcal');
    expect(screen.getByTestId('meal-group-BREAKFAST')).toHaveTextContent('기록 없음');

    await user.click(screen.getByRole('button', { name: '아침 식단 추가하기' }));
    const mealTypes = screen.getByRole('group', { name: '식사 구분' });
    expect(within(mealTypes).getByRole('radio', { name: '아침' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: /닭가슴살/ }));
    await user.click(screen.getByRole('button', { name: '식단 추가' }));
    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/meals')?.body).toMatchObject({
        mealType: 'BREAKFAST',
      }),
    );
    expect(await within(screen.getByTestId('meal-group-BREAKFAST')).findByText('닭가슴살')).toBeInTheDocument();
  });

  it('deletes a meal after confirmation and refreshes', async () => {
    const { state } = createFakeServer();
    state.meals.push({
      id: 7, date: DAY, mealType: 'SNACK', foodId: 1, grams: 100, foodNameSnapshot: '현미밥',
      kcalPer100Snapshot: 150, carbsPer100Snapshot: 32, proteinPer100Snapshot: 3, fatPer100Snapshot: 1,
      calculatedKcal: 150, carbsG: 32, proteinG: 3, fatG: 1,
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, `/meals?date=${DAY}`);

    await user.click(await screen.findByRole('button', { name: '현미밥 기록 삭제' }));
    expect(window.confirm).toHaveBeenCalled();
    expect(await screen.findByText('아직 기록이 없어요.')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId('meal-total')).toHaveTextContent('합계 0 kcal'));
  });
});

describe('WorkoutsPage', () => {
  it('asks for a profile before recording workouts', async () => {
    createFakeServer();
    renderWithProviders(<App />, `/workouts?date=${DAY}`);
    const notice = await screen.findByText(/먼저/);
    expect(notice).toHaveTextContent('설정에서 프로필을 저장해 주세요');
    expect(within(notice).getByRole('link', { name: '설정' })).toHaveAttribute('href', `/settings?date=${DAY}`);
    expect(screen.queryByRole('button', { name: '운동 추가' })).not.toBeInTheDocument();
  });
});

describe('Date navigation', () => {
  it('moves to the previous day and refetches that day', async () => {
    const { fetchMock } = createFakeServer();
    const user = userEvent.setup();
    renderWithProviders(<App />, `/meals?date=${DAY}`);
    await screen.findByText('아직 기록이 없어요.');
    await user.click(screen.getByRole('button', { name: '이전 날짜' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.map((c) => String(c[0]))).toContain('/api/v1/meals?date=2026-03-09'),
    );
    expect(screen.getByLabelText('날짜 선택')).toHaveValue('2026-03-09');
  });
});
