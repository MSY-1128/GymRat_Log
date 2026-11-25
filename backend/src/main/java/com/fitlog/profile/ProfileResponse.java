package com.fitlog.profile;

import com.fitlog.body.BodyComposition;
import com.fitlog.common.Calculator;
import com.fitlog.common.SexForFormula;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

/**
 * @param bmrMethod        사용자가 고른 계산 방식
 * @param bmrAppliedMethod 실제로 쓴 방식(필요한 측정값이 없으면 FORMULA). BMR을 못 구하면 null
 * @param bmrMeasuredOn    BODY_FAT·MEASURED로 계산했을 때 쓴 측정 날짜
 * @param leanMassKg       최근 체지방률 측정으로 구한 제지방량(없으면 null)
 * @param proteinTargetG   제지방 1kg당 g × 제지방량(둘 중 하나라도 없으면 null)
 */
public record ProfileResponse(
        Long id,
        int age,
        SexForFormula sexForFormula,
        BigDecimal heightCm,
        BigDecimal weightKg,
        BigDecimal activityFactor,
        Goal goal,
        Integer dailyTargetKcal,
        BmrMethod bmrMethod,
        BmrMethod bmrAppliedMethod,
        LocalDate bmrMeasuredOn,
        BigDecimal bmrKcal,
        BigDecimal tdeeKcal,
        BigDecimal leanMassKg,
        LocalDate leanMassMeasuredOn,
        BigDecimal proteinGPerKgLean,
        BigDecimal proteinTargetG,
        Instant updatedAt
) {

    /**
     * @param latestBodyFat 체지방률이 있는 최근 측정(없으면 null)
     * @param latestBmr     측정 기초대사량이 있는 최근 측정(없으면 null)
     */
    public static ProfileResponse from(Profile p, BodyComposition latestBodyFat, BodyComposition latestBmr) {
        BigDecimal lean = latestBodyFat == null ? null
                : Calculator.leanMass(latestBodyFat.getWeightKg(), latestBodyFat.getBodyFatPct());

        BmrMethod applied = BmrMethod.FORMULA;
        LocalDate basis = null;
        BigDecimal bmr = null;
        if (p.getBmrMethod() == BmrMethod.MEASURED && latestBmr != null) {
            applied = BmrMethod.MEASURED;
            basis = latestBmr.getMeasuredOn();
            bmr = BigDecimal.valueOf(latestBmr.getMeasuredBmrKcal());
        } else if (p.getBmrMethod() == BmrMethod.BODY_FAT && lean != null) {
            applied = BmrMethod.BODY_FAT;
            basis = latestBodyFat.getMeasuredOn();
            bmr = Calculator.bmrFromLeanMass(lean);
        } else {
            bmr = Calculator.bmr(p.getWeightKg(), p.getHeightCm(), p.getAge(), p.getSexForFormula());
        }

        return new ProfileResponse(p.getId(), p.getAge(), p.getSexForFormula(), p.getHeightCm(), p.getWeightKg(),
                p.getActivityFactor(), p.getGoal(), p.getDailyTargetKcal(), p.getBmrMethod(),
                bmr == null ? null : applied, basis, bmr, Calculator.tdee(bmr, p.getActivityFactor()),
                lean, latestBodyFat == null ? null : latestBodyFat.getMeasuredOn(),
                p.getProteinGPerKgLean(), Calculator.proteinTarget(p.getProteinGPerKgLean(), lean),
                p.getUpdatedAt());
    }
}
