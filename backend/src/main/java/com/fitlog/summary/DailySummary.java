package com.fitlog.summary;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 일별 요약. 값은 반올림하지 않은 서버 계산값이며 화면에서 반올림한다.
 *
 * @param sugarsG        정보가 있는 기록만 더한 당류(g). 나트륨(mg)·포화지방(g)도 같다
 * @param mealCount      식단 기록 수
 * @param sugarsMissing  당류 정보가 없어 합계에서 빠진 기록 수
 */
public record DailySummary(
        LocalDate date,
        BigDecimal consumedKcal,
        Integer targetKcal,
        BigDecimal remainingKcal,
        BigDecimal exerciseKcal,
        int exerciseMinutes,
        BigDecimal carbsG,
        BigDecimal proteinG,
        BigDecimal fatG,
        BigDecimal sugarsG,
        BigDecimal sodiumMg,
        BigDecimal saturatedFatG,
        int mealCount,
        int sugarsMissing,
        int sodiumMissing,
        int saturatedFatMissing
) {
}
