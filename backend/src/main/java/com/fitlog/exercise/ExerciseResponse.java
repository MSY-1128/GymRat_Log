package com.fitlog.exercise;

import com.fitlog.common.Source;
import java.math.BigDecimal;

public record ExerciseResponse(Long id, String name, BigDecimal met, Source source) {

    public static ExerciseResponse from(Exercise e) {
        return new ExerciseResponse(e.getId(), e.getName(), e.getMet(), e.getSource());
    }
}
