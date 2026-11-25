package com.fitlog.body;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/** 체중만 필수. 나머지는 측정기에 따라 없을 수 있다. 범위는 입력 검증용이며 건강 기준이 아니다. */
public record BodyCompositionRequest(
        @NotNull(message = "필수 값입니다.")
        LocalDate measuredOn,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "30", message = "30 이상이어야 합니다.")
        @DecimalMax(value = "350", message = "350 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal weightKg,

        @DecimalMin(value = "3", message = "3 이상이어야 합니다.")
        @DecimalMax(value = "70", message = "70 이하여야 합니다.")
        @Digits(integer = 2, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal bodyFatPct,

        @DecimalMin(value = "5", message = "5 이상이어야 합니다.")
        @DecimalMax(value = "100", message = "100 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal skeletalMuscleKg,

        @Min(value = 500, message = "500 이상이어야 합니다.")
        @Max(value = 5000, message = "5000 이하여야 합니다.")
        Integer measuredBmrKcal,

        @Min(value = 1, message = "1 이상이어야 합니다.")
        @Max(value = 30, message = "30 이하여야 합니다.")
        Integer visceralFatLevel
) {
}
