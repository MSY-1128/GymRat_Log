import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import type { Profile } from '../api/types';
import { createFakeServer, renderWithProviders } from '../test/utils';

const DAY = '2026-11-20';

const PROFILE = {
  id: 1,
  age: 30,
  sexForFormula: 'MALE',
  heightCm: 175,
  weightKg: 70,
  activityFactor: 1.2,
  goal: 'LOSE',
  dailyTargetKcal: 2000,
  bmrMethod: 'FORMULA',
  proteinGPerKgLean: null,
  updatedAt: '2026-11-20T00:00:00Z',
} as unknown as Profile;

const meal = (id: number, foodId: number, name: string, grams: number, sodiumMg: number | null, sugarsG: number | null) => ({
  id,
  date: DAY,
  mealType: 'LUNCH' as const,
  foodId,
  grams,
  foodNameSnapshot: name,
  kcalPer100Snapshot: 100,
  carbsPer100Snapshot: 10,
  proteinPer100Snapshot: 5,
  fatPer100Snapshot: 3,
  calculatedKcal: grams,
  carbsG: grams / 10,
  proteinG: grams / 20,
  fatG: grams / 30,
  sugarsG,
  sodiumMg,
  saturatedFatG: sodiumMg == null ? null : 1,
});

describe('당류·나트륨·포화지방', () => {
  it('shows today against the limit, missing records and what to cut down', async () => {
    const { state } = createFakeServer();
    state.profile = PROFILE;
    state.meals = [meal(1, 9, '라면', 120, 1920, 3.6), meal(2, 9, '배추김치', 100, 600, 1), meal(3, 2, '닭가슴살', 100, null, null)];
    state.limitAdvice = [
      {
        nutrient: 'SODIUM',
        level: 'WARN',
        message: '오늘 나트륨이 상한(2,000mg)보다 520mg 많아요.',
        topFoods: [
          { name: '라면', mealType: 'LUNCH', amount: 1920 },
          { name: '배추김치', mealType: 'LUNCH', amount: 600 },
        ],
        tips: ['국·찌개·라면은 국물을 남기면 나트륨을 크게 줄일 수 있어요.'],
      },
    ];
    renderWithProviders(<App />, `/meals?date=${DAY}`);

    const sodium = await screen.findByTestId('limit-SODIUM');
    expect(within(sodium).getByText('초과')).toBeInTheDocument();
    expect(within(sodium).getByText('2,520mg')).toBeInTheDocument();
    expect(within(sodium).getByText(/상한 2,000mg \(126/)).toBeInTheDocument();
    expect(within(sodium).getByRole('meter', { name: '나트륨 상한 대비 오늘 섭취' })).toHaveAttribute(
      'aria-valuetext',
      '2,520mg, 상한 2,000mg의 126%',
    );
    expect(within(sodium).getByText('나트륨 정보가 없는 기록 1개는 합계에서 빠졌어요.')).toBeInTheDocument();
    // 당류 상한 = 2,000kcal × 20% ÷ 4
    expect(within(screen.getByTestId('limit-SUGARS')).getByText(/상한 100g/)).toBeInTheDocument();

    const advice = screen.getByTestId('advice-SODIUM');
    expect(within(advice).getByText('오늘 나트륨이 상한(2,000mg)보다 520mg 많아요.')).toBeInTheDocument();
    expect(within(advice).getByText('많이 먹은 음식: 라면 1,920mg(점심) · 배추김치 600mg(점심)')).toBeInTheDocument();
    // 기록에도 나트륨이 보인다
    expect(screen.getAllByText(/나트륨 1,920mg/).length).toBeGreaterThan(0);
  });

  it('says all is well when every nutrient is under 80% of its limit', async () => {
    const { state } = createFakeServer();
    state.meals = [meal(1, 1, '현미밥', 200, 4, 0.4)];
    renderWithProviders(<App />, `/meals?date=${DAY}`);

    expect(await screen.findByText(/오늘은 세 영양소 모두 상한의 80% 안이에요/)).toBeInTheDocument();
    expect(within(screen.getByTestId('limit-SODIUM')).getByText('적정')).toBeInTheDocument();
  });

  it('sends optional limit nutrients when registering a food and checks sugars against carbs', async () => {
    const user = userEvent.setup();
    const { state } = createFakeServer();
    renderWithProviders(<App />, `/meals?date=${DAY}`);
    await user.click(await screen.findByText('찾는 음식이 없나요? 직접 등록하기'));
    const form = screen.getByRole('form', { name: '음식 직접 등록' });
    await user.type(within(form).getByLabelText(/음식 이름/), '컵라면');
    await user.type(within(form).getByLabelText(/칼로리/), '450');
    await user.type(within(form).getByLabelText(/탄수화물/), '60');
    await user.type(within(form).getByLabelText(/단백질/), '9');
    await user.type(within(form).getByLabelText(/^지방/), '18');
    await user.type(within(form).getByLabelText('당류 (g)'), '70');
    await user.type(within(form).getByLabelText('나트륨 (mg)'), '1600');
    await user.click(within(form).getByRole('button', { name: '음식 등록' }));
    expect(within(form).getByText('당류는 탄수화물보다 많을 수 없어요.')).toBeInTheDocument();
    expect(state.calls.some((c) => c.method === 'POST' && c.path === '/foods')).toBe(false);

    await user.clear(within(form).getByLabelText('당류 (g)'));
    await user.type(within(form).getByLabelText('당류 (g)'), '3');
    await user.click(within(form).getByRole('button', { name: '음식 등록' }));
    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/foods')?.body).toMatchObject({
        sugarsG: 3,
        sodiumMg: 1600,
        saturatedFatG: null,
      }),
    );
  });
});

describe('식단표', () => {
  it('asks for a profile first', async () => {
    createFakeServer();
    renderWithProviders(<App />, `/meals?date=${DAY}`);
    const plan = await screen.findByRole('region', { name: '식단표 만들기' });
    expect(await within(plan).findByText(/먼저/)).toBeInTheDocument();
    expect(within(plan).getByRole('link', { name: '설정' })).toHaveAttribute('href', '/settings');
  });

  it('starts from the profile goal, switches goal and variant, and records a meal', async () => {
    const user = userEvent.setup();
    const { state } = createFakeServer();
    state.profile = PROFILE;
    renderWithProviders(<App />, `/meals?date=${DAY}`);
    const plan = await screen.findByRole('region', { name: '식단표 만들기' });

    const goals = within(plan).getByRole('group', { name: '목표' });
    expect(await within(plan).findByText('1,600')).toBeInTheDocument();
    expect(within(goals).getByRole('radio', { name: /체지방 감량/ })).toBeChecked();
    expect(state.calls.some((c) => c.path === '/nutrition/meal-plan')).toBe(true);

    await user.click(within(goals).getByRole('radio', { name: /근육량 증가/ }));
    expect(await within(plan).findByText('2,200')).toBeInTheDocument();

    const lunch = within(plan).getByTestId('plan-LUNCH');
    expect(within(lunch).getByText('200g')).toBeInTheDocument();
    await user.click(within(plan).getByRole('button', { name: '다른 식품으로 짜기' }));
    expect(await within(within(plan).getByTestId('plan-LUNCH')).findByText('250g')).toBeInTheDocument();

    await user.click(within(plan).getByRole('button', { name: `점심 식단표를 ${DAY} 기록에 추가` }));
    expect(await within(plan).findByText('점심 식단 2개를 기록했어요.')).toBeInTheDocument();
    const posted = state.calls.filter((c) => c.method === 'POST' && c.path === '/meals').map((c) => c.body);
    expect(posted).toEqual([
      { date: DAY, mealType: 'LUNCH', foodId: 1, grams: 250 },
      { date: DAY, mealType: 'LUNCH', foodId: 2, grams: 150 },
    ]);
    // 기록 목록의 점심에 바로 보인다
    expect(await within(screen.getByTestId('meal-group-LUNCH')).findByText('닭가슴살')).toBeInTheDocument();
  });

  it('lists the evidence with links', async () => {
    const user = userEvent.setup();
    createFakeServer();
    renderWithProviders(<App />, `/meals?date=${DAY}`);
    const plan = await screen.findByRole('region', { name: '식단표 만들기' });
    await user.click(within(plan).getByText('근거 자료'));
    expect(within(plan).getByText(/International Society of Sports Nutrition position stand: protein and exercise/)).toBeInTheDocument();
    expect(within(plan).getAllByRole('link', { name: '링크' }).length).toBeGreaterThanOrEqual(10);
  });
});
