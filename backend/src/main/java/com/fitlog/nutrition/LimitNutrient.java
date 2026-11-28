package com.fitlog.nutrition;

import com.fitlog.food.LimitNutrients;
import com.fitlog.summary.DailySummary;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 줄여야 할 영양소와 하루 상한.
 *
 * <p>세 기준 모두 국내 식품 라벨의 1일 영양성분 기준치(2,000kcal 기준 나트륨 2,000mg·당류 100g·포화지방 15g)와 같은 값이 나오도록
 * 잡았다. 당류·포화지방은 기준 열량에 비례한다.
 */
public enum LimitNutrient {

    /** WHO(2012) 나트륨 2g/일 미만. 식품 라벨 1일 기준치와 같다. */
    SODIUM("나트륨", "mg", "WHO 권고 2,000mg 미만(식품 라벨 1일 기준치와 같음)"),
    /**
     * 2020 한국인 영양소 섭취기준: 총당류 섭취를 총에너지의 10~20%로 제한. 식약처 DB 값은 첨가당이 아닌 총당류(과일·우유의 당 포함)라
     * WHO 첨가당(유리당) 10% 기준 대신 총당류 상한 20%를 쓴다.
     */
    SUGARS("당류", "g", "2020 한국인 영양소 섭취기준: 총당류는 열량의 20% 이내"),
    /** 2020 한국인 영양소 섭취기준: 19세 이상 포화지방 에너지 7% 미만(WHO 2023은 10% 미만). */
    SATURATED_FAT("포화지방", "g", "2020 한국인 영양소 섭취기준: 열량의 7% 미만");

    static final BigDecimal SODIUM_LIMIT_MG = BigDecimal.valueOf(2000);
    static final BigDecimal SUGARS_ENERGY_SHARE = new BigDecimal("0.20");
    static final BigDecimal SATURATED_ENERGY_SHARE = new BigDecimal("0.07");

    private final String label;
    private final String unit;
    private final String basis;

    LimitNutrient(String label, String unit, String basis) {
        this.label = label;
        this.unit = unit;
        this.basis = basis;
    }

    public String label() {
        return label;
    }

    public String unit() {
        return unit;
    }

    public String basis() {
        return basis;
    }

    /** 하루 상한. 당류 g = 열량×20%÷4kcal, 포화지방 g = 열량×7%÷9kcal. 소수 첫째 자리 반올림. */
    public BigDecimal limit(BigDecimal referenceKcal) {
        return switch (this) {
            case SODIUM -> SODIUM_LIMIT_MG;
            case SUGARS -> referenceKcal.multiply(SUGARS_ENERGY_SHARE).divide(BigDecimal.valueOf(4), 1, RoundingMode.HALF_UP);
            case SATURATED_FAT -> referenceKcal.multiply(SATURATED_ENERGY_SHARE)
                    .divide(BigDecimal.valueOf(9), 1, RoundingMode.HALF_UP);
        };
    }

    public BigDecimal of(LimitNutrients n) {
        return switch (this) {
            case SODIUM -> n.sodiumMg();
            case SUGARS -> n.sugarsG();
            case SATURATED_FAT -> n.saturatedFatG();
        };
    }

    public BigDecimal of(DailySummary s) {
        return switch (this) {
            case SODIUM -> s.sodiumMg();
            case SUGARS -> s.sugarsG();
            case SATURATED_FAT -> s.saturatedFatG();
        };
    }

    public int missing(DailySummary s) {
        return switch (this) {
            case SODIUM -> s.sodiumMissing();
            case SUGARS -> s.sugarsMissing();
            case SATURATED_FAT -> s.saturatedFatMissing();
        };
    }
}
