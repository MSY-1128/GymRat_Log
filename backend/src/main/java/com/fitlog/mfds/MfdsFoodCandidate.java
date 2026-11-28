package com.fitlog.mfds;

import com.fitlog.food.LimitNutrients;
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
 * @param limits           당류·나트륨·포화지방(100g 기준, 모르면 각각 null)
 * @param missingNutrients 원본에 값이 없어 0으로 둔 영양소(carbsG, proteinG, fatG)
 * @param dbGroupName      원본 식품군(음식/가공식품/농축산물 등). 음식 + 상용제품이면 외식 프랜차이즈 메뉴
 * @param itemReportNo     품목제조보고번호(가공식품만 있음)
 */
public record MfdsFoodCandidate(
        String externalCode,
        String name,
        String foodName,
        String makerName,
        String dbGroupName,
        String dbClassName,
        String category,
        BigDecimal kcal,
        BigDecimal carbsG,
        BigDecimal proteinG,
        BigDecimal fatG,
        LimitNutrients limits,
        BigDecimal servingGrams,
        String basisLabel,
        boolean volumeBased,
        List<String> missingNutrients,
        String itemReportNo
) {
}
