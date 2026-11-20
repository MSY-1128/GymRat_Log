package com.fitlog.common;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import org.junit.jupiter.api.Test;

class CalculatorTest {

    private static BigDecimal bd(String v) {
        return new BigDecimal(v);
    }

    @Test
    void bmrMaleUsesPlusFive() {
        // 10×70 + 6.25×175 − 5×30 + 5 = 700 + 1093.75 − 150 + 5 = 1648.75
        assertThat(Calculator.bmr(bd("70"), bd("175"), 30, SexForFormula.MALE)).isEqualByComparingTo("1648.75");
    }

    @Test
    void bmrFemaleUsesMinus161() {
        // 10×60 + 6.25×165 − 5×25 − 161 = 600 + 1031.25 − 125 − 161 = 1345.25
        assertThat(Calculator.bmr(bd("60"), bd("165"), 25, SexForFormula.FEMALE)).isEqualByComparingTo("1345.25");
    }

    @Test
    void bmrAndTdeeAreNullWhenSexNotSelected() {
        BigDecimal bmr = Calculator.bmr(bd("70"), bd("175"), 30, null);
        assertThat(bmr).isNull();
        assertThat(Calculator.tdee(bmr, bd("1.55"))).isNull();
    }

    @Test
    void tdeeMultipliesActivityFactor() {
        assertThat(Calculator.tdee(bd("1648.75"), bd("1.2"))).isEqualByComparingTo("1978.5");
        assertThat(Calculator.tdee(bd("1648.75"), bd("1.375"))).isEqualByComparingTo("2267.03125");
    }

    @Test
    void foodValueIsPer100gTimesGramsOver100() {
        assertThat(Calculator.perGrams(bd("165"), bd("150"))).isEqualByComparingTo("247.5");
        assertThat(Calculator.perGrams(bd("3.6"), bd("33.3"))).isEqualByComparingTo("1.1988");
    }

    @Test
    void exerciseKcalUsesMetFormulaWithoutRounding() {
        // 8 × 3.5 × 70 / 200 × 30 = 294
        assertThat(Calculator.exerciseKcal(bd("8"), bd("70"), 30)).isEqualByComparingTo("294");
        // 3.5 × 3.5 × 65.5 / 200 × 45 = 180.534375
        assertThat(Calculator.exerciseKcal(bd("3.5"), bd("65.5"), 45)).isEqualByComparingTo("180.534375");
    }

    @Test
    void remainingCanBeNegativeAndNullWithoutTarget() {
        assertThat(Calculator.remaining(2000, bd("2350.5"))).isEqualByComparingTo("-350.5");
        assertThat(Calculator.remaining(null, bd("100"))).isNull();
    }
}
