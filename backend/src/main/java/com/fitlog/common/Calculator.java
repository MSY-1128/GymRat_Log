package com.fitlog.common;

import java.math.BigDecimal;

/**
 * 서버 계산 기준. 모든 계산은 BigDecimal로 수행하며 반올림하지 않는다.
 * (÷100, ÷200은 십진수로 정확히 나누어 떨어지므로 정밀도 손실이 없다.)
 * 화면에서 kcal은 정수, 영양소는 소수 1자리로 반올림해 표시한다.
 */
public final class Calculator {

    public static final BigDecimal MALE_CONSTANT = BigDecimal.valueOf(5);
    public static final BigDecimal FEMALE_CONSTANT = BigDecimal.valueOf(-161);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal TWO_HUNDRED = BigDecimal.valueOf(200);
    private static final BigDecimal OXYGEN_ML = new BigDecimal("3.5");

    private Calculator() {
    }

    /** Mifflin-St Jeor: 10×kg + 6.25×cm − 5×나이 + 상수(MALE=5, FEMALE=−161). 성별 미선택 시 null. */
    public static BigDecimal bmr(BigDecimal weightKg, BigDecimal heightCm, int age, SexForFormula sex) {
        if (sex == null || weightKg == null || heightCm == null) {
            return null;
        }
        BigDecimal constant = sex == SexForFormula.MALE ? MALE_CONSTANT : FEMALE_CONSTANT;
        return BigDecimal.TEN.multiply(weightKg)
                .add(new BigDecimal("6.25").multiply(heightCm))
                .subtract(BigDecimal.valueOf(5L * age))
                .add(constant);
    }

    /** TDEE = BMR × 활동계수. BMR이 null이면 null. */
    public static BigDecimal tdee(BigDecimal bmr, BigDecimal activityFactor) {
        if (bmr == null || activityFactor == null) {
            return null;
        }
        return bmr.multiply(activityFactor);
    }

    /** 100g 기준 값 × 섭취g / 100. */
    public static BigDecimal perGrams(BigDecimal per100g, BigDecimal grams) {
        return per100g.multiply(grams).divide(HUNDRED);
    }

    /** 운동 kcal = MET × 3.5 × 체중kg / 200 × 분. 휴식 대사를 포함한 총 소모 추정치. */
    public static BigDecimal exerciseKcal(BigDecimal met, BigDecimal weightKg, int minutes) {
        return met.multiply(OXYGEN_ML).multiply(weightKg).divide(TWO_HUNDRED)
                .multiply(BigDecimal.valueOf(minutes));
    }

    /** 남은 칼로리 = 목표 − 섭취. 목표가 없으면 null. 음수도 그대로 반환. */
    public static BigDecimal remaining(Integer targetKcal, BigDecimal consumedKcal) {
        if (targetKcal == null) {
            return null;
        }
        return BigDecimal.valueOf(targetKcal).subtract(consumedKcal);
    }
}
