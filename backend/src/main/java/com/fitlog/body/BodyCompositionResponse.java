package com.fitlog.body;

import com.fitlog.common.Calculator;
import java.math.BigDecimal;
import java.time.LocalDate;

/** 입력값 + 체지방률로 계산한 체지방량·제지방량(체지방률이 없으면 null). */
public record BodyCompositionResponse(
        Long id,
        LocalDate measuredOn,
        BigDecimal weightKg,
        BigDecimal bodyFatPct,
        BigDecimal skeletalMuscleKg,
        Integer measuredBmrKcal,
        Integer visceralFatLevel,
        BigDecimal fatMassKg,
        BigDecimal leanMassKg
) {

    public static BodyCompositionResponse from(BodyComposition b) {
        return new BodyCompositionResponse(b.getId(), b.getMeasuredOn(), b.getWeightKg(), b.getBodyFatPct(),
                b.getSkeletalMuscleKg(), b.getMeasuredBmrKcal(), b.getVisceralFatLevel(),
                Calculator.fatMass(b.getWeightKg(), b.getBodyFatPct()),
                Calculator.leanMass(b.getWeightKg(), b.getBodyFatPct()));
    }
}
