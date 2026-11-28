package com.fitlog.nutrition;

import com.fitlog.meal.MealType;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * 식단표에 쓰는 기본 식품(V8에서 식약처 식품영양성분DB 값으로 넣은 음식)과 끼니별 구성.
 *
 * <p>끼니마다 탄수화물·단백질·지방 역할 식품을 하나씩 고르고 그 양을 끼니 목표에 맞춘다. 채소·과일은 정해진 양을 넣는다.
 */
final class MealPlanCatalog {

    enum Role { CARB, PROTEIN, FAT, VEG, FRUIT }

    /**
     * @param code 식약처 식품코드(food.external_code)
     * @param minG 맞춘 양이 이보다 적으면 이 양으로 올린다(지방 역할은 절반 미만이면 뺀다)
     * @param stepG 반올림 단위
     * @param fixedG 채소·과일처럼 양을 고정할 때(그 외 0)
     */
    record Option(String code, int minG, int maxG, int stepG, int fixedG) {

        static Option solved(String code, int minG, int maxG, int stepG) {
            return new Option(code, minG, maxG, stepG, 0);
        }

        static Option fixed(String code, int grams) {
            return new Option(code, grams, grams, grams, grams);
        }
    }

    // 탄수화물
    static final String WHITE_RICE = "R101-008000349-0000";
    static final String BROWN_RICE = "R101-013000500-0000";
    static final String OAT_RICE = "R101-049000100-0001";
    static final String OATMEAL = "R101-001000000-0000";
    static final String SWEET_POTATO = "D107-128180000-0001";
    static final String POTATO = "D107-307170000-0001";
    static final String WHOLE_WHEAT_BREAD = "D302-100380000-0001";
    // 단백질
    static final String CHICKEN_BREAST = "R109-008000451-0000";
    static final String PORK_TENDERLOIN = "R109-014008751-0000";
    static final String BEEF_ROUND = "R109-027066201-0000";
    static final String MACKEREL = "R211-021013901-0000";
    static final String SALMON = "D308-388000000-0001";
    static final String EGG = "R110-003000046-0000";
    static final String EGG_WHITE = "R110-003005046-0000";
    static final String YOGURT = "R121-026061100-0000";
    // 채소·과일
    static final String BROCCOLI = "R106-092000047-0000";
    static final String SPINACH = "R106-115000047-0000";
    static final String LETTUCE = "R106-101143601-0000";
    static final String TOMATO = "R106-186000001-0000";
    static final String PAPRIKA = "R106-194008101-0000";
    static final String BANANA = "R108-037000001-0000";
    static final String KIWI = "R108-090020001-0000";
    // 지방
    static final String ALMOND = "R105-020000058-0000";
    static final String WALNUT = "R105-035000002-0000";
    static final String AVOCADO = "R108-064000001-0000";

    /** 끼니 → 역할 → 고를 수 있는 식품(변형 번호로 돌아가며 고른다). */
    static final Map<MealType, Map<Role, List<Option>>> SLOTS = new EnumMap<>(MealType.class);

    static {
        SLOTS.put(MealType.BREAKFAST, roles(
                List.of(Option.solved(OATMEAL, 30, 120, 5), Option.solved(WHOLE_WHEAT_BREAD, 35, 140, 5),
                        Option.solved(SWEET_POTATO, 80, 300, 10)),
                List.of(Option.solved(EGG, 50, 200, 50), Option.solved(YOGURT, 100, 300, 10),
                        Option.solved(EGG_WHITE, 60, 250, 10)),
                List.of(Option.solved(ALMOND, 10, 40, 5), Option.solved(WALNUT, 10, 30, 5)),
                List.of(),
                List.of(Option.fixed(BANANA, 100), Option.fixed(KIWI, 100), Option.fixed(TOMATO, 150))));
        SLOTS.put(MealType.LUNCH, roles(
                List.of(Option.solved(BROWN_RICE, 100, 350, 10), Option.solved(WHITE_RICE, 100, 350, 10),
                        Option.solved(OAT_RICE, 100, 300, 10), Option.solved(SWEET_POTATO, 100, 350, 10)),
                List.of(Option.solved(CHICKEN_BREAST, 60, 250, 10), Option.solved(BEEF_ROUND, 60, 250, 10),
                        Option.solved(PORK_TENDERLOIN, 60, 250, 10), Option.solved(SALMON, 60, 220, 10)),
                List.of(Option.solved(AVOCADO, 30, 120, 10), Option.solved(ALMOND, 10, 40, 5)),
                List.of(Option.fixed(BROCCOLI, 100), Option.fixed(SPINACH, 80), Option.fixed(PAPRIKA, 80)),
                List.of()));
        SLOTS.put(MealType.DINNER, roles(
                List.of(Option.solved(WHITE_RICE, 100, 350, 10), Option.solved(POTATO, 150, 450, 10),
                        Option.solved(BROWN_RICE, 100, 350, 10), Option.solved(OAT_RICE, 100, 300, 10)),
                List.of(Option.solved(SALMON, 60, 220, 10), Option.solved(PORK_TENDERLOIN, 60, 250, 10),
                        Option.solved(MACKEREL, 60, 200, 10), Option.solved(CHICKEN_BREAST, 60, 250, 10),
                        Option.solved(BEEF_ROUND, 60, 250, 10)),
                List.of(Option.solved(AVOCADO, 30, 120, 10), Option.solved(WALNUT, 10, 30, 5)),
                List.of(Option.fixed(LETTUCE, 80), Option.fixed(BROCCOLI, 100), Option.fixed(TOMATO, 100),
                        Option.fixed(SPINACH, 80)),
                List.of()));
        SLOTS.put(MealType.SNACK, roles(
                List.of(Option.solved(BANANA, 60, 250, 10), Option.solved(SWEET_POTATO, 60, 250, 10),
                        Option.solved(KIWI, 60, 250, 10)),
                List.of(Option.solved(YOGURT, 100, 300, 10), Option.solved(EGG, 50, 150, 50)),
                List.of(Option.solved(WALNUT, 10, 30, 5), Option.solved(ALMOND, 10, 40, 5)),
                List.of(),
                List.of()));
    }

    private static Map<Role, List<Option>> roles(List<Option> carb, List<Option> protein, List<Option> fat,
                                                 List<Option> veg, List<Option> fruit) {
        Map<Role, List<Option>> m = new EnumMap<>(Role.class);
        m.put(Role.CARB, carb);
        m.put(Role.PROTEIN, protein);
        m.put(Role.FAT, fat);
        m.put(Role.VEG, veg);
        m.put(Role.FRUIT, fruit);
        return m;
    }

    static List<String> allCodes() {
        return SLOTS.values().stream().flatMap(r -> r.values().stream()).flatMap(List::stream).map(Option::code)
                .distinct().toList();
    }

    private MealPlanCatalog() {
    }
}
