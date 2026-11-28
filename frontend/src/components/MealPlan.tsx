import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useMealPlan, useProfile, useSaveMeal } from '../api/hooks';
import { MEAL_TYPES, type Goal, type MealPlan as MealPlanData, type PlanMeal, type PlanNutrition } from '../api/types';
import { formatShortDate } from '../lib/date';
import { formatAmount, formatGram, formatKcal } from '../lib/format';
import ui from '../styles/ui.module.css';
import { ErrorState, Loading, errorMessage } from './QueryState';
import styles from './MealPlan.module.css';

export const PLAN_GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: 'GAIN', label: '근육량 증가', hint: '열량 +10% · 단백질 1.8g/kg' },
  { value: 'MAINTAIN', label: '유지', hint: '유지 열량 · 단백질 1.6g/kg' },
  { value: 'LOSE', label: '체지방 감량', hint: '열량 −20% · 단백질 2.2g/kg' },
];

/** 식단표·안내에 쓴 근거. 화면 하단 '근거 자료'에 그대로 보여 준다. */
export const REFERENCES: { text: string; url?: string }[] = [
  {
    text: 'Jäger R, et al. International Society of Sports Nutrition position stand: protein and exercise. J Int Soc Sports Nutr. 2017;14:20.',
    url: 'https://doi.org/10.1186/s12970-017-0177-8',
  },
  {
    text: 'Aragon AA, et al. International Society of Sports Nutrition position stand: diets and body composition. J Int Soc Sports Nutr. 2017;14:16.',
    url: 'https://doi.org/10.1186/s12970-017-0174-y',
  },
  {
    text: 'Kerksick CM, et al. International Society of Sports Nutrition position stand: nutrient timing. J Int Soc Sports Nutr. 2017;14:33.',
    url: 'https://doi.org/10.1186/s12970-017-0189-4',
  },
  {
    text: 'Thomas DT, Erdman KA, Burke LM. American College of Sports Medicine Joint Position Statement: Nutrition and Athletic Performance. Med Sci Sports Exerc. 2016;48(3):543–568.',
    url: 'https://doi.org/10.1249/MSS.0000000000000852',
  },
  {
    text: 'Sawka MN, et al. American College of Sports Medicine position stand: Exercise and fluid replacement. Med Sci Sports Exerc. 2007;39(2):377–390.',
    url: 'https://doi.org/10.1249/mss.0b013e31802ca597',
  },
  {
    text: 'Helms ER, Aragon AA, Fitschen PJ. Evidence-based recommendations for natural bodybuilding contest preparation: nutrition and supplementation. J Int Soc Sports Nutr. 2014;11:20.',
    url: 'https://doi.org/10.1186/1550-2783-11-20',
  },
  {
    text: 'Iraki J, Fitschen P, Espinar S, Helms E. Nutrition recommendations for bodybuilders in the off-season: a narrative review. Sports. 2019;7(7):154.',
    url: 'https://doi.org/10.3390/sports7070154',
  },
  {
    text: 'World Health Organization. Guideline: Sodium intake for adults and children. 2012.',
    url: 'https://www.who.int/publications/i/item/9789241504836',
  },
  {
    text: 'World Health Organization. Guideline: Sugars intake for adults and children. 2015.',
    url: 'https://www.who.int/publications/i/item/9789241549028',
  },
  {
    text: 'World Health Organization. Saturated fatty acid and trans-fatty acid intake for adults and children: WHO guideline. 2023.',
    url: 'https://www.who.int/publications/i/item/9789240073630',
  },
  {
    text: 'Gallagher D, et al. Healthy percentage body fat ranges: an approach for developing guidelines based on body mass index. Am J Clin Nutr. 2000;72(3):694–701. (체지방률 건강 범위)',
    url: 'https://doi.org/10.1093/ajcn/72.3.694',
  },
  {
    text: 'Kelly TL, Wilson KE, Heymsfield SB. Dual energy X-ray absorptiometry body composition reference values from NHANES. PLoS One. 2009;4(9):e7038. (체지방량지수)',
    url: 'https://doi.org/10.1371/journal.pone.0007038',
  },
  {
    text: 'Chen LK, et al. Asian Working Group for Sarcopenia: 2019 consensus update on sarcopenia diagnosis and treatment. J Am Med Dir Assoc. 2020;21(3):300–307. (사지근육지수)',
    url: 'https://doi.org/10.1016/j.jamda.2019.12.012',
  },
  { text: 'WHO Western Pacific Region, IASO, IOTF. The Asia-Pacific perspective: redefining obesity and its treatment. 2000. (BMI)' },
  {
    text: 'World Health Organization. Waist circumference and waist–hip ratio: report of a WHO expert consultation. 2008. (복부지방률)',
    url: 'https://www.who.int/publications/i/item/9789241501491',
  },
  { text: '보건복지부·한국영양학회. 2020 한국인 영양소 섭취기준. 2020.' },
  { text: '식품의약품안전처. 식품등의 표시기준 — 1일 영양성분 기준치(나트륨 2,000mg·당류 100g·포화지방 15g).' },
  {
    text: '식품의약품안전처. 식품영양성분 데이터베이스(식단표 식품의 영양값).',
    url: 'https://various.foodsafetykorea.go.kr/nutrient/',
  },
];

const mealLabel = (t: string) => MEAL_TYPES.find((m) => m.value === t)?.label ?? t;

function macroLine(n: PlanNutrition) {
  return `탄 ${formatGram(n.carbsG)} · 단 ${formatGram(n.proteinG)} · 지 ${formatGram(n.fatG)}g`;
}

/** 목표(근육량 증가·유지·감량)에 맞춘 하루 아침·점심·저녁·간식 식단표. 끼니별로 바로 기록할 수 있다. */
export function MealPlan({ date }: { date: string }) {
  const profile = useProfile();
  const [goal, setGoal] = useState<Goal | null>(null);
  const [variant, setVariant] = useState(0);
  const [status, setStatus] = useState('');
  const goalName = useId();
  const effectiveGoal: Goal = goal ?? profile.data?.goal ?? 'MAINTAIN';
  const hasProfile = profile.isSuccess && profile.data != null;
  const plan = useMealPlan(effectiveGoal, variant, hasProfile);

  useEffect(() => setStatus(''), [effectiveGoal, variant, date]);

  return (
    <section className={ui.card} aria-labelledby="plan-title">
      <h2 id="plan-title" className={ui.cardTitle}>
        식단표 만들기
      </h2>
      <p className={styles.lead}>
        목표에 맞춰 하루 열량과 탄수화물·단백질·지방을 정하고 아침·점심·저녁·간식으로 나눠 짜 드려요. 기준은 국제스포츠영양학회(ISSN)와
        미국스포츠의학회(ACSM) 권고이고, 식품 영양값은 식약처 식품영양성분DB예요.
      </p>

      <fieldset className={styles.goals}>
        <legend className={styles.goalsLabel}>목표</legend>
        <div className={styles.segments}>
          {PLAN_GOALS.map((g) => (
            <label key={g.value} className={styles.segment}>
              <input
                type="radio"
                name={goalName}
                value={g.value}
                checked={effectiveGoal === g.value}
                onChange={() => {
                  setGoal(g.value);
                  setVariant(0);
                }}
              />
              <span className={styles.segmentLabel}>{g.label}</span>
              <span className={styles.segmentHint}>{g.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {profile.isPending ? (
        <Loading />
      ) : !hasProfile ? (
        <p className={ui.notice}>
          식단표를 만들려면 먼저 <Link to="/settings">설정</Link>에서 프로필(키·체중·나이·활동량)을 저장해 주세요.
        </p>
      ) : plan.isPending ? (
        <Loading />
      ) : plan.isError ? (
        plan.error instanceof ApiError && plan.error.code === 'PROFILE_REQUIRED' ? (
          <p className={ui.notice}>{plan.error.message}</p>
        ) : (
          <ErrorState error={plan.error} onRetry={() => plan.refetch()} />
        )
      ) : (
        <div className={styles.body} aria-busy={plan.isFetching}>
          <BodyBasis body={plan.data.body} />
          <dl className={styles.targets}>
            <div className={styles.target}>
              <dt>열량</dt>
              <dd>
                <strong>{formatKcal(plan.data.targets.kcal)}</strong> kcal
              </dd>
              <dd className={styles.targetNote}>유지 {formatKcal(plan.data.targets.tdeeKcal)}kcal 기준</dd>
            </div>
            <div className={styles.target}>
              <dt>단백질</dt>
              <dd>
                <strong>{formatKcal(plan.data.targets.proteinG)}</strong> g
              </dd>
              <dd className={styles.targetNote}>
                {plan.data.body.leanMassKg != null
                  ? `제지방 1kg당 ${formatAmount(Math.round((plan.data.targets.proteinG / plan.data.body.leanMassKg) * 10) / 10)}g`
                  : `체중 1kg당 ${formatAmount(plan.data.targets.proteinPerKg)}g`}
              </dd>
            </div>
            <div className={styles.target}>
              <dt>탄수화물</dt>
              <dd>
                <strong>{formatKcal(plan.data.targets.carbsG)}</strong> g
              </dd>
              <dd className={styles.targetNote}>체중 1kg당 {formatAmount(plan.data.targets.carbsPerKg)}g</dd>
            </div>
            <div className={styles.target}>
              <dt>지방</dt>
              <dd>
                <strong>{formatKcal(plan.data.targets.fatG)}</strong> g
              </dd>
              <dd className={styles.targetNote}>열량의 {plan.data.targets.fatPercent}%</dd>
            </div>
          </dl>
          <ul className={styles.rules}>
            <li>열량: {plan.data.targets.kcalRule}</li>
            <li>단백질: {plan.data.targets.proteinRule}</li>
            <li>지방: 열량의 20~35% 권장 범위 중 25% (ACSM 2016). 탄수화물: 나머지 열량</li>
          </ul>

          <div className={styles.meals}>
            {plan.data.meals.map((m) => (
              <PlanMealCard key={m.mealType} meal={m} date={date} onDone={setStatus} />
            ))}
          </div>
          <p className={ui.status} role="status">
            {status}
          </p>

          <p className={styles.total} data-testid="plan-total">
            하루 합계 <strong>{formatKcal(plan.data.total.kcal)}kcal</strong> · {macroLine(plan.data.total)} · 나트륨{' '}
            {formatKcal(plan.data.total.sodiumMg)}mg · 당류 {formatGram(plan.data.total.sugarsG)}g
          </p>
          <div className={ui.actions}>
            <button type="button" className={ui.secondary} onClick={() => setVariant((v) => v + 1)} disabled={plan.isFetching}>
              다른 식품으로 짜기
            </button>
          </div>

          <ul className={styles.notes}>
            {plan.data.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <details className={styles.refs}>
        <summary>근거 자료</summary>
        <ol>
          {REFERENCES.map((r) => (
            <li key={r.text}>
              {r.text}{' '}
              {r.url && (
                <a href={r.url} target="_blank" rel="noreferrer noopener">
                  링크
                </a>
              )}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}

const BMR_SOURCE = { MEASURED: '인바디 측정', LEAN_MASS: '제지방량 공식', PROFILE: '프로필 계산' } as const;

/** 식단표가 어떤 몸 기준으로 짜였는지(체성분 측정일·체지방률 판정·제지방량·기초대사량 출처). */
function BodyBasis({ body: b }: { body: MealPlanData['body'] }) {
  if (b.source === 'PROFILE') {
    return (
      <p className={ui.notice} data-testid="plan-body">
        체성분 기록이 없어 프로필 체중 {formatAmount(b.weightKg)}kg과 공식으로 계산했어요.{' '}
        <Link to="/body">체성분</Link>을 기록하면 제지방량 기준으로 짜요.
      </p>
    );
  }
  return (
    <div className={styles.basis} data-testid="plan-body">
      <strong>체성분 기준</strong> {b.measuredOn ? formatShortDate(b.measuredOn) : ''} 측정 · 체중 {formatAmount(b.weightKg)}kg
      {b.bodyFatPct != null && (
        <>
          {' '}· 체지방률 {formatAmount(b.bodyFatPct)}%
          {b.bodyFatLabel && (
            <>
              {' '}({b.bodyFatLabel}
              {b.bodyFatNormalLow != null && `, 건강 범위 ${b.bodyFatNormalLow}~${b.bodyFatNormalHigh}%`})
            </>
          )}
        </>
      )}
      {b.leanMassKg != null && <> · 제지방량 {formatAmount(b.leanMassKg)}kg</>} · 기초대사량 {formatKcal(b.bmrKcal)}kcal(
      {BMR_SOURCE[b.bmrSource]})
    </div>
  );
}

function PlanMealCard({ meal, date, onDone }: { meal: PlanMeal; date: string; onDone: (msg: string) => void }) {
  const save = useSaveMeal();
  const [busy, setBusy] = useState(false);
  const label = mealLabel(meal.mealType);

  /** 끼니의 음식을 차례로 기록한다. 중간에 실패하면 몇 개까지 기록했는지 알린다. */
  const record = async () => {
    setBusy(true);
    let done = 0;
    try {
      for (const item of meal.items) {
        await save.mutateAsync({ input: { date, mealType: meal.mealType, foodId: item.foodId, grams: item.grams } });
        done++;
      }
      onDone(`${label} 식단 ${done}개를 기록했어요.`);
    } catch (e) {
      onDone(`${label} 식단을 ${done}개까지 기록하고 멈췄어요. ${errorMessage(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={styles.meal} aria-labelledby={`plan-${meal.mealType}`} data-testid={`plan-${meal.mealType}`}>
      <div className={styles.mealHead}>
        <h3 id={`plan-${meal.mealType}`} className={styles.mealTitle}>
          {label} <span className={styles.share}>{meal.sharePercent}%</span>
        </h3>
        <span className={styles.mealKcal}>{formatKcal(meal.total.kcal)} kcal</span>
      </div>
      <ul className={styles.foods}>
        {meal.items.map((i) => (
          <li key={i.foodId} className={styles.food}>
            <span className={styles.foodName}>{i.name}</span>
            <span className={styles.foodGrams}>{formatAmount(i.grams)}g</span>
            <span className={styles.foodKcal}>{formatKcal(i.nutrition.kcal)}kcal</span>
          </li>
        ))}
      </ul>
      <p className={styles.mealMacros}>{macroLine(meal.total)}</p>
      <button
        type="button"
        className={`${ui.secondary} ${ui.small}`}
        onClick={record}
        disabled={busy}
        aria-label={`${label} 식단표를 ${date} 기록에 추가`}
      >
        {busy ? '기록 중…' : `${label}에 기록하기`}
      </button>
    </article>
  );
}
