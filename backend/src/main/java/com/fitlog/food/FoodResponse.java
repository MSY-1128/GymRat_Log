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
        Source source
) {

    public static FoodResponse from(Food f) {
        return new FoodResponse(f.getId(), f.getName(), f.getKcal(), f.getCarbsG(), f.getProteinG(), f.getFatG(),
                f.getServingGrams(), f.getSource());
    }
}
