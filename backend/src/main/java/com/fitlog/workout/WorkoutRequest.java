package com.fitlog.workout;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 기록 방식(mode)에 따라 필요한 값이 다르다. 생략하면 TIME.
 * TIME: minutes / DISTANCE: distanceKm (+ minutes 선택) / SETS: sets, reps, liftedKg(맨몸은 0).
 * 방식별 필수 여부와 운동 종류와의 조합은 서비스에서 검증한다.
 */
public record WorkoutRequest(
        @NotNull(message = "필수 값입니다.")
        LocalDate date,

        @NotNull(message = "운동을 선택해 주세요.")
        @Positive(message = "올바른 운동이 아닙니다.")
        Long exerciseId,

        @Min(value = 1, message = "1분 이상이어야 합니다.")
        @Max(value = 1440, message = "1440분 이하여야 합니다.")
        Integer minutes,

        WorkoutMode mode,

        @DecimalMin(value = "0.01", message = "0.01km 이상이어야 합니다.")
        @DecimalMax(value = "300", message = "300km 이하여야 합니다.")
        @Digits(integer = 3, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal distanceKm,

        @Min(value = 1, message = "1세트 이상이어야 합니다.")
        @Max(value = 50, message = "50세트 이하여야 합니다.")
        Integer sets,

        @Min(value = 1, message = "1회 이상이어야 합니다.")
        @Max(value = 100, message = "100회 이하여야 합니다.")
        Integer reps,

        @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
        @DecimalMax(value = "500", message = "500kg 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal liftedKg
) {

    /** 시간 기록(이전 형식). */
    public WorkoutRequest(LocalDate date, Long exerciseId, Integer minutes) {
        this(date, exerciseId, minutes, null, null, null, null, null);
    }
}
