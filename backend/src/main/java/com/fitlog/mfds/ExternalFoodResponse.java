package com.fitlog.mfds;

import java.math.BigDecimal;
import java.util.List;

/**
 * 식약처 DB 검색 결과 1건(100g 기준). importedFoodId는 이미 가져온 경우 FitLog 음식 ID.
 *
 * @param dbGroupName 원본 식품군(음식/가공식품 등)
 * @param restaurant  외식 프랜차이즈 메뉴인지(식품군 '음식' + '상용제품')
 */
public record ExternalFoodResponse(
        String externalCode,
        String name,
        String makerName,
        String dbGroupName,
        String dbClassName,
        boolean restaurant,
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

    static final String GROUP_DISH = "음식";
    static final String CLASS_BRAND = "상용제품";

    static ExternalFoodResponse of(MfdsFoodCandidate c, Long importedFoodId) {
        boolean restaurant = GROUP_DISH.equals(c.dbGroupName()) && CLASS_BRAND.equals(c.dbClassName());
        return new ExternalFoodResponse(c.externalCode(), c.name(), c.makerName(), c.dbGroupName(),
                c.dbClassName(), restaurant, c.category(), c.kcal(), c.carbsG(), c.proteinG(), c.fatG(),
                c.servingGrams(), c.basisLabel(), c.volumeBased(), c.missingNutrients(), importedFoodId);
    }
}
