import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import type { ExternalFood } from '../api/types';
import { createFakeServer, renderWithProviders } from '../test/utils';

const DAY = '2026-11-21';

const ext = (over: Partial<ExternalFood>): ExternalFood => ({
  externalCode: 'D101-050000000-0001',
  name: '현미밥',
  makerName: null,
  dbClassName: '품목대표',
  category: '밥류',
  kcal: 172,
  carbsG: 38.9,
  proteinG: 3.1,
  fatG: 0.47,
  servingGrams: 230,
  basisLabel: '100g',
  volumeBased: false,
  missingNutrients: [],
  importedFoodId: null,
  ...over,
});

async function openMfds(user: ReturnType<typeof userEvent.setup>) {
  renderWithProviders(<App />, `/meals?date=${DAY}`);
  await user.click(await screen.findByText('식약처 식품영양성분DB에서 찾기'));
  return screen.getByRole('search', { name: '식약처 식품영양성분DB 검색' });
}

describe('식약처 DB 연동', () => {
  it('searches only on submit, imports by code only, then selects the food in servings', async () => {
    const { state } = createFakeServer();
    state.external = [
      ext({}),
      ext({
        externalCode: 'D401-050000000-0001',
        name: '순 현미밥',
        kcal: 129,
        servingGrams: 250,
        basisLabel: '100mL',
        volumeBased: true,
      }),
      ext({ externalCode: 'D202-1', name: '현미밥 마카롱', missingNutrients: ['carbsG', 'fatG'], servingGrams: null }),
    ];
    const user = userEvent.setup();
    const form = await openMfds(user);

    await user.type(within(form).getByLabelText('식약처 DB 검색어'), '현미밥');
    // 입력만으로는 외부 API를 호출하지 않는다(트래픽 한도 보호)
    expect(state.calls.some((c) => c.path === '/foods/external')).toBe(false);
    await user.click(within(form).getByRole('button', { name: '검색' }));

    const results = await screen.findByRole('list', { name: '식약처 DB 검색 결과' });
    expect(within(results).getByText('원본은 100mL 기준 · 1mL ≈ 1g으로 계산해요')).toBeInTheDocument();
    expect(within(results).getByText('탄수화물·지방 정보 없음(0으로 계산)')).toBeInTheDocument();
    expect(state.calls.find((c) => c.path === '/foods/external')).toBeDefined();

    await user.click(within(results).getByRole('button', { name: '순 현미밥 가져와서 선택' }));

    // 영양값은 보내지 않고 식품코드만 보낸다
    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/foods/import')?.body).toEqual({
        externalCode: 'D401-050000000-0001',
      }),
    );
    expect(await screen.findByText("'순 현미밥'을(를) 내 음식에 추가하고 선택했어요.")).toBeInTheDocument();
    expect(screen.getByText('순 현미밥', { selector: 'strong' })).toBeInTheDocument();
    expect(screen.getByLabelText('섭취량 (인분)')).toHaveValue(1);
    expect(screen.getByText(/1mL ≈ 1g으로 계산해요\.$/)).toBeInTheDocument();
    // 이미 가져온 항목은 '선택'으로 바뀐다
    expect(await within(results).findByRole('button', { name: '순 현미밥 선택' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '식단 추가' }));
    await waitFor(() =>
      expect(state.calls.find((c) => c.method === 'POST' && c.path === '/meals')?.body).toMatchObject({
        foodId: state.foods.find((f) => f.source === 'MFDS')?.id,
        grams: 250,
      }),
    );
  });

  it('shows the server message when the key is not configured', async () => {
    const { state } = createFakeServer();
    state.failures.set('GET /foods/external', {
      count: 1,
      status: 503,
      body: {
        code: 'MFDS_NOT_CONFIGURED',
        message: '식약처 DB 연동 키가 설정되지 않았어요. .env의 MFDS_SERVICE_KEY를 확인해 주세요.',
        fieldErrors: {},
      },
    });
    const user = userEvent.setup();
    const form = await openMfds(user);

    await user.type(within(form).getByLabelText('식약처 DB 검색어'), '콜라');
    await user.click(within(form).getByRole('button', { name: '검색' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('MFDS_SERVICE_KEY');
    // 자동 재시도하지 않는다
    expect(state.calls.filter((c) => c.path === '/foods/external')).toHaveLength(1);
  });

  it('suggests another scope when nothing is found', async () => {
    createFakeServer();
    const user = userEvent.setup();
    const form = await openMfds(user);

    await user.type(within(form).getByLabelText('식약처 DB 검색어'), '없는음식');
    await user.click(within(form).getByRole('button', { name: '검색' }));

    expect(await screen.findByText("'없는음식' 검색 결과가 없어요. 검색 범위를 바꿔 보세요.")).toBeInTheDocument();
  });
});
