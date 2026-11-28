package com.fitlog.food;

import com.fitlog.common.Source;
import java.math.BigDecimal;

public record FoodResponse(
        Long id,
        String name,
        BigDecimal kcal,
        BigDecimal carbsG,
        BigDecimal proteinG,
        BigDecimal fatG,
        BigDecimal servingGrams,
        Source source,
        /* 원본이 100mL 기준(1mL ≈ 1g 근사)인지 */
        boolean volumeBased,
        /* 100g 기준. 모르면 null */
        BigDecimal sugarsG,
        BigDecimal sodiumMg,
        BigDecimal saturatedFatG
) {

    public static FoodResponse from(Food f) {
        LimitNutrients l = f.getLimits();
        return new FoodResponse(f.getId(), f.getName(), f.getKcal(), f.getCarbsG(), f.getProteinG(), f.getFatG(),
                f.getServingGrams(), f.getSource(), f.isVolumeBased(), l.sugarsG(), l.sodiumMg(), l.saturatedFatG());
    }
}
