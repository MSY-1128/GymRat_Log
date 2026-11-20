package com.fitlog.food;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

/** 사용자 음식 등록. 영양값은 100g 기준. */
public record FoodRequest(
        @NotBlank(message = "이름을 입력해 주세요.")
        @Size(max = 100, message = "100자 이하로 입력해 주세요.")
        String name,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
        @DecimalMax(value = "900", message = "100g 기준 900 이하여야 합니다.")
        @Digits(integer = 5, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal kcal,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
        @DecimalMax(value = "100", message = "100g 기준 100 이하여야 합니다.")
        @Digits(integer = 5, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal carbsG,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
        @DecimalMax(value = "100", message = "100g 기준 100 이하여야 합니다.")
        @Digits(integer = 5, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal proteinG,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
        @DecimalMax(value = "100", message = "100g 기준 100 이하여야 합니다.")
        @Digits(integer = 5, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal fatG,

        @DecimalMin(value = "0", inclusive = false, message = "0보다 커야 합니다.")
        @DecimalMax(value = "5000", message = "5000 이하여야 합니다.")
        @Digits(integer = 4, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal servingGrams
) {
}
