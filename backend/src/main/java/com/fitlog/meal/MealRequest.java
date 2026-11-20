package com.fitlog.meal;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record MealRequest(
        @NotNull(message = "필수 값입니다.")
        LocalDate date,

        @NotNull(message = "필수 값입니다.")
        MealType mealType,

        @NotNull(message = "음식을 선택해 주세요.")
        @Positive(message = "올바른 음식이 아닙니다.")
        Long foodId,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "0", inclusive = false, message = "0보다 커야 합니다.")
        @DecimalMax(value = "5000", message = "5000 이하여야 합니다.")
        @Digits(integer = 4, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal grams
) {
}
