package com.fitlog.mfds;

import java.math.BigDecimal;
import java.util.List;

/**
 * 식약처 원본 1건을 FitLog 기준(100g)으로 정규화한 가져오기 후보.
 *
 * @param name             FitLog에 저장할 이름(식품명 + 업체명, 100자 이내)
 * @param foodName         원본 식품명(FOOD_NM_KR)
 * @param basisLabel       원본 영양성분 기준량(예: 100g, 100mL)
 * @param volumeBased      원본이 mL 기준이라 1mL ≈ 1g으로 근사했는지
 * @param servingGrams     1회 섭취참고량 또는 식품 중량(g, mL은 근사). 없거나 범위 밖이면 null
 * @param missingNutrients 원본에 값이 없어 0으로 둔 영양소(carbsG, proteinG, fatG)
 */
public record MfdsFoodCandidate(
        String externalCode,
        String name,
        String foodName,
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
        List<String> missingNutrients
) {
}
