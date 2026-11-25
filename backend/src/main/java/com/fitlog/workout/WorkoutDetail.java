package com.fitlog.workout;

import java.math.BigDecimal;

/** 검증을 마친 기록 방식별 값. 방식에 쓰지 않는 값은 null. */
public record WorkoutDetail(WorkoutMode mode, Integer minutes, BigDecimal distanceKm, Integer sets, Integer reps,
                            BigDecimal liftedKg) {

    public static WorkoutDetail time(int minutes) {
        return new WorkoutDetail(WorkoutMode.TIME, minutes, null, null, null, null);
    }

    public static WorkoutDetail distance(BigDecimal km, Integer minutes) {
        return new WorkoutDetail(WorkoutMode.DISTANCE, minutes, km, null, null, null);
    }

    public static WorkoutDetail sets(int sets, int reps, BigDecimal liftedKg) {
        return new WorkoutDetail(WorkoutMode.SETS, null, null, sets, reps, liftedKg);
    }
}
