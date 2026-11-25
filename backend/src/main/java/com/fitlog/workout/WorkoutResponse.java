package com.fitlog.workout;

import com.fitlog.exercise.BodyPart;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * @param durationMinutes 운동 시간(헬스는 세트 × 2.5분 추정, 거리 기록에 시간이 없으면 0)
 * @param volumeKg        헬스 볼륨(세트 × 횟수 × 무게). 헬스가 아니면 null
 * @param bodyPart        헬스 종목의 부위. 헬스가 아니면 null
 */
public record WorkoutResponse(
        Long id,
        LocalDate date,
        Long exerciseId,
        WorkoutMode mode,
        Integer minutes,
        BigDecimal distanceKm,
        Integer sets,
        Integer reps,
        BigDecimal liftedKg,
        BigDecimal volumeKg,
        BigDecimal durationMinutes,
        BodyPart bodyPart,
        String nameSnapshot,
        BigDecimal weightKgSnapshot,
        BigDecimal metSnapshot,
        BigDecimal kcalPerKgKmSnapshot,
        BigDecimal calculatedKcal
) {

    public static WorkoutResponse from(ExerciseEntry e) {
        return new WorkoutResponse(e.getId(), e.getDate(), e.getExerciseId(), e.getMode(), e.getMinutes(),
                e.getDistanceKm(), e.getSets(), e.getReps(), e.getLiftedKg(), e.volumeKg(), e.durationMinutes(),
                e.getBodyPart(), e.getNameSnapshot(), e.getWeightKgSnapshot(), e.getMetSnapshot(),
                e.getKcalPerKgKmSnapshot(), e.calculatedKcal());
    }
}
