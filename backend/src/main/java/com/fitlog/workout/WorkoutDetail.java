package com.fitlog.workout;

import com.fitlog.exercise.Intensity;
import java.math.BigDecimal;

/**
 * 검증을 마친 기록 방식별 값. 방식에 쓰지 않는 값은 null.
 *
 * @param basis 시간 운동의 강도 기준(이전 형식의 시간 기록은 null)
 * @param met   이 기록에 적용할 MET. null이면 운동의 기본(보통) MET
 */
public record WorkoutDetail(WorkoutMode mode, Integer minutes, BigDecimal distanceKm, Integer sets, Integer reps,
                            BigDecimal liftedKg, IntensityBasis basis, Intensity intensity, BigDecimal speedKmh,
                            BigDecimal met) {

    /** 강도 기준 없는 시간 기록(seed·이전 형식). 기본 MET. */
    public static WorkoutDetail time(int minutes) {
        return new WorkoutDetail(WorkoutMode.TIME, minutes, null, null, null, null, null, null, null, null);
    }

    public static WorkoutDetail level(int minutes, Intensity intensity, BigDecimal met) {
        return new WorkoutDetail(WorkoutMode.TIME, minutes, null, null, null, null, IntensityBasis.LEVEL, intensity,
                null, met);
    }

    /** 거리 또는 속도로 강도를 정한 시간 기록. 거리·속도는 둘 다 채워 둔다. */
    public static WorkoutDetail paced(int minutes, IntensityBasis basis, BigDecimal km, BigDecimal speedKmh,
                                      BigDecimal met) {
        return new WorkoutDetail(WorkoutMode.TIME, minutes, km, null, null, null, basis, null, speedKmh, met);
    }

    public static WorkoutDetail sets(int sets, int reps, BigDecimal liftedKg) {
        return new WorkoutDetail(WorkoutMode.SETS, null, null, sets, reps, liftedKg, null, null, null, null);
    }

    /** 강도를 정하는 입력이 같은지(같으면 수정 시 MET snapshot을 유지한다). */
    boolean sameIntensityAs(IntensityBasis basis, Intensity intensity, BigDecimal speedKmh) {
        return this.basis == basis && this.intensity == intensity
                && (this.speedKmh == null ? speedKmh == null
                        : speedKmh != null && this.speedKmh.compareTo(speedKmh) == 0);
    }
}
