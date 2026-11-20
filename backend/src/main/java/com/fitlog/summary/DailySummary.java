package com.fitlog.summary;

import java.math.BigDecimal;
import java.time.LocalDate;

/** 일별 요약. 값은 반올림하지 않은 서버 계산값이며 화면에서 반올림한다. */
public record DailySummary(
        LocalDate date,
        BigDecimal consumedKcal,
        Integer targetKcal,
        BigDecimal remainingKcal,
        BigDecimal exerciseKcal,
        int exerciseMinutes,
        BigDecimal carbsG,
        BigDecimal proteinG,
        BigDecimal fatG
) {
}
