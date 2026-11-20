package com.fitlog.workout;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.LocalDate;

public record WorkoutRequest(
        @NotNull(message = "필수 값입니다.")
        LocalDate date,

        @NotNull(message = "운동을 선택해 주세요.")
        @Positive(message = "올바른 운동이 아닙니다.")
        Long exerciseId,

        @NotNull(message = "필수 값입니다.")
        @Min(value = 1, message = "1분 이상이어야 합니다.")
        @Max(value = 1440, message = "1440분 이하여야 합니다.")
        Integer minutes
) {
}
