package com.fitlog;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Spring Boot + 실제 PostgreSQL(Testcontainers) 통합 테스트: CRUD, 합계, snapshot, 오류 형식. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class ApiIntegrationTest {

    private static final String DAY = "2026-03-10";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    long runningId;
    long cyclingId;

    @BeforeEach
    void clean() {
        jdbc.execute("TRUNCATE meal_entry, exercise_entry, food, exercise, profile, seed_history "
                + "RESTART IDENTITY CASCADE");
        runningId = jdbc.queryForObject("INSERT INTO exercise (name, met, source, created_at, updated_at) "
                + "VALUES ('달리기', 8, 'DEMO', now(), now()) RETURNING id", Long.class);
        cyclingId = jdbc.queryForObject("INSERT INTO exercise (name, met, source, created_at, updated_at) "
                + "VALUES ('자전거', 6, 'DEMO', now(), now()) RETURNING id", Long.class);
    }

    // ---------- helpers ----------

    private ResultActions postJson(String url, String body) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions putJson(String url, String body) throws Exception {
        return mvc.perform(put(url).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private long idOf(ResultActions result) throws Exception {
        return ((Number) JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.id")).longValue();
    }

    private long createFood(String name, String kcal) throws Exception {
        return idOf(postJson("/api/v1/foods", """
                {"name":"%s","kcal":%s,"carbsG":32,"proteinG":3,"fatG":1,"servingGrams":210}
                """.formatted(name, kcal)).andExpect(status().isCreated()));
    }

    private void saveProfile(String weightKg, Integer target) throws Exception {
        putJson("/api/v1/profile", """
                {"age":30,"sexForFormula":"MALE","heightCm":175,"weightKg":%s,"activityFactor":1.2,
                 "goal":"MAINTAIN","dailyTargetKcal":%s}
                """.formatted(weightKg, target)).andExpect(status().isOk());
    }

    // ---------- profile ----------

    @Test
    void profileReturns204ThenSavesAndCalculatesOnServer() throws Exception {
        mvc.perform(get("/api/v1/profile")).andExpect(status().isNoContent());

        putJson("/api/v1/profile", """
                {"age":30,"sexForFormula":"MALE","heightCm":175,"weightKg":70,"activityFactor":1.2,"goal":"LOSE"}
                """)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.bmrKcal").value(1648.75))
                .andExpect(jsonPath("$.tdeeKcal").value(1978.5))
                .andExpect(jsonPath("$.dailyTargetKcal").value(nullValue()));

        // 성별 미선택 → BMR/TDEE null, 같은 프로필 행을 갱신
        putJson("/api/v1/profile", """
                {"age":31,"sexForFormula":null,"heightCm":175,"weightKg":71,"activityFactor":1.55,
                 "goal":"GAIN","dailyTargetKcal":2200}
                """).andExpect(status().isOk());
        mvc.perform(get("/api/v1/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.age").value(31))
                .andExpect(jsonPath("$.bmrKcal").value(nullValue()))
                .andExpect(jsonPath("$.tdeeKcal").value(nullValue()))
                .andExpect(jsonPath("$.dailyTargetKcal").value(2200));
        org.assertj.core.api.Assertions.assertThat(
                jdbc.queryForObject("SELECT count(*) FROM profile", Integer.class)).isEqualTo(1);
    }

    @Test
    void invalidProfileReturnsValidationErrorFormat() throws Exception {
        putJson("/api/v1/profile", """
                {"age":18,"heightCm":175,"weightKg":70,"activityFactor":1.3,"goal":"LOSE"}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("입력값을 확인해 주세요."))
                .andExpect(jsonPath("$.fieldErrors.age").exists())
                .andExpect(jsonPath("$.fieldErrors.activityFactor").exists());
    }

    // ---------- foods ----------

    @Test
    void foodSearchIsPaginatedAndLimited() throws Exception {
        for (int i = 1; i <= 25; i++) {
            createFood("테스트음식%02d".formatted(i), "100");
        }
        createFood("바나나", "89");

        mvc.perform(get("/api/v1/foods").param("q", "테스트").param("page", "2").param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(5)))
                .andExpect(jsonPath("$.items[0].name").value("테스트음식21"))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.size").value(10))
                .andExpect(jsonPath("$.totalElements").value(25));

        mvc.perform(get("/api/v1/foods").param("q", "바나"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].source").value("USER"))
                .andExpect(jsonPath("$.items[0].servingGrams").value(210));

        // LIKE 와일드카드는 문자 그대로 취급
        mvc.perform(get("/api/v1/foods").param("q", "%")).andExpect(jsonPath("$.totalElements").value(0));

        mvc.perform(get("/api/v1/foods").param("q", "가".repeat(51)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/foods").param("size", "51")).andExpect(status().isBadRequest());
    }

    @Test
    void createFoodRejectsNegativeNutrition() throws Exception {
        postJson("/api/v1/foods", """
                {"name":"이상한 음식","kcal":-1,"carbsG":0,"proteinG":0,"fatG":0}
                """)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.kcal").exists());
    }

    // ---------- meals ----------

    @Test
    void mealCrudAndSummaryTotals() throws Exception {
        long rice = createFood("현미밥", "150");
        long chicken = idOf(postJson("/api/v1/foods", """
                {"name":"닭가슴살","kcal":165,"carbsG":0,"proteinG":31,"fatG":3.6}
                """));

        long m1 = idOf(postJson("/api/v1/meals", """
                {"date":"%s","mealType":"LUNCH","foodId":%d,"grams":200}
                """.formatted(DAY, rice))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.calculatedKcal").value(300))
                .andExpect(jsonPath("$.foodNameSnapshot").value("현미밥"))
                .andExpect(jsonPath("$.date").value(DAY)));
        long m2 = idOf(postJson("/api/v1/meals", """
                {"date":"%s","mealType":"DINNER","foodId":%d,"grams":150}
                """.formatted(DAY, chicken)).andExpect(status().isCreated()));
        // 다른 날짜 기록은 합계에 포함되지 않아야 한다
        postJson("/api/v1/meals", """
                {"date":"2026-03-11","mealType":"BREAKFAST","foodId":%d,"grams":100}
                """.formatted(rice)).andExpect(status().isCreated());

        mvc.perform(get("/api/v1/meals").param("date", DAY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].id").value(m1))
                .andExpect(jsonPath("$[1].id").value(m2));

        // 목표 미설정 → remaining null
        mvc.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.consumedKcal").value(547.5))
                .andExpect(jsonPath("$.targetKcal").value(nullValue()))
                .andExpect(jsonPath("$.remainingKcal").value(nullValue()))
                .andExpect(jsonPath("$.carbsG").value(64))
                .andExpect(jsonPath("$.proteinG").value(52.5))
                .andExpect(jsonPath("$.fatG").value(7.4));

        saveProfile("70", 500);
        mvc.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.targetKcal").value(500))
                .andExpect(jsonPath("$.remainingKcal").value(-47.5));

        putJson("/api/v1/meals/" + m2, """
                {"date":"%s","mealType":"SNACK","foodId":%d,"grams":100}
                """.formatted(DAY, chicken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mealType").value("SNACK"))
                .andExpect(jsonPath("$.calculatedKcal").value(165));

        mvc.perform(delete("/api/v1/meals/" + m1)).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/meals/" + m1))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mvc.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.consumedKcal").value(165));
    }

    @Test
    void pastMealKeepsSnapshotAfterFoodChanges() throws Exception {
        long rice = createFood("현미밥", "150");
        long meal = idOf(postJson("/api/v1/meals", """
                {"date":"%s","mealType":"LUNCH","foodId":%d,"grams":100}
                """.formatted(DAY, rice)));

        jdbc.update("UPDATE food SET name = '현미밥(수정)', kcal = 500 WHERE id = ?", rice);

        mvc.perform(get("/api/v1/meals").param("date", DAY))
                .andExpect(jsonPath("$[0].foodNameSnapshot").value("현미밥"))
                .andExpect(jsonPath("$[0].calculatedKcal").value(150));
        // 같은 음식으로 그램만 수정해도 snapshot 유지
        putJson("/api/v1/meals/" + meal, """
                {"date":"%s","mealType":"LUNCH","foodId":%d,"grams":200}
                """.formatted(DAY, rice)).andExpect(jsonPath("$.calculatedKcal").value(300));
    }

    @Test
    void mealReferencingUnknownFoodReturns404AndBadInputReturns400() throws Exception {
        postJson("/api/v1/meals", """
                {"date":"%s","mealType":"LUNCH","foodId":9999,"grams":100}
                """.formatted(DAY)).andExpect(status().isNotFound());
        postJson("/api/v1/meals", """
                {"date":"%s","mealType":"BRUNCH","foodId":1,"grams":100}
                """.formatted(DAY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        postJson("/api/v1/meals", """
                {"date":"%s","mealType":"LUNCH","foodId":1,"grams":0}
                """.formatted(DAY))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.grams").value("0보다 커야 합니다."));
        postJson("/api/v1/meals", "{not json").andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/meals").param("date", "2026-13-01")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/meals")).andExpect(status().isBadRequest());
    }

    // ---------- workouts ----------

    @Test
    void workoutRequiresProfileThenSnapshotsWeight() throws Exception {
        postJson("/api/v1/workouts", """
                {"date":"%s","exerciseId":%d,"minutes":30}
                """.formatted(DAY, runningId))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROFILE_REQUIRED"));

        saveProfile("70", 2000);
        long w = idOf(postJson("/api/v1/workouts", """
                {"date":"%s","exerciseId":%d,"minutes":30}
                """.formatted(DAY, runningId))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.weightKgSnapshot").value(70))
                .andExpect(jsonPath("$.metSnapshot").value(8))
                .andExpect(jsonPath("$.calculatedKcal").value(294)));

        // 프로필 체중/운동 MET가 바뀌어도 과거 기록은 그대로
        saveProfile("80", 2000);
        jdbc.update("UPDATE exercise SET met = 10 WHERE id = ?", runningId);
        putJson("/api/v1/workouts/" + w, """
                {"date":"%s","exerciseId":%d,"minutes":60}
                """.formatted(DAY, runningId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.weightKgSnapshot").value(70))
                .andExpect(jsonPath("$.metSnapshot").value(8))
                .andExpect(jsonPath("$.calculatedKcal").value(588));

        // 종류 변경 시에만 새 MET, 체중은 유지
        putJson("/api/v1/workouts/" + w, """
                {"date":"%s","exerciseId":%d,"minutes":30}
                """.formatted(DAY, cyclingId))
                .andExpect(jsonPath("$.nameSnapshot").value("자전거"))
                .andExpect(jsonPath("$.metSnapshot").value(6))
                .andExpect(jsonPath("$.weightKgSnapshot").value(70))
                .andExpect(jsonPath("$.calculatedKcal").value(220.5));

        // 운동량은 남은 칼로리에 자동 가산되지 않는다
        mvc.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.exerciseKcal").value(220.5))
                .andExpect(jsonPath("$.exerciseMinutes").value(30))
                .andExpect(jsonPath("$.remainingKcal").value(2000));

        mvc.perform(get("/api/v1/workouts").param("date", DAY)).andExpect(jsonPath("$", hasSize(1)));
        mvc.perform(delete("/api/v1/workouts/" + w)).andExpect(status().isNoContent());
        mvc.perform(get("/api/v1/workouts").param("date", DAY)).andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void workoutMinutesValidated() throws Exception {
        saveProfile("70", null);
        postJson("/api/v1/workouts", """
                {"date":"%s","exerciseId":%d,"minutes":1441}
                """.formatted(DAY, runningId))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.minutes").exists());
    }

    @Test
    void exercisesAreListed() throws Exception {
        mvc.perform(get("/api/v1/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].name").value("달리기"))
                .andExpect(jsonPath("$[0].met").value(8))
                .andExpect(jsonPath("$[0].source").value("DEMO"));
    }

    // ---------- stats ----------

    @Test
    void statsFillsEmptyDaysWithZeroAndLimitsRange() throws Exception {
        long rice = createFood("현미밥", "150");
        postJson("/api/v1/meals", """
                {"date":"2026-03-01","mealType":"LUNCH","foodId":%d,"grams":100}
                """.formatted(rice));
        postJson("/api/v1/meals", """
                {"date":"2026-03-03","mealType":"LUNCH","foodId":%d,"grams":200}
                """.formatted(rice));

        mvc.perform(get("/api/v1/stats").param("from", "2026-03-01").param("to", "2026-03-07"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(7)))
                .andExpect(jsonPath("$[0].date").value("2026-03-01"))
                .andExpect(jsonPath("$[0].consumedKcal").value(150))
                .andExpect(jsonPath("$[1].consumedKcal").value(0))
                .andExpect(jsonPath("$[1].exerciseKcal").value(0))
                .andExpect(jsonPath("$[2].consumedKcal").value(300))
                .andExpect(jsonPath("$[6].date").value("2026-03-07"));

        mvc.perform(get("/api/v1/stats").param("from", "2025-01-01").param("to", "2026-01-01"))
                .andExpect(jsonPath("$", hasSize(366)));
        mvc.perform(get("/api/v1/stats").param("from", "2025-01-01").param("to", "2026-01-02"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/stats").param("from", "2026-03-07").param("to", "2026-03-01"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.from").exists());
    }

    @Test
    void unknownPathReturnsJson404WithoutInternals() throws Exception {
        mvc.perform(get("/api/v1/nope"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }
}
