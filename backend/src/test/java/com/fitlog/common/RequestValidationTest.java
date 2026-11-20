package com.fitlog.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.fitlog.food.FoodRequest;
import com.fitlog.meal.MealRequest;
import com.fitlog.meal.MealType;
import com.fitlog.profile.Goal;
import com.fitlog.profile.ProfileRequest;
import com.fitlog.workout.WorkoutRequest;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class RequestValidationTest {

    private static jakarta.validation.ValidatorFactory factory;
    private static Validator validator;

    @BeforeAll
    static void setUp() {
        factory = Validation.buildDefaultValidatorFactory();
        validator = factory.getValidator();
    }

    @AfterAll
    static void tearDown() {
        factory.close();
    }

    private static Set<String> invalidFields(Object o) {
        Set<? extends ConstraintViolation<?>> v = validator.validate(o);
        return v.stream().map(c -> c.getPropertyPath().toString()).collect(Collectors.toSet());
    }

    private static ProfileRequest profile(int age, String height, String weight, String factor) {
        return new ProfileRequest(age, SexForFormula.MALE, new BigDecimal(height), new BigDecimal(weight),
                new BigDecimal(factor), Goal.MAINTAIN, null);
    }

    @Test
    void validProfilePasses() {
        assertThat(invalidFields(profile(19, "100", "30", "1.2"))).isEmpty();
        assertThat(invalidFields(profile(100, "250", "350", "1.9"))).isEmpty();
        // 성별/목표 칼로리 미입력 허용
        assertThat(invalidFields(new ProfileRequest(30, null, new BigDecimal("175"), new BigDecimal("70"),
                new BigDecimal("1.55"), Goal.LOSE, null))).isEmpty();
    }

    @Test
    void profileRangesAreEnforced() {
        assertThat(invalidFields(profile(18, "175", "70", "1.2"))).containsExactly("age");
        assertThat(invalidFields(profile(101, "175", "70", "1.2"))).containsExactly("age");
        assertThat(invalidFields(profile(30, "99.9", "70", "1.2"))).containsExactly("heightCm");
        assertThat(invalidFields(profile(30, "250.1", "70", "1.2"))).containsExactly("heightCm");
        assertThat(invalidFields(profile(30, "175", "29.9", "1.2"))).containsExactly("weightKg");
        assertThat(invalidFields(profile(30, "175", "350.1", "1.2"))).containsExactly("weightKg");
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.0", "1.3", "1.5", "2.0", "1.38"})
    void activityFactorMustBeOneOfAllowedValues(String factor) {
        assertThat(invalidFields(profile(30, "175", "70", factor))).containsExactly("activityFactor");
    }

    @ParameterizedTest
    @ValueSource(strings = {"1.2", "1.375", "1.55", "1.725", "1.9", "1.20", "1.3750"})
    void allowedActivityFactorsPass(String factor) {
        assertThat(invalidFields(profile(30, "175", "70", factor))).isEmpty();
    }

    @Test
    void dailyTargetMustBePositiveWhenPresent() {
        ProfileRequest r = new ProfileRequest(30, null, new BigDecimal("175"), new BigDecimal("70"),
                new BigDecimal("1.2"), Goal.GAIN, 0);
        assertThat(invalidFields(r)).containsExactly("dailyTargetKcal");
    }

    @Test
    void mealGramsMustBeGreaterThanZeroAndAtMost5000() {
        LocalDate d = LocalDate.of(2026, 1, 1);
        assertThat(invalidFields(new MealRequest(d, MealType.LUNCH, 1L, new BigDecimal("0")))).containsExactly("grams");
        assertThat(invalidFields(new MealRequest(d, MealType.LUNCH, 1L, new BigDecimal("5000.1"))))
                .containsExactly("grams");
        assertThat(invalidFields(new MealRequest(d, MealType.LUNCH, 1L, new BigDecimal("0.1")))).isEmpty();
        assertThat(invalidFields(new MealRequest(d, MealType.LUNCH, 1L, new BigDecimal("5000")))).isEmpty();
        assertThat(invalidFields(new MealRequest(null, null, null, null)))
                .containsExactlyInAnyOrder("date", "mealType", "foodId", "grams");
    }

    @Test
    void workoutMinutesMustBeBetween1And1440() {
        LocalDate d = LocalDate.of(2026, 1, 1);
        assertThat(invalidFields(new WorkoutRequest(d, 1L, 0))).containsExactly("minutes");
        assertThat(invalidFields(new WorkoutRequest(d, 1L, 1441))).containsExactly("minutes");
        assertThat(invalidFields(new WorkoutRequest(d, 1L, 1))).isEmpty();
        assertThat(invalidFields(new WorkoutRequest(d, 1L, 1440))).isEmpty();
    }

    @Test
    void foodNutritionMustBeNonNegative() {
        FoodRequest negative = new FoodRequest("두부", new BigDecimal("-1"), BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, null);
        assertThat(invalidFields(negative)).containsExactly("kcal");
        FoodRequest blank = new FoodRequest(" ", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, BigDecimal.ZERO);
        assertThat(invalidFields(blank)).containsExactlyInAnyOrder("name", "servingGrams");
        FoodRequest zeroOk = new FoodRequest("물", BigDecimal.ZERO, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, new BigDecimal("200"));
        assertThat(invalidFields(zeroOk)).isEmpty();
    }
}
