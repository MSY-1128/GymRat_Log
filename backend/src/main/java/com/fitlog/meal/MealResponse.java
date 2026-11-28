package com.fitlog.meal;

import com.fitlog.food.LimitNutrients;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MealResponse(
        Long id,
        LocalDate date,
        MealType mealType,
        Long foodId,
        BigDecimal grams,
        String foodNameSnapshot,
        BigDecimal kcalPer100Snapshot,
        BigDecimal carbsPer100Snapshot,
        BigDecimal proteinPer100Snapshot,
        BigDecimal fatPer100Snapshot,
        BigDecimal calculatedKcal,
        BigDecimal carbsG,
        BigDecimal proteinG,
        BigDecimal fatG,
        /* 섭취량 기준. 음식에 정보가 없으면 null */
        BigDecimal sugarsG,
        BigDecimal sodiumMg,
        BigDecimal saturatedFatG
) {

    public static MealResponse from(MealEntry m) {
        LimitNutrients limits = m.calculatedLimits();
        return new MealResponse(m.getId(), m.getDate(), m.getMealType(), m.getFoodId(), m.getGrams(),
                m.getFoodNameSnapshot(), m.getKcalPer100Snapshot(), m.getCarbsPer100Snapshot(),
                m.getProteinPer100Snapshot(), m.getFatPer100Snapshot(), m.calculatedKcal(),
                m.calculatedCarbsG(), m.calculatedProteinG(), m.calculatedFatG(), limits.sugarsG(),
                limits.sodiumMg(), limits.saturatedFatG());
    }
}
