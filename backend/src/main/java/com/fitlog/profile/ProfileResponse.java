package com.fitlog.profile;

import com.fitlog.common.Calculator;
import com.fitlog.common.SexForFormula;
import java.math.BigDecimal;
import java.time.Instant;

public record ProfileResponse(
        Long id,
        int age,
        SexForFormula sexForFormula,
        BigDecimal heightCm,
        BigDecimal weightKg,
        BigDecimal activityFactor,
        Goal goal,
        Integer dailyTargetKcal,
        BigDecimal bmrKcal,
        BigDecimal tdeeKcal,
        Instant updatedAt
) {

    public static ProfileResponse from(Profile p) {
        BigDecimal bmr = Calculator.bmr(p.getWeightKg(), p.getHeightCm(), p.getAge(), p.getSexForFormula());
        return new ProfileResponse(p.getId(), p.getAge(), p.getSexForFormula(), p.getHeightCm(), p.getWeightKg(),
                p.getActivityFactor(), p.getGoal(), p.getDailyTargetKcal(), bmr,
                Calculator.tdee(bmr, p.getActivityFactor()), p.getUpdatedAt());
    }
}
