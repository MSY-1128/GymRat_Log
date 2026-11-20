package com.fitlog.profile;

import com.fitlog.common.SexForFormula;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/** 입력 검증 범위이며 건강 권장 범위가 아니다. */
public record ProfileRequest(
        @NotNull(message = "필수 값입니다.")
        @Min(value = 19, message = "19 이상이어야 합니다.")
        @Max(value = 100, message = "100 이하여야 합니다.")
        Integer age,

        SexForFormula sexForFormula,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "100", message = "100 이상이어야 합니다.")
        @DecimalMax(value = "250", message = "250 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal heightCm,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "30", message = "30 이상이어야 합니다.")
        @DecimalMax(value = "350", message = "350 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal weightKg,

        @NotNull(message = "필수 값입니다.")
        @AllowedActivityFactor
        BigDecimal activityFactor,

        @NotNull(message = "필수 값입니다.")
        Goal goal,

        @Min(value = 1, message = "1 이상이어야 합니다.")
        @Max(value = 10000, message = "10000 이하여야 합니다.")
        Integer dailyTargetKcal
) {
}
