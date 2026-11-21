package com.fitlog.mfds;

import java.math.BigDecimal;
import java.util.List;

/** 식약처 DB 검색 결과 1건(100g 기준). importedFoodId는 이미 가져온 경우 FitLog 음식 ID. */
public record ExternalFoodResponse(
        String externalCode,
        String name,
        String makerName,
        String dbClassName,
        String category,
        BigDecimal kcal,
        BigDecimal carbsG,
        BigDecimal proteinG,
        BigDecimal fatG,
        BigDecimal servingGrams,
        String basisLabel,
        boolean volumeBased,
        List<String> missingNutrients,
        Long importedFoodId
) {

    static ExternalFoodResponse of(MfdsFoodCandidate c, Long importedFoodId) {
        return new ExternalFoodResponse(c.externalCode(), c.name(), c.makerName(), c.dbClassName(), c.category(),
                c.kcal(), c.carbsG(), c.proteinG(), c.fatG(), c.servingGrams(), c.basisLabel(), c.volumeBased(),
                c.missingNutrients(), importedFoodId);
    }
}
