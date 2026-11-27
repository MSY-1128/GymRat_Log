package com.fitlog.exercise;

import com.fitlog.common.Source;
import java.math.BigDecimal;
import java.util.List;

/**
 * @param kcalPerKgKm      거리로 기록할 수 있는 운동만 값이 있다(kcal = 계수 × 체중kg × km)
 * @param equipment        헬스 종목만 값이 있다
 * @param primaryMuscles   헬스 종목의 주 근육(그 밖의 운동은 빈 목록)
 * @param secondaryMuscles 헬스 종목의 보조 근육
 */
public record ExerciseResponse(Long id, String name, BigDecimal met, Source source, ExerciseKind kind,
                               BodyPart bodyPart, BigDecimal kcalPerKgKm, Equipment equipment,
                               List<Muscle> primaryMuscles, List<Muscle> secondaryMuscles) {

    public static ExerciseResponse from(Exercise e) {
        return new ExerciseResponse(e.getId(), e.getName(), e.getMet(), e.getSource(), e.getKind(), e.getBodyPart(),
                e.getKcalPerKgKm(), e.getEquipment(), e.getPrimaryMuscles(), e.getSecondaryMuscles());
    }
}
