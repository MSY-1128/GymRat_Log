package com.fitlog.exercise;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

/** 근육 목록 ↔ 쉼표 구분 문자열("CHEST,TRICEPS"). 빈 목록은 NULL로 저장한다. */
@Converter
public class MuscleListConverter implements AttributeConverter<List<Muscle>, String> {

    @Override
    public String convertToDatabaseColumn(List<Muscle> muscles) {
        if (muscles == null || muscles.isEmpty()) {
            return null;
        }
        return muscles.stream().map(Muscle::name).collect(Collectors.joining(","));
    }

    @Override
    public List<Muscle> convertToEntityAttribute(String value) {
        if (value == null || value.isBlank()) {
            return List.of();
        }
        return Arrays.stream(value.split(",")).map(String::trim).filter(s -> !s.isEmpty()).map(Muscle::valueOf)
                .toList();
    }
}
