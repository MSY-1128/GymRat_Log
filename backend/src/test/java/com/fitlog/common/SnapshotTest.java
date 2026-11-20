package com.fitlog.common;

import static org.assertj.core.api.Assertions.assertThat;

import com.fitlog.exercise.Exercise;
import com.fitlog.food.Food;
import com.fitlog.meal.MealEntry;
import com.fitlog.meal.MealType;
import com.fitlog.workout.ExerciseEntry;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** 과거 기록 snapshot 유지 규칙 단위 검증. */
class SnapshotTest {

    private static final LocalDate DAY = LocalDate.of(2026, 3, 1);

    private static Food food(long id, String name, String kcal) {
        Food f = new Food(name, new BigDecimal(kcal), new BigDecimal("10"), new BigDecimal("5"),
                new BigDecimal("1"), null, Source.USER, null);
        ReflectionTestUtils.setField(f, "id", id);
        return f;
    }

    private static Exercise exercise(long id, String name, String met) {
        Exercise e = new Exercise(name, new BigDecimal(met), Source.USER, null);
        ReflectionTestUtils.setField(e, "id", id);
        return e;
    }

    @Test
    void mealKeepsSnapshotWhenSameFoodChangesLater() {
        Food rice = food(1, "현미밥", "150");
        MealEntry entry = new MealEntry(DAY, MealType.LUNCH, rice, new BigDecimal("200"));
        assertThat(entry.calculatedKcal()).isEqualByComparingTo("300");

        // 음식 정보가 바뀐 상황(같은 ID, 다른 값)에서 그램만 수정
        Food changedRice = food(1, "현미밥(변경)", "999");
        entry.update(DAY, MealType.DINNER, changedRice, new BigDecimal("100"));

        assertThat(entry.getFoodNameSnapshot()).isEqualTo("현미밥");
        assertThat(entry.getKcalPer100Snapshot()).isEqualByComparingTo("150");
        assertThat(entry.calculatedKcal()).isEqualByComparingTo("150");
        assertThat(entry.getMealType()).isEqualTo(MealType.DINNER);
    }

    @Test
    void mealTakesNewSnapshotWhenFoodChanges() {
        MealEntry entry = new MealEntry(DAY, MealType.LUNCH, food(1, "현미밥", "150"), new BigDecimal("100"));
        entry.update(DAY, MealType.LUNCH, food(2, "바나나", "89"), new BigDecimal("100"));
        assertThat(entry.getFoodNameSnapshot()).isEqualTo("바나나");
        assertThat(entry.calculatedKcal()).isEqualByComparingTo("89");
        assertThat(entry.calculatedCarbsG()).isEqualByComparingTo("10");
    }

    @Test
    void workoutKeepsWeightAndMetWhenOnlyMinutesChange() {
        ExerciseEntry entry = new ExerciseEntry(DAY, exercise(1, "달리기", "8"), 30, new BigDecimal("70"));
        assertThat(entry.calculatedKcal()).isEqualByComparingTo("294");

        entry.update(DAY, exercise(1, "달리기", "12"), 60);

        assertThat(entry.getWeightKgSnapshot()).isEqualByComparingTo("70");
        assertThat(entry.getMetSnapshot()).isEqualByComparingTo("8");
        assertThat(entry.calculatedKcal()).isEqualByComparingTo("588");
    }

    @Test
    void workoutAppliesNewMetOnlyWhenExerciseChangesAndKeepsWeight() {
        ExerciseEntry entry = new ExerciseEntry(DAY, exercise(1, "달리기", "8"), 30, new BigDecimal("70"));
        entry.update(DAY, exercise(3, "자전거", "6"), 30);
        assertThat(entry.getNameSnapshot()).isEqualTo("자전거");
        assertThat(entry.getMetSnapshot()).isEqualByComparingTo("6");
        assertThat(entry.getWeightKgSnapshot()).isEqualByComparingTo("70");
        // 6 × 3.5 × 70 / 200 × 30 = 220.5
        assertThat(entry.calculatedKcal()).isEqualByComparingTo("220.5");
    }
}
