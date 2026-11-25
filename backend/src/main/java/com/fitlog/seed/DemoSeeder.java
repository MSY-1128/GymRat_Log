package com.fitlog.seed;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fitlog.common.Source;
import com.fitlog.exercise.Exercise;
import com.fitlog.exercise.ExerciseRepository;
import com.fitlog.food.Food;
import com.fitlog.food.FoodRepository;
import com.fitlog.meal.MealEntry;
import com.fitlog.meal.MealEntryRepository;
import com.fitlog.meal.MealType;
import com.fitlog.workout.ExerciseEntry;
import com.fitlog.workout.ExerciseEntryRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

/**
 * demo 프로필에서만 동작. data.json을 "빈 DB"에 한 번만 seed 한다.
 * <ul>
 *   <li>seed_history에 기록이 있으면 다시 넣지 않는다(삭제한 seed를 재시작 시 복원하지 않음).</li>
 *   <li>ID는 DB가 생성하고, 샘플 ID는 sample_id 컬럼에 보관해 매핑한다.</li>
 *   <li>profileExample은 사용자 프로필로 저장하지 않는다.</li>
 * </ul>
 */
@Component
@Profile("demo")
public class DemoSeeder implements ApplicationRunner {

    static final String SEED_KEY = "data.json:v1";
    private static final Logger log = LoggerFactory.getLogger(DemoSeeder.class);

    private final Resource resource;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final FoodRepository foods;
    private final ExerciseRepository exercises;
    private final MealEntryRepository meals;
    private final ExerciseEntryRepository workouts;

    public DemoSeeder(@Value("${fitlog.seed.resource}") Resource resource, ObjectMapper objectMapper,
                      JdbcTemplate jdbc, TransactionTemplate tx, FoodRepository foods,
                      ExerciseRepository exercises, MealEntryRepository meals, ExerciseEntryRepository workouts) {
        this.resource = resource;
        this.objectMapper = objectMapper;
        this.jdbc = jdbc;
        this.tx = tx;
        this.foods = foods;
        this.exercises = exercises;
        this.meals = meals;
        this.workouts = workouts;
    }

    @Override
    public void run(ApplicationArguments args) throws IOException {
        SeedFile seed;
        try (InputStream in = resource.getInputStream()) {
            seed = objectMapper.readValue(in, SeedFile.class);
        }
        tx.executeWithoutResult(status -> apply(seed));
    }

    void apply(SeedFile seed) {
        // 동시에 두 인스턴스가 떠도 한 번만 적용되도록 PK 충돌로 선점한다.
        int claimed = jdbc.update(
                "INSERT INTO seed_history (seed_key, status, applied_at) VALUES (?, 'APPLYING', now()) "
                        + "ON CONFLICT (seed_key) DO NOTHING", SEED_KEY);
        if (claimed == 0) {
            log.info("Demo seed already handled; skipping.");
            return;
        }
        // 운동 종목은 마이그레이션이 카탈로그로 넣어 두므로 '비어 있음' 판단에서 뺀다
        if (foods.count() > 0 || meals.count() > 0 || workouts.count() > 0) {
            jdbc.update("UPDATE seed_history SET status = 'SKIPPED_NOT_EMPTY' WHERE seed_key = ?", SEED_KEY);
            log.info("Database is not empty; demo seed skipped.");
            return;
        }

        Map<Long, Food> foodBySample = new HashMap<>();
        for (SeedFood f : nullSafe(seed.foods())) {
            Food saved = foods.save(new Food(f.name(), f.per100(f.kcal()), f.per100(f.carbsG()),
                    f.per100(f.proteinG()), f.per100(f.fatG()), f.servingGrams(), Source.DEMO, f.id()));
            foodBySample.put(f.id(), saved);
        }
        Map<Long, Exercise> exerciseBySample = new HashMap<>();
        for (SeedExercise e : nullSafe(seed.exercises())) {
            // 같은 이름의 카탈로그 종목이 있으면 그것을 쓴다(중복 생성 안 함)
            Exercise saved = exercises.findFirstByNameOrderByIdAsc(e.name())
                    .orElseGet(() -> exercises.save(new Exercise(e.name(), e.met(), Source.DEMO, e.id())));
            exerciseBySample.put(e.id(), saved);
        }
        for (SeedMeal m : nullSafe(seed.mealEntries())) {
            Food food = foodBySample.get(m.foodId());
            if (food == null) {
                log.warn("Seed meal entry {} references unknown sample food {}; skipped.", m.id(), m.foodId());
                continue;
            }
            meals.save(new MealEntry(null, m.date(), m.mealType(), food, m.grams()));
        }
        for (SeedWorkout w : nullSafe(seed.exerciseEntries())) {
            Exercise exercise = exerciseBySample.get(w.exerciseId());
            if (exercise == null || w.weightKg() == null) {
                log.warn("Seed exercise entry {} is incomplete; skipped.", w.id());
                continue;
            }
            workouts.save(new ExerciseEntry(null, w.date(), exercise, w.minutes(), w.weightKg()));
        }
        jdbc.update("UPDATE seed_history SET status = 'APPLIED' WHERE seed_key = ?", SEED_KEY);
        log.info("Demo seed applied: {} foods, {} exercises.", foodBySample.size(), exerciseBySample.size());
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SeedFile(int schemaVersion, List<SeedFood> foods, List<SeedExercise> exercises,
                    List<SeedMeal> mealEntries, List<SeedWorkout> exerciseEntries) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SeedFood(Long id, String name, BigDecimal basisGrams, BigDecimal kcal, BigDecimal carbsG,
                    BigDecimal proteinG, BigDecimal fatG, BigDecimal servingGrams) {

        /** basisGrams 기준 값을 100g 기준으로 환산한다(기본 100g). */
        BigDecimal per100(BigDecimal value) {
            if (basisGrams == null || basisGrams.compareTo(BigDecimal.valueOf(100)) == 0) {
                return value;
            }
            return value.multiply(BigDecimal.valueOf(100))
                    .divide(basisGrams, 2, java.math.RoundingMode.HALF_UP);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SeedExercise(Long id, String name, BigDecimal met) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SeedMeal(Long id, LocalDate date, MealType mealType, Long foodId, BigDecimal grams) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record SeedWorkout(Long id, LocalDate date, Long exerciseId, int minutes, BigDecimal weightKg) {
    }
}
