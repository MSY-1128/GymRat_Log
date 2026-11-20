package com.fitlog.workout;

import java.math.BigDecimal;
import java.time.LocalDate;

public record WorkoutResponse(
        Long id,
        LocalDate date,
        Long exerciseId,
        int minutes,
        String nameSnapshot,
        BigDecimal weightKgSnapshot,
        BigDecimal metSnapshot,
        BigDecimal calculatedKcal
) {

    public static WorkoutResponse from(ExerciseEntry e) {
        return new WorkoutResponse(e.getId(), e.getDate(), e.getExerciseId(), e.getMinutes(), e.getNameSnapshot(),
                e.getWeightKgSnapshot(), e.getMetSnapshot(), e.calculatedKcal());
    }
}
