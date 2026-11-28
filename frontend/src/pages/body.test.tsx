import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import type { Profile } from '../api/types';
import { addDays, todayString } from '../lib/date';
import { createFakeServer, renderWithProviders } from '../test/utils';
import { niceTicks } from './BodyPage';

describe('niceTicks', () => {
  it('uses even steps around the values', () => {
    expect(niceTicks([83.2, 82.1, 80.9, 80.2])).toEqual([78, 80, 82, 84]);
    expect(niceTicks([35.1, 35.8])).toEqual([34.5, 35, 35.5, 36, 36.5]);
    // 값이 하나여도 범위가 생긴다
    expect(niceTicks([70])).toEqual([69.5, 70, 70.5]);
  });
});

const TODAY = todayString();

const baseProfile = (over: Partial<Profile> = {}): Profile => ({
  id: 1,
  age: 30,
  sexForFormula: 'MALE',
  heightCm: 180,
  weightKg: 80,
  activityFactor: 1.2,
  goal: 'MAINTAIN',
  dailyTargetKcal: null,
  bmrMethod: 'FORMULA',
  bmrAppliedMethod: 'FORMULA',
  bmrMeasuredOn: null,
  bmrKcal: 1780,
  tdeeKcal: 2136,
  leanMassKg: null,
  leanMassMeasuredOn: null,
  proteinGPerKgLean: null,
  proteinTargetG: null,
  updatedAt: '2026-11-01T00:00:00Z',
  ...over,
});

describe('체성분', () => {
  beforeEach(() => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('records a measurement and shows derived fat and lean mass', async () => {
    const { state } = createFakeServer();
    const user = userEvent.setup();
    renderWithProviders(<App />, '/body');

    expect(await screen.findByText('이 기간에 기록이 없어요.')).toBeInTheDocument();
    const form = screen.getByRole('form', { name: '체성분 기록' });
    await user.type(within(form).getByLabelText('체중 (kg)'), '80');
    await user.type(within(form).getByLabelText('체지방률 (%)'), '12');
    await user.type(within(form).getByLabelText('골격근량 (kg)'), '38.5');
    await user.click(within(form).getByRole('button', { name: '기록하기' }));

    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/body-compositions')?.body).toMatchObject({
        measuredOn: TODAY,
        weightKg: 80,
        bodyFatPct: 12,
        skeletalMuscleKg: 38.5,
        bodyFatMassKg: null,
        measuredBmrKcal: null,
        segmentalLean: { rightArm: null, trunk: null },
      }),
    );
    expect(await screen.findByText('체성분을 기록했어요.')).toBeInTheDocument();
    // 저장 후 입력 칸은 비워진다
    expect(screen.getByLabelText('체중 (kg)')).toHaveValue(null);
    const row = screen.getAllByRole('row')[1]!;
    expect(row).toHaveTextContent('9.6 kg'); // 체지방량
    expect(row).toHaveTextContent('70.4 kg'); // 제지방량
  });

  it('validates on the client and shows a duplicate-date error from the server', async () => {
    const { state } = createFakeServer();
    state.bodies.push({
      id: 1, measuredOn: TODAY, weightKg: 80, bodyFatPct: null, skeletalMuscleKg: null,
      measuredBmrKcal: null, visceralFatLevel: null, fatMassKg: null, leanMassKg: null,
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/body');

    // 항목별 차트: 값이 없는 항목은 '기록 없음'
    expect(await screen.findByTestId('chart-weight')).toHaveTextContent('80.0kg');
    expect(screen.getByTestId('chart-muscle')).toHaveTextContent('기록 없음');

    const form = await screen.findByRole('form', { name: '체성분 기록' });
    await user.type(within(form).getByLabelText('체중 (kg)'), '40');
    await user.type(within(form).getByLabelText('골격근량 (kg)'), '45');
    await user.click(within(form).getByRole('button', { name: '기록하기' }));
    expect(await within(form).findByText('골격근량은 체중보다 작아야 해요.')).toBeInTheDocument();
    expect(state.calls.some((c) => c.method === 'POST' && c.path === '/body-compositions')).toBe(false);

    await user.clear(within(form).getByLabelText('골격근량 (kg)'));
    await user.click(within(form).getByRole('button', { name: '기록하기' }));
    expect(await within(form).findByText('이 날짜에는 이미 기록이 있어요.')).toBeInTheDocument();
  });

  it('summarizes change between first and last measurement and offers to sync profile weight', async () => {
    const { state } = createFakeServer();
    state.profile = baseProfile();
    state.bodies.push(
      {
        id: 1, measuredOn: addDays(TODAY, -28), weightKg: 82, bodyFatPct: 20, skeletalMuscleKg: 36,
        measuredBmrKcal: null, visceralFatLevel: 8, fatMassKg: 16.4, leanMassKg: 65.6,
      },
      {
        id: 2, measuredOn: addDays(TODAY, -1), weightKg: 80.5, bodyFatPct: 18, skeletalMuscleKg: 36.4,
        measuredBmrKcal: null, visceralFatLevel: 7, fatMassKg: 14.49, leanMassKg: 66.01,
      },
    );
    const user = userEvent.setup();
    renderWithProviders(<App />, '/body');

    expect(await screen.findByTestId('change-weight')).toHaveTextContent('−1.5 kg');
    expect(screen.getByTestId('change-muscle')).toHaveTextContent('+0.4 kg');
    expect(screen.getByTestId('change-fat')).toHaveTextContent('−1.9 kg');
    // 각 항목 차트는 측정값을 글로도 갖고 있다(스크린리더용)
    expect(within(screen.getByTestId('chart-muscle')).getByRole('img')).toHaveAccessibleName(/36\.0kg.*36\.4kg/);
    expect(screen.getByTestId('chart-fatPct')).toHaveTextContent('18.0%');

    await user.click(screen.getByRole('button', { name: '프로필 체중을 80.5kg으로 바꾸기' }));
    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'PUT' && c.path === '/profile')?.body).toMatchObject({
        weightKg: 80.5,
        heightCm: 180,
        bmrMethod: 'FORMULA',
      }),
    );
    expect(await screen.findByText('프로필 체중을 80.5kg으로 바꿨어요.')).toBeInTheDocument();
  });

  it('uses body fat for BMR and protein target, shown in settings and today', async () => {
    const { state } = createFakeServer();
    state.profile = baseProfile();
    state.bodies.push({
      id: 1, measuredOn: addDays(TODAY, -3), weightKg: 80, bodyFatPct: 12, skeletalMuscleKg: null,
      measuredBmrKcal: null, visceralFatLevel: null, fatMassKg: 9.6, leanMassKg: 70.4,
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/settings');

    const form = await screen.findByRole('form', { name: '프로필' });
    await user.click(within(form).getByRole('radio', { name: /체지방률 공식/ }));
    await user.type(within(form).getByLabelText(/단백질 목표/), '2');
    await user.click(within(form).getByRole('button', { name: '프로필 저장' }));

    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'PUT' && c.path === '/profile')?.body).toMatchObject({
        bmrMethod: 'BODY_FAT',
        proteinGPerKgLean: 2,
      }),
    );
    // 370 + 21.6 × 70.4 = 1890.64 → 1,891 / 단백질 2 × 70.4 = 140.8 → 141 g
    await waitFor(() => expect(screen.getByTestId('bmr')).toHaveTextContent('1,891 kcal'));
    expect(screen.getByTestId('protein-target')).toHaveTextContent('141 g');

    await user.click(screen.getByRole('navigation', { name: '주요 메뉴' }).querySelector('a[href="/"]')!);
    expect(await screen.findByTestId('protein-progress')).toHaveTextContent('0 / 141 g');
    expect(screen.getByRole('meter', { name: '단백질 목표 대비 섭취' })).toHaveAttribute('aria-valuemax', '141');
  });

  it('tells when the chosen method falls back to the formula', async () => {
    const { state } = createFakeServer();
    state.profile = baseProfile({ bmrMethod: 'MEASURED' });
    renderWithProviders(<App />, '/settings');
    expect(await screen.findByTestId('bmr-fallback')).toHaveTextContent('인바디 측정값에 필요한 값이 아직 없어');
  });
});

describe('인바디 결과지 입력과 분석', () => {
  it('enters the sheet in its order, sends segment values and shows the judged analysis', async () => {
    const { state } = createFakeServer();
    state.profile = baseProfile({ heightCm: 175 });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/body');

    const form = await screen.findByRole('form', { name: '체성분 기록' });
    expect(within(form).getByRole('group', { name: '체성분분석' })).toBeInTheDocument();
    await user.type(within(form).getByLabelText('체중 (kg)'), '75');
    const composition = within(form).getByRole('group', { name: '체성분분석' });
    await user.type(within(composition).getByLabelText('체수분 (L)'), '44');
    await user.type(within(composition).getByLabelText('체지방량 (kg)'), '15');
    await user.click(within(form).getByText('부위별 분석 입력 (결과지에 있으면)'));
    const lean = within(form).getByRole('group', { name: '부위별 근육분석 (kg)' });
    await user.type(within(lean).getByLabelText('몸통'), '27');
    await user.type(within(lean).getByLabelText('오른팔'), '3.456');
    await user.type(within(within(form).getByRole('group', { name: '연구항목' })).getByLabelText('세포외수분비'), '0.381');
    await user.click(within(form).getByRole('button', { name: '기록하기' }));

    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/body-compositions')?.body).toMatchObject({
        weightKg: 75,
        bodyWaterL: 44,
        bodyFatMassKg: 15,
        bodyFatPct: null,
        // 소수 자릿수를 결과지 기준으로 맞춰 보낸다
        segmentalLean: { trunk: 27, rightArm: 3.46, leftArm: null },
        ecwRatio: 0.381,
      }),
    );

    // 체지방량으로 계산한 체지방률 20% → 남 30세 건강 범위 8~20%
    const card = await screen.findByRole('region', { name: /결과지 분석/ });
    const fatPct = await within(card).findByTestId('metric-bodyFatPct');
    expect(fatPct).toHaveTextContent('20%');
    expect(fatPct).toHaveTextContent('건강 범위');
    expect(within(fatPct).getByRole('img')).toHaveAccessibleName('체지방률 20%, 정상 8~20, 건강 범위');
    expect(within(fatPct).getByText('Gallagher 외 2000 (AJCN) 나이·성별 건강 범위')).toBeInTheDocument();
  });

  it('shows server consistency errors next to the sheet group', async () => {
    const { state } = createFakeServer();
    state.failures.set('POST /body-compositions', {
      count: 1,
      status: 400,
      body: {
        code: 'VALIDATION_ERROR',
        message: '입력값을 확인해 주세요.',
        fieldErrors: {
          bodyFatMassKg: '체지방량과 체지방률이 맞지 않아요. 체중 × 체지방률 = 15.0kg이에요.',
          segmentalFat: '부위별 체지방량 합계(30kg)가 체지방량보다 커요.',
        },
      },
    });
    const user = userEvent.setup();
    renderWithProviders(<App />, '/body');
    const form = await screen.findByRole('form', { name: '체성분 기록' });
    await user.type(within(form).getByLabelText('체중 (kg)'), '75');
    await user.type(within(form).getByLabelText('체지방률 (%)'), '20');
    await user.type(within(form).getByLabelText('체지방량 (kg)'), '12');
    await user.click(within(form).getByRole('button', { name: '기록하기' }));

    expect(await within(form).findByText(/체중 × 체지방률 = 15.0kg/)).toBeInTheDocument();
    expect(within(form).getByText('부위별 체지방량 합계(30kg)가 체지방량보다 커요.')).toBeInTheDocument();
  });

  it('asks for sex in the profile when it cannot judge', async () => {
    const { state } = createFakeServer();
    state.bodies.push({ id: 1, measuredOn: TODAY, weightKg: 70, bodyFatPct: 18 });
    renderWithProviders(<App />, '/body');
    const card = await screen.findByRole('region', { name: /결과지 분석/ });
    expect(await within(card).findByText(/성별이 없어/)).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: '설정' })).toHaveAttribute('href', '/settings');
  });
});
