import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import type { Profile } from '../api/types';
import { createFakeServer, renderWithProviders } from '../test/utils';

const DAY = '2026-11-20';

const profile = {
  id: 1, age: 30, sexForFormula: 'MALE', heightCm: 175, weightKg: 70, activityFactor: 1.2, goal: 'MAINTAIN',
  dailyTargetKcal: null, bmrMethod: 'FORMULA', proteinGPerKgLean: null, updatedAt: '2026-11-01T00:00:00Z',
} as unknown as Profile;

function setup() {
  const server = createFakeServer();
  server.state.profile = profile;
  const user = userEvent.setup();
  renderWithProviders(<App />, `/workouts?date=${DAY}`);
  return { ...server, user };
}

const posted = (state: ReturnType<typeof createFakeServer>['state']) =>
  state.calls.filter((c) => c.method === 'POST' && c.path === '/workouts').at(-1)?.body;

describe('운동 기록', () => {
  it('records gym work by body part with sets × reps × weight', async () => {
    const { state, user } = setup();
    const form = await screen.findByRole('form', { name: '운동 추가' });

    await user.click(within(form).getByRole('radio', { name: '헬스' }));
    // 기본 부위는 가슴이고 그 부위 첫 종목이 선택되며, 근육 그림이 그 종목의 근육을 보여 준다
    expect(within(form).getByRole('radio', { name: /벤치프레스/ })).toBeChecked();
    expect(
      within(form).getByRole('img', { name: '벤치프레스 근육 그림. 주 근육: 대흉근, 보조 근육: 전면 삼각근, 삼두근' }),
    ).toBeInTheDocument();

    // 도구로 거르면 그 도구의 종목만 남고 첫 종목이 선택된다
    const tools = within(form).getByRole('radiogroup', { name: '도구' });
    await user.click(within(tools).getByRole('radio', { name: '맨몸' }));
    expect(within(form).queryByRole('radio', { name: /벤치프레스/ })).not.toBeInTheDocument();
    expect(within(form).getByRole('radio', { name: /푸시업/ })).toBeChecked();
    expect(within(form).getByRole('img', { name: /^푸시업 근육 그림/ })).toBeInTheDocument();

    await user.click(within(form).getByRole('radio', { name: '하체' }));
    expect(within(form).getByRole('radio', { name: /스쿼트/ })).toBeChecked();
    expect(within(form).getByRole('img', { name: /스쿼트 근육 그림. 주 근육: 대퇴사두근, 둔근/ })).toBeInTheDocument();
    // 하체는 도구가 하나뿐이라 필터를 보여 주지 않는다
    expect(within(form).queryByRole('radiogroup', { name: '도구' })).not.toBeInTheDocument();
    expect(within(form).queryByRole('radio', { name: /벤치프레스/ })).not.toBeInTheDocument();

    await user.clear(within(form).getByLabelText('세트'));
    await user.type(within(form).getByLabelText('세트'), '4');
    await user.type(within(form).getByLabelText('무게 (kg)'), '100');
    // 6 × 3.5 × 70 / 200 × (4 × 2.5분) = 73.5
    expect(within(form).getByTestId('volume')).toHaveTextContent('볼륨 4,000kg · 약 10분 추정');
    expect(within(form).getByTestId('estimate')).toHaveTextContent('74 kcal');
    await user.click(within(form).getByRole('button', { name: '운동 추가' }));

    await waitFor(() =>
      expect(posted(state)).toEqual({ date: DAY, exerciseId: 5, mode: 'SETS', sets: 4, reps: 10, liftedKg: 100 }),
    );
    const item = await screen.findByText('하체 · 4세트 × 10회 × 100kg');
    expect(item.closest('li')).toHaveTextContent('74 kcal');
  });

  it('records distance for distance-capable sports and time otherwise', async () => {
    const { state, user } = setup();
    const form = await screen.findByRole('form', { name: '운동 추가' });

    // 달리기: 시간·거리 중 거리
    await user.click(within(form).getByRole('radio', { name: '달리기' }));
    await user.click(within(form).getByRole('radio', { name: '거리' }));
    await user.type(within(form).getByLabelText('거리 (km)'), '5');
    expect(within(form).getByTestId('estimate')).toHaveTextContent('350 kcal'); // 1.0 × 70 × 5
    await user.click(within(form).getByRole('button', { name: '운동 추가' }));
    await waitFor(() =>
      expect(posted(state)).toEqual({ date: DAY, exerciseId: 1, mode: 'DISTANCE', distanceKm: 5, minutes: 30 }),
    );
    expect(await screen.findByText('5km · 30분')).toBeInTheDocument();

    // 테니스: 거리 계수가 없어 시간만
    const form2 = screen.getByRole('form', { name: '운동 추가' });
    await user.click(within(form2).getByRole('radio', { name: '테니스' }));
    expect(within(form2).queryByRole('radiogroup', { name: '기록 방식' })).not.toBeInTheDocument();
    const minutes = within(form2).getByLabelText('시간 (분)');
    await user.clear(minutes);
    await user.type(minutes, '60');
    await user.click(within(form2).getByRole('button', { name: '운동 추가' }));
    await waitFor(() => expect(posted(state)).toEqual({ date: DAY, exerciseId: 2, mode: 'TIME', minutes: 60 }));
    // 7.3 × 3.5 × 70 / 200 × 60 = 536.55
    expect((await screen.findByText('60분')).closest('li')).toHaveTextContent('537 kcal');
  });

  it('validates gym inputs on the client', async () => {
    const { state, user } = setup();
    const form = await screen.findByRole('form', { name: '운동 추가' });
    await user.click(within(form).getByRole('radio', { name: '헬스' }));
    await user.clear(within(form).getByLabelText('횟수 (회)'));
    await user.click(within(form).getByRole('button', { name: '운동 추가' }));
    expect(within(form).getByText('1~100 사이 정수로 입력해 주세요.')).toBeInTheDocument();
    expect(within(form).getByText('0~500kg으로 입력해 주세요. 맨몸 운동은 0이에요.')).toBeInTheDocument();
    expect(state.calls.some((c) => c.method === 'POST' && c.path === '/workouts')).toBe(false);
  });

  it('opens a gym record for editing with its part and exercise selected', async () => {
    const { state, user } = setup();
    state.workouts.push({
      id: 9, date: DAY, exerciseId: 4, mode: 'SETS', minutes: null, distanceKm: null, sets: 3, reps: 15,
      liftedKg: 0, volumeKg: 0, durationMinutes: 7.5, bodyPart: 'CHEST', nameSnapshot: '푸시업',
      weightKgSnapshot: 70, metSnapshot: 3.8, kcalPerKgKmSnapshot: null, calculatedKcal: 34.9125,
    });
    await user.click(await screen.findByRole('button', { name: '푸시업 기록 수정' }));
    const form = screen.getByRole('form', { name: '운동 수정' });
    expect(within(form).getByRole('radio', { name: '헬스' })).toBeChecked();
    expect(within(form).getByRole('radio', { name: '가슴' })).toBeChecked();
    expect(within(form).getByRole('radio', { name: /푸시업/ })).toBeChecked();
    expect(within(form).getByLabelText('세트')).toHaveValue(3);
    expect(within(form).getByLabelText('무게 (kg)')).toHaveValue(0);

    await user.clear(within(form).getByLabelText('세트'));
    await user.type(within(form).getByLabelText('세트'), '4');
    await user.click(within(form).getByRole('button', { name: '수정 저장' }));
    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'PUT' && c.path === '/workouts/9')?.body).toMatchObject({
        mode: 'SETS',
        exerciseId: 4,
        sets: 4,
        reps: 15,
        liftedKg: 0,
      }),
    );
  });
});
