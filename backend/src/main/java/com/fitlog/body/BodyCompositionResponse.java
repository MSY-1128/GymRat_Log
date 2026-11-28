package com.fitlog.body;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 정형화된 측정 기록. 단위는 kg(체수분만 L), 체지방률 %, 비율은 소수.
 *
 * @param fatMassKg          체지방량(입력값 또는 체중 × 체지방률로 계산해 저장한 값)
 * @param leanMassKg         제지방량 = 체중 − 체지방량
 * @param appendicularLeanKg 사지 근육량(팔·다리 부위별 근육량 합). 네 부위가 다 있어야 계산
 */
public record BodyCompositionResponse(
        Long id,
        LocalDate measuredOn,
        BigDecimal weightKg,
        BigDecimal bodyWaterL,
        BigDecimal proteinKg,
        BigDecimal mineralKg,
        BigDecimal fatMassKg,
        BigDecimal skeletalMuscleKg,
        BigDecimal bodyFatPct,
        BigDecimal leanMassKg,
        Segments.Lean segmentalLean,
        Segments.Fat segmentalFat,
        BigDecimal appendicularLeanKg,
        Integer measuredBmrKcal,
        Integer visceralFatLevel,
        BigDecimal ecwRatio,
        BigDecimal waistHipRatio,
        Integer inbodyScore
) {

    public static BodyCompositionResponse from(BodyComposition b) {
        return new BodyCompositionResponse(b.getId(), b.getMeasuredOn(), b.getWeightKg(), b.getBodyWaterL(),
                b.getProteinKg(), b.getMineralKg(), b.getBodyFatMassKg(), b.getSkeletalMuscleKg(), b.getBodyFatPct(),
                b.getLeanMassKg(), b.getSegmentalLean(), b.getSegmentalFat(), b.getSegmentalLean().appendicular(),
                b.getMeasuredBmrKcal(), b.getVisceralFatLevel(), b.getEcwRatio(), b.getWaistHipRatio(),
                b.getInbodyScore());
    }
}
