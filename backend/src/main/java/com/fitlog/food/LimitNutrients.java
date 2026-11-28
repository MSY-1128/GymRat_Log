package com.fitlog.food;

import java.math.BigDecimal;

/**
 * 줄여야 할 영양소(100g 기준). 값을 모르면 null이며 0과 구분한다.
 *
 * @param sugarsG       당류(g). 식약처 원본은 첨가당이 아닌 총당류다.
 * @param sodiumMg      나트륨(mg)
 * @param saturatedFatG 포화지방(g)
 */
public record LimitNutrients(BigDecimal sugarsG, BigDecimal sodiumMg, BigDecimal saturatedFatG) {

    public static final LimitNutrients UNKNOWN = new LimitNutrients(null, null, null);

    /** 비어 있는 값만 other로 채운다. */
    public LimitNutrients orElse(LimitNutrients other) {
        return new LimitNutrients(sugarsG != null ? sugarsG : other.sugarsG,
                sodiumMg != null ? sodiumMg : other.sodiumMg,
                saturatedFatG != null ? saturatedFatG : other.saturatedFatG);
    }

    public boolean complete() {
        return sugarsG != null && sodiumMg != null && saturatedFatG != null;
    }
}
