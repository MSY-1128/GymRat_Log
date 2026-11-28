package com.fitlog.nutrition;

import com.fitlog.body.BodyComposition;
import com.fitlog.body.BodyCompositionRepository;
import com.fitlog.body.BodyStandards;
import com.fitlog.body.BodyStandards.Judgement;
import com.fitlog.body.BodyStandards.Level;
import com.fitlog.common.ApiException;
import com.fitlog.common.Calculator;
import com.fitlog.food.Food;
import com.fitlog.food.FoodRepository;
import com.fitlog.food.LimitNutrients;
import com.fitlog.meal.MealType;
import com.fitlog.nutrition.MealPlanCatalog.Option;
import com.fitlog.nutrition.MealPlanCatalog.Role;
import com.fitlog.nutrition.MealPlanResponse.Body;
import com.fitlog.nutrition.MealPlanResponse.Nutrition;
import com.fitlog.nutrition.MealPlanResponse.PlanItem;
import com.fitlog.nutrition.MealPlanResponse.PlanMeal;
import com.fitlog.nutrition.MealPlanResponse.Targets;
import com.fitlog.profile.Goal;
import com.fitlog.profile.ProfileResponse;
import com.fitlog.profile.ProfileService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 목표별 하루 식단표.
 *
 * <ul>
 *   <li>열량: 유지 열량(TDEE) 기준. 근육량 증가 +10%, 체지방 감량 −20%(기초대사량 아래로는 내리지 않음)</li>
 *   <li>단백질: 체중 1kg당 증가 1.8g · 유지 1.6g · 감량 2.2g. 설정에서 단백질 목표를 정했으면 그 값</li>
 *   <li>지방: 열량의 25%. 탄수화물: 나머지</li>
 *   <li>끼니 몫: 아침 25% · 점심 30% · 저녁 30% · 간식 15%</li>
 * </ul>
 */
@Service
public class MealPlanService {

    static final BigDecimal GAIN_FACTOR = new BigDecimal("1.10");
    static final BigDecimal LOSE_FACTOR = new BigDecimal("0.80");
    /** 체지방률이 건강 범위보다 높을 때 증량 잉여, 건강 범위·그 아래일 때 감량 폭(Helms 2014: 마를수록 천천히). */
    static final BigDecimal GAIN_FACTOR_HIGH_FAT = new BigDecimal("1.05");
    static final BigDecimal LOSE_FACTOR_NORMAL_FAT = new BigDecimal("0.85");
    static final BigDecimal LOSE_FACTOR_LOW_FAT = new BigDecimal("0.90");
    /** 제지방 1kg당 단백질(g). 증가·유지는 체중 기준 1.8·1.6g을 체지방률 15%로 환산, 감량은 Helms 2014 2.3~3.1g 가운데. */
    static final BigDecimal PROTEIN_PER_LEAN_GAIN = new BigDecimal("2.1");
    static final BigDecimal PROTEIN_PER_LEAN_MAINTAIN = new BigDecimal("1.9");
    static final BigDecimal PROTEIN_PER_LEAN_LOSE = new BigDecimal("2.6");
    static final int FAT_PERCENT = 25;
    static final Map<MealType, Integer> SHARES = new EnumMap<>(Map.of(
            MealType.BREAKFAST, 25, MealType.LUNCH, 30, MealType.DINNER, 30, MealType.SNACK, 15));
    /** 짜는 순서. 양 조절 폭이 큰 점심·저녁이 뒤에서 차이를 메운다. */
    static final List<MealType> BUILD_ORDER = List.of(MealType.BREAKFAST, MealType.SNACK, MealType.LUNCH,
            MealType.DINNER);
    static final int MAX_VARIANT = 999;
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final int SOLVE_ROUNDS = 30;


    private final ProfileService profileService;
    private final FoodRepository foods;
    private final BodyCompositionRepository bodies;

    public MealPlanService(ProfileService profileService, FoodRepository foods, BodyCompositionRepository bodies) {
        this.profileService = profileService;
        this.foods = foods;
        this.bodies = bodies;
    }

    @Transactional(readOnly = true)
    public MealPlanResponse plan(Long userId, Goal requestedGoal, int variant) {
        if (variant < 0 || variant > MAX_VARIANT) {
            throw ApiException.validation("variant", "0~" + MAX_VARIANT + " 사이여야 합니다.");
        }
        ProfileResponse profile = profileService.get(userId).orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                "PROFILE_REQUIRED", "식단표를 만들려면 설정에서 프로필을 저장해 주세요."));
        Body body = body(profile, bodies.findFirstByUserIdOrderByMeasuredOnDesc(userId).orElse(null));
        Goal goal = requestedGoal != null ? requestedGoal : profile.goal();
        Targets targets = targets(goal, profile, body);

        Map<String, Food> byCode = foods.findByExternalCodeIn(MealPlanCatalog.allCodes()).stream()
                .collect(Collectors.toMap(Food::getExternalCode, Function.identity()));
        Set<String> used = new HashSet<>();
        Map<MealType, PlanMeal> built = new EnumMap<>(MealType.class);
        // 작은 끼니(아침·간식)는 식품 최대량 때문에 목표를 다 못 채울 수 있다. 먼저 짜고, 모자라거나 넘친 양은
        // 남은 끼니가 몫(%)에 비례해 나눠 맡는다. 저녁이 마지막으로 하루 목표를 맞춘다.
        double[] remaining = {targets.carbsG().doubleValue(), targets.proteinG().doubleValue(),
                targets.fatG().doubleValue()};
        int remainingShare = 100;
        for (MealType type : BUILD_ORDER) {
            int share = SHARES.get(type);
            double r = (double) share / remainingShare;
            PlanMeal m = meal(type, targets, remaining[0] * r, remaining[1] * r, remaining[2] * r, byCode, variant,
                    used);
            built.put(type, m);
            remaining[0] -= m.total().carbsG().doubleValue();
            remaining[1] -= m.total().proteinG().doubleValue();
            remaining[2] -= m.total().fatG().doubleValue();
            remainingShare -= share;
        }
        List<PlanMeal> meals = List.copyOf(built.values());
        Nutrition total = sum(meals.stream().map(PlanMeal::total).toList());
        return new MealPlanResponse(goal, variant, body, targets, meals, total, notes(goal, body, meals));
    }

    /**
     * 식단표의 몸 기준. 가장 최근 체성분 측정을 우선 쓴다.
     * <ul>
     *   <li>체중: 측정 체중 → 프로필 체중</li>
     *   <li>기초대사량: 인바디 측정값 → 제지방량 공식(Katch-McArdle 370 + 21.6 × 제지방량) → 프로필 계산값</li>
     *   <li>체지방률 판정: Gallagher 2000 나이·성별 건강 범위</li>
     * </ul>
     */
    static Body body(ProfileResponse p, BodyComposition latest) {
        BigDecimal weight = latest != null ? latest.getWeightKg() : p.weightKg();
        BigDecimal lean = latest == null ? null : latest.getLeanMassKg();
        BigDecimal bmr;
        Body.BmrSource bmrSource;
        if (latest != null && latest.getMeasuredBmrKcal() != null) {
            bmr = BigDecimal.valueOf(latest.getMeasuredBmrKcal());
            bmrSource = Body.BmrSource.MEASURED;
        } else if (lean != null) {
            bmr = Calculator.bmrFromLeanMass(lean).setScale(0, RoundingMode.HALF_UP);
            bmrSource = Body.BmrSource.LEAN_MASS;
        } else if (p.bmrKcal() != null) {
            bmr = p.bmrKcal().setScale(0, RoundingMode.HALF_UP);
            bmrSource = Body.BmrSource.PROFILE;
        } else {
            throw new ApiException(HttpStatus.CONFLICT, "PROFILE_REQUIRED",
                    "기초대사량을 구할 수 없어요. 체성분(체지방률 또는 기초대사량)을 기록하거나 설정에서 성별을 입력해 주세요.");
        }
        Judgement fat = latest == null ? null : BodyStandards.bodyFatPct(p.sexForFormula(), p.age(),
                latest.getBodyFatPct());
        return new Body(latest != null ? Body.Source.BODY_COMPOSITION : Body.Source.PROFILE,
                latest == null ? null : latest.getMeasuredOn(), weight,
                latest == null ? null : latest.getBodyFatPct(), lean,
                latest == null ? null : latest.getSkeletalMuscleKg(), bmr, bmrSource,
                fat == null ? null : fat.level(), fat == null ? null : fat.label(),
                fat == null ? null : fat.normalLow(), fat == null ? null : fat.normalHigh());
    }

    static Targets targets(Goal goal, ProfileResponse p, Body body) {
        BigDecimal tdee = body.bmrKcal().multiply(p.activityFactor()).setScale(0, RoundingMode.HALF_UP);
        BigDecimal weight = body.weightKg();
        Level fatLevel = body.bodyFatLevel();
        boolean fatHigh = fatLevel == Level.HIGH || fatLevel == Level.VERY_HIGH;
        BigDecimal factor;
        String kcalRule;
        switch (goal) {
            case GAIN -> {
                if (fatHigh) {
                    factor = GAIN_FACTOR_HIGH_FAT;
                    kcalRule = "유지 열량보다 5% 많게. 체지방률이 건강 범위보다 높아 잉여를 줄였어요. 근육은 늘리고 체지방 증가는 "
                            + "줄이는 쪽 (ISSN 2017 식단과 체성분)";
                } else {
                    factor = GAIN_FACTOR;
                    kcalRule = "유지 열량보다 10% 많게. 근육은 늘리고 지방 증가는 줄이는 완만한 잉여 (ISSN 2017, Iraki 외 2019)";
                }
            }
            case LOSE -> {
                if (fatLevel == Level.LOW) {
                    factor = LOSE_FACTOR_LOW_FAT;
                    kcalRule = "유지 열량보다 10% 적게. 체지방률이 이미 건강 범위 아래라 천천히 줄여요. 더 줄이는 것은 권하지 않아요 "
                            + "(Helms 외 2014)";
                } else if (fatLevel == Level.NORMAL) {
                    factor = LOSE_FACTOR_NORMAL_FAT;
                    kcalRule = "유지 열량보다 15% 적게. 체지방률이 건강 범위라 근육 손실을 줄이려고 천천히 (Helms 외 2014)";
                } else {
                    factor = LOSE_FACTOR;
                    kcalRule = "유지 열량보다 20% 적게. 주당 체중의 0.5~1% 감량 범위 (Helms 외 2014)";
                }
            }
            default -> {
                factor = BigDecimal.ONE;
                kcalRule = "유지 열량(기초대사량 × 활동계수)";
            }
        }
        BigDecimal kcal = tdee.multiply(factor);
        if (goal == Goal.LOSE && kcal.compareTo(body.bmrKcal()) < 0) {
            kcal = body.bmrKcal();
            kcalRule += ". 기초대사량 아래로는 내리지 않았어요";
        }
        kcal = kcal.setScale(0, RoundingMode.HALF_UP);

        BigDecimal protein;
        String proteinRule;
        if (p.proteinTargetG() != null) {
            protein = p.proteinTargetG();
            proteinRule = "설정한 단백질 목표(제지방 1kg당 " + p.proteinGPerKgLean().stripTrailingZeros().toPlainString() + "g)";
        } else if (body.leanMassKg() != null) {
            BigDecimal perLean = switch (goal) {
                case GAIN -> PROTEIN_PER_LEAN_GAIN;
                case LOSE -> PROTEIN_PER_LEAN_LOSE;
                default -> PROTEIN_PER_LEAN_MAINTAIN;
            };
            protein = body.leanMassKg().multiply(perLean);
            proteinRule = "제지방량 " + body.leanMassKg().stripTrailingZeros().toPlainString() + "kg × " + perLean
                    .toPlainString() + "g. " + switch (goal) {
                        case LOSE -> "감량 중 권장 제지방 1kg당 2.3~3.1g의 가운데 값 (Helms 외 2014)";
                        default -> "체중 1kg당 " + (goal == Goal.GAIN ? "1.8" : "1.6")
                                + "g(ISSN 2017·ACSM 2016 권장 1.4~2.0g)을 체지방률 15% 기준 제지방량으로 바꾼 값. "
                                + "체지방이 많아도 단백질이 과하게 잡히지 않아요";
                    };
        } else {
            BigDecimal perKg = switch (goal) {
                case GAIN -> new BigDecimal("1.8");
                case LOSE -> new BigDecimal("2.2");
                default -> new BigDecimal("1.6");
            };
            protein = weight.multiply(perKg);
            proteinRule = "체중 1kg당 " + perKg.toPlainString() + "g. "
                    + switch (goal) {
                        case LOSE -> "감량 중에는 근육을 지키려고 더 높게 (ISSN 2017, Helms 외 2014)";
                        default -> "운동하는 사람 권장 1.4~2.0g (ISSN 2017, ACSM 2016)";
                    };
        }
        // 단백질이 열량의 40%를 넘지 않게(탄수화물·지방 몫 확보)
        BigDecimal proteinCap = kcal.multiply(new BigDecimal("0.40")).divide(BigDecimal.valueOf(4), 1, RoundingMode.HALF_UP);
        protein = protein.min(proteinCap).setScale(0, RoundingMode.HALF_UP);

        BigDecimal fat = kcal.multiply(BigDecimal.valueOf(FAT_PERCENT)).divide(HUNDRED)
                .divide(BigDecimal.valueOf(9), 0, RoundingMode.HALF_UP);
        BigDecimal carbs = kcal.subtract(protein.multiply(BigDecimal.valueOf(4))).subtract(fat.multiply(BigDecimal.valueOf(9)))
                .divide(BigDecimal.valueOf(4), 0, RoundingMode.HALF_UP).max(BigDecimal.ZERO);
        return new Targets(weight, tdee, kcal, kcalRule, protein,
                protein.divide(weight, 1, RoundingMode.HALF_UP), proteinRule, fat, FAT_PERCENT, carbs,
                carbs.divide(weight, 1, RoundingMode.HALF_UP));
    }

    /**
     * @param carbT·proteinT·fatT 이 끼니가 맞출 양(앞 끼니에서 넘어온 차이 포함). 화면의 끼니 목표(target)는 하루 목표 × 몫으로
     *                            따로 보여 준다.
     */
    private PlanMeal meal(MealType type, Targets t, double carbT, double proteinT, double fatT,
                          Map<String, Food> byCode, int variant, Set<String> used) {
        int share = SHARES.get(type);
        BigDecimal ratio = BigDecimal.valueOf(share).divide(HUNDRED);

        Map<Role, List<Option>> slot = MealPlanCatalog.SLOTS.get(type);
        List<Pick> picks = new ArrayList<>();
        for (Role role : List.of(Role.CARB, Role.PROTEIN, Role.VEG, Role.FRUIT, Role.FAT)) {
            int count = role == Role.VEG ? 2 : 1;
            int offset = role.ordinal() + type.ordinal();
            for (Option o : choose(slot.get(role), variant + offset, count, byCode, used)) {
                picks.add(new Pick(role, o, byCode.get(o.code()), o.fixedG()));
            }
        }
        solve(picks, carbT, proteinT, fatT);

        List<PlanItem> items = new ArrayList<>();
        for (Pick p : picks) {
            if (p.grams <= 0) {
                continue;
            }
            used.add(p.option.code());
            BigDecimal grams = BigDecimal.valueOf(p.grams);
            items.add(new PlanItem(p.food.getId(), p.food.getName(), p.role.name(), grams, nutrition(p.food, grams)));
        }
        Nutrition target = new Nutrition(t.kcal().multiply(ratio).setScale(0, RoundingMode.HALF_UP),
                t.carbsG().multiply(ratio).setScale(1, RoundingMode.HALF_UP),
                t.proteinG().multiply(ratio).setScale(1, RoundingMode.HALF_UP),
                t.fatG().multiply(ratio).setScale(1, RoundingMode.HALF_UP), null, null, null);
        return new PlanMeal(type, share, target, sum(items.stream().map(PlanItem::nutrition).toList()), items);
    }

    /** 변형 번호에서 시작해 다른 끼니에 이미 쓴 식품은 건너뛰고 count개를 고른다. 모두 썼으면 겹쳐도 고른다. */
    static List<Option> choose(List<Option> options, int start, int count, Map<String, Food> byCode,
                               Set<String> used) {
        List<Option> available = options.stream().filter(o -> byCode.containsKey(o.code())).toList();
        List<Option> out = new ArrayList<>();
        int n = available.size();
        for (int pass = 0; pass < 2 && out.size() < count; pass++) {
            for (int i = 0; i < n && out.size() < count; i++) {
                Option o = available.get((start + i) % n);
                if (out.contains(o) || (pass == 0 && used.contains(o.code()))) {
                    continue;
                }
                out.add(o);
            }
        }
        return out;
    }

    private static final class Pick {
        final Role role;
        final Option option;
        final Food food;
        int grams;

        Pick(Role role, Option option, Food food, int grams) {
            this.role = role;
            this.option = option;
            this.food = food;
            this.grams = grams;
        }

        double per100(Role macro) {
            return switch (macro) {
                case CARB -> food.getCarbsG().doubleValue();
                case PROTEIN -> food.getProteinG().doubleValue();
                default -> food.getFatG().doubleValue();
            } / 100.0;
        }
    }

    /**
     * 탄수화물·단백질·지방 역할 식품의 양을 번갈아 맞춘다(가우스-자이델 반복). 각 식품은 자기 영양소 목표에서
     * 다른 식품이 이미 채운 양을 뺀 만큼을 맡는다. 마지막에 반올림 단위·최소·최대로 정리한다.
     */
    static void solve(List<Pick> picks, double carbT, double proteinT, double fatT) {
        Map<Role, Double> target = Map.of(Role.CARB, carbT, Role.PROTEIN, proteinT, Role.FAT, fatT);
        double[] g = new double[picks.size()];
        for (int i = 0; i < g.length; i++) {
            g[i] = picks.get(i).grams;
        }
        for (int round = 0; round < SOLVE_ROUNDS; round++) {
            for (int i = 0; i < picks.size(); i++) {
                Pick p = picks.get(i);
                if (p.option.fixedG() > 0) {
                    continue;
                }
                double others = 0;
                for (int j = 0; j < picks.size(); j++) {
                    if (j != i) {
                        others += g[j] * picks.get(j).per100(p.role);
                    }
                }
                double density = p.per100(p.role);
                double grams = density <= 0 ? 0 : (target.get(p.role) - others) / density;
                g[i] = Math.clamp(grams, 0, p.option.maxG());
            }
        }
        for (int i = 0; i < picks.size(); i++) {
            Pick p = picks.get(i);
            if (p.option.fixedG() > 0) {
                continue;
            }
            Option o = p.option;
            if (p.role == Role.FAT && g[i] < o.minG() / 2.0) {
                p.grams = 0;
                continue;
            }
            int stepped = (int) Math.round(g[i] / o.stepG()) * o.stepG();
            p.grams = Math.clamp(stepped, o.minG(), o.maxG());
        }
    }

    static Nutrition nutrition(Food f, BigDecimal grams) {
        LimitNutrients l = f.getLimits();
        return new Nutrition(Calculator.perGrams(f.getKcal(), grams), Calculator.perGrams(f.getCarbsG(), grams),
                Calculator.perGrams(f.getProteinG(), grams), Calculator.perGrams(f.getFatG(), grams),
                l.sugarsG() == null ? null : Calculator.perGrams(l.sugarsG(), grams),
                l.sodiumMg() == null ? null : Calculator.perGrams(l.sodiumMg(), grams),
                l.saturatedFatG() == null ? null : Calculator.perGrams(l.saturatedFatG(), grams));
    }

    /** 합계. 값을 모르는 항목은 더하지 않는다(식단표 식품은 오트밀 당류·포화지방만 비어 있다). */
    static Nutrition sum(List<Nutrition> list) {
        BigDecimal[] s = new BigDecimal[7];
        java.util.Arrays.fill(s, BigDecimal.ZERO);
        for (Nutrition n : list) {
            BigDecimal[] v = {n.kcal(), n.carbsG(), n.proteinG(), n.fatG(), n.sugarsG(), n.sodiumMg(), n.saturatedFatG()};
            for (int i = 0; i < 7; i++) {
                if (v[i] != null) {
                    s[i] = s[i].add(v[i]);
                }
            }
        }
        return new Nutrition(s[0].setScale(0, RoundingMode.HALF_UP), s[1].setScale(1, RoundingMode.HALF_UP),
                s[2].setScale(1, RoundingMode.HALF_UP), s[3].setScale(1, RoundingMode.HALF_UP),
                s[4].setScale(1, RoundingMode.HALF_UP), s[5].setScale(0, RoundingMode.HALF_UP),
                s[6].setScale(1, RoundingMode.HALF_UP));
    }

    static List<String> notes(Goal goal, Body body, List<PlanMeal> meals) {
        List<String> notes = new ArrayList<>();
        if (body.source() == Body.Source.PROFILE) {
            notes.add("체성분 기록이 없어 프로필 체중과 공식으로 계산했어요. 체성분(체지방률·기초대사량)을 기록하면 제지방량 기준으로 "
                    + "더 정확하게 짜요.");
        } else if (body.bodyFatPct() == null) {
            notes.add("최근 체성분에 체지방률이 없어 제지방량 기준을 쓰지 못했어요. 체지방률이나 체지방량을 함께 기록해 주세요.");
        }
        if (goal == Goal.LOSE && body.bodyFatLevel() == Level.LOW) {
            notes.add("체지방률이 이미 건강 범위(" + body.bodyFatNormalLow() + "~" + body.bodyFatNormalHigh()
                    + "%) 아래예요. 감량보다 유지나 근육량 증가를 권해요.");
        }
        BigDecimal minProtein = meals.stream().map(m -> m.total().proteinG()).min(BigDecimal::compareTo)
                .orElse(BigDecimal.ZERO);
        notes.add("단백질을 하루 4번에 나눠 끼니마다 고르게 먹도록 짰어요. 끼니당 약 20~40g(체중 1kg당 0.25~0.4g)이 근육 합성에 "
                + "효과적이에요 (ISSN 2017). 이 식단표의 가장 적은 끼니는 " + minProtein.setScale(0, RoundingMode.HALF_UP)
                + "g이에요.");
        notes.add("운동 전후 몇 시간 안에 단백질과 탄수화물이 든 끼니나 간식을 두면 좋아요 (ISSN 영양 타이밍 2017).");
        switch (goal) {
            case GAIN -> notes.add("체중이 주당 0.25~0.5%씩 늘도록 2~4주마다 열량을 조절하세요. 더 빨리 늘면 지방이 주로 늘어요 "
                    + "(Iraki 외 2019).");
            case LOSE -> notes.add("감량 중에도 근력 운동을 유지해야 근육 손실을 줄일 수 있어요. 주당 체중의 1%보다 빨리 빠지면 "
                    + "열량을 조금 올리세요 (Helms 외 2014).");
            default -> notes.add("체중이 2~3주 동안 한쪽으로 계속 움직이면 열량을 100~200kcal씩 조절하세요.");
        }
        notes.add("양은 밥·구이는 조리 후, 채소·과일·생것은 손질한 무게예요. 식품 이름에 식약처 DB의 상태(생것·구운것 등)를 적었어요.");
        notes.add("조리할 때 넣는 소금·간장·기름은 포함되지 않았어요. 간을 하면 나트륨이 늘어나요.");
        notes.add("일반 성인을 위한 예시예요. 질환이 있거나 임신·수유 중이면 의사나 영양사와 상의하세요.");
        return notes;
    }
}
