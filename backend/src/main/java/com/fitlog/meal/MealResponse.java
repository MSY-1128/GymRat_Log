package com.fitlog.meal;

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
        BigDecimal fatG
) {

    public static MealResponse from(MealEntry m) {
        return new MealResponse(m.getId(), m.getDate(), m.getMealType(), m.getFoodId(), m.getGrams(),
                m.getFoodNameSnapshot(), m.getKcalPer100Snapshot(), m.getCarbsPer100Snapshot(),
                m.getProteinPer100Snapshot(), m.getFatPer100Snapshot(), m.calculatedKcal(),
                m.calculatedCarbsG(), m.calculatedProteinG(), m.calculatedFatG());
    }
}
