package com.fitlog.profile;

import jakarta.validation.Constraint;
import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import jakarta.validation.Payload;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.math.BigDecimal;
import java.util.List;

/** 활동계수는 1.2 / 1.375 / 1.55 / 1.725 / 1.9 중 하나여야 한다. */
@Target({ElementType.FIELD, ElementType.RECORD_COMPONENT, ElementType.PARAMETER})
@Retention(RetentionPolicy.RUNTIME)
@Constraint(validatedBy = AllowedActivityFactor.Validator.class)
public @interface AllowedActivityFactor {

    List<BigDecimal> VALUES = List.of(
            new BigDecimal("1.2"), new BigDecimal("1.375"), new BigDecimal("1.55"),
            new BigDecimal("1.725"), new BigDecimal("1.9"));

    String message() default "1.2, 1.375, 1.55, 1.725, 1.9 중 하나를 선택해 주세요.";

    Class<?>[] groups() default {};

    Class<? extends Payload>[] payload() default {};

    class Validator implements ConstraintValidator<AllowedActivityFactor, BigDecimal> {
        @Override
        public boolean isValid(BigDecimal value, ConstraintValidatorContext context) {
            return value == null || VALUES.stream().anyMatch(v -> v.compareTo(value) == 0);
        }
    }
}
