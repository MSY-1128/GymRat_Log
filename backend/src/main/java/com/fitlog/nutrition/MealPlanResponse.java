package com.fitlog.nutrition;

import com.fitlog.meal.MealType;
import com.fitlog.profile.Goal;
import java.math.BigDecimal;
import java.util.List;

/**
 * 목표(근육량 증가·유지·체지방 감량)에 맞춘 하루 식단표.
 *
 * @param variant 같은 목표 안에서 식품 조합 번호(0부터). 바꾸면 다른 식품으로 짠다
 * @param notes   식단표를 쓸 때 알아 둘 점
 */
public record MealPlanResponse(
        Goal goal,
        int variant,
        Targets targets,
        List<PlanMeal> meals,
        Nutrition total,
        List<String> notes
) {

    /**
     * @param tdeeKcal     유지 열량(프로필의 BMR × 활동계수)
     * @param kcalRule     열량을 정한 근거
     * @param proteinRule  단백질을 정한 근거
     * @param fatPercent   지방이 열량에서 차지하는 비율(%)
     * @param carbsPerKg   탄수화물 g ÷ 체중
     */
    public record Targets(
            BigDecimal weightKg,
            BigDecimal tdeeKcal,
            BigDecimal kcal,
            String kcalRule,
            BigDecimal proteinG,
            BigDecimal proteinPerKg,
            String proteinRule,
            BigDecimal fatG,
            int fatPercent,
            BigDecimal carbsG,
            BigDecimal carbsPerKg
    ) {
    }

    /** sugarsG·sodiumMg·saturatedFatG는 목표(target)에서는 null. */
    public record Nutrition(BigDecimal kcal, BigDecimal carbsG, BigDecimal proteinG, BigDecimal fatG,
                            BigDecimal sugarsG, BigDecimal sodiumMg, BigDecimal saturatedFatG) {
    }

    /** @param sharePercent 하루 열량 중 이 끼니 몫(%) */
    public record PlanMeal(MealType mealType, int sharePercent, Nutrition target, Nutrition total,
                           List<PlanItem> items) {
    }

    /** @param role CARB·PROTEIN·FAT(양을 맞춘 식품), VEG·FRUIT(정해진 양) */
    public record PlanItem(Long foodId, String name, String role, BigDecimal grams, Nutrition nutrition) {
    }
}
