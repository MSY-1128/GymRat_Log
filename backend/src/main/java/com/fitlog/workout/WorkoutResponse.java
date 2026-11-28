package com.fitlog.workout;

import com.fitlog.exercise.BodyPart;
import com.fitlog.exercise.EnergySystem;
import com.fitlog.exercise.Intensity;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * @param durationMinutes 운동 시간(헬스는 세트 × 2.5분 추정, 거리 기록에 시간이 없으면 0)
 * @param volumeKg        헬스 볼륨(세트 × 횟수 × 무게). 헬스가 아니면 null
 * @param bodyPart        헬스 종목의 부위. 헬스가 아니면 null
 * @param intensityBasis  시간 운동의 강도 기준(LEVEL·DISTANCE·SPEED). 이전 시간 기록은 null(보통)
 * @param metSnapshot     이 기록에 적용한 MET(시간 운동은 강도·속도에 따른 값)
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
        IntensityBasis intensityBasis,
        Intensity intensity,
        BigDecimal speedKmh,
        EnergySystem energySystem,
        BigDecimal calculatedKcal
) {

    public static WorkoutResponse from(ExerciseEntry e) {
        return new WorkoutResponse(e.getId(), e.getDate(), e.getExerciseId(), e.getMode(), e.getMinutes(),
                e.getDistanceKm(), e.getSets(), e.getReps(), e.getLiftedKg(), e.volumeKg(), e.durationMinutes(),
                e.getBodyPart(), e.getNameSnapshot(), e.getWeightKgSnapshot(), e.getMetSnapshot(),
                e.getKcalPerKgKmSnapshot(), e.getIntensityBasis(), e.getIntensity(), e.getSpeedKmh(),
                e.getEnergySystem(), e.calculatedKcal());
    }
}
