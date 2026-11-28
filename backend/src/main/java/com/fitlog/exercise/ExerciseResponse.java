package com.fitlog.exercise;

import com.fitlog.common.Source;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.List;

/**
 * @param met              보통 강도 MET(헬스는 종목 MET)
 * @param metLight         시간 운동의 가볍게 MET(헬스는 null)
 * @param metVigorous      시간 운동의 힘들게 MET(헬스는 null)
 * @param speedMetCurve    속도별 MET 점. 거리·속도로 강도를 정할 수 있는 운동만 값이 있다(그 밖은 빈 목록)
 * @param equipment        헬스 종목만 값이 있다
 * @param primaryMuscles   헬스 종목의 주 근육(그 밖의 운동은 빈 목록)
 * @param secondaryMuscles 헬스 종목의 보조 근육
 * @param motion           동작 애니메이션 키(패턴[:변형]). 없으면 null
 */
public record ExerciseResponse(Long id, String name, BigDecimal met, Source source, ExerciseKind kind,
                               EnergySystem energySystem, BodyPart bodyPart, BigDecimal metLight,
                               BigDecimal metVigorous, List<SpeedPoint> speedMetCurve, Equipment equipment,
                               List<Muscle> primaryMuscles, List<Muscle> secondaryMuscles, String motion) {

    public record SpeedPoint(BigDecimal speedKmh, BigDecimal met) {
    }

    public static ExerciseResponse from(Exercise e) {
        boolean time = e.getKind() == ExerciseKind.TIME;
        return new ExerciseResponse(e.getId(), e.getName(), e.getMet(), e.getSource(), e.getKind(),
                e.getEnergySystem(), e.getBodyPart(), time ? e.metFor(Intensity.LIGHT) : null,
                time ? e.metFor(Intensity.VIGOROUS) : null, curve(e.getSpeedMetCurve()), e.getEquipment(),
                e.getPrimaryMuscles(), e.getSecondaryMuscles(), e.getMotion());
    }

    private static List<SpeedPoint> curve(String s) {
        if (s == null || s.isBlank()) {
            return List.of();
        }
        return Arrays.stream(s.split(",")).map(p -> p.trim().split(":"))
                .map(p -> new SpeedPoint(new BigDecimal(p[0]), new BigDecimal(p[1]))).toList();
    }
}
