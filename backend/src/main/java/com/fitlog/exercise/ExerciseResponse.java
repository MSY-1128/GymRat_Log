package com.fitlog.exercise;

import com.fitlog.common.Source;
import java.math.BigDecimal;

/** @param kcalPerKgKm 거리로 기록할 수 있는 운동만 값이 있다(kcal = 계수 × 체중kg × km) */
public record ExerciseResponse(Long id, String name, BigDecimal met, Source source, ExerciseKind kind,
                               BodyPart bodyPart, BigDecimal kcalPerKgKm) {

    public static ExerciseResponse from(Exercise e) {
        return new ExerciseResponse(e.getId(), e.getName(), e.getMet(), e.getSource(), e.getKind(), e.getBodyPart(),
                e.getKcalPerKgKm());
    }
}
