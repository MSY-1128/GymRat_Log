package com.fitlog.nutrition;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.closeTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fitlog.TestUsers;
import com.fitlog.TestcontainersConfiguration;
import com.jayway.jsonpath.JsonPath;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.context.WebApplicationContext;

/** 당류·나트륨·포화지방 기록·상한 안내와 목표별 식단표. 실제 PostgreSQL. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class NutritionIntegrationTest {

    private static final String DAY = "2026-11-20";
    private static final String PROFILE = """
            {"age":30,"sexForFormula":"MALE","heightCm":175,"weightKg":70,"activityFactor":1.2,"goal":"MAINTAIN"%s}
            """;

    @Autowired
    WebApplicationContext ctx;

    @Autowired
    JdbcTemplate jdbc;

    MockMvc mvc;

    @BeforeEach
    void setUp() {
        jdbc.execute("TRUNCATE meal_entry, exercise_entry, food, exercise, profile, seed_history, app_user "
                + "RESTART IDENTITY CASCADE");
        mvc = TestUsers.mvcAs(ctx, TestUsers.create(jdbc, "tester"));
    }

    private ResultActions send(MockHttpServletRequestBuilder req, String body) throws Exception {
        return mvc.perform(req.contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private long food(String json) throws Exception {
        String body = send(post("/api/v1/foods"), json).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(body, "$.id")).longValue();
    }

    private void meal(String date, String type, long foodId, int grams) throws Exception {
        send(post("/api/v1/meals"), """
                {"date":"%s","mealType":"%s","foodId":%d,"grams":%d}
                """.formatted(date, type, foodId, grams)).andExpect(status().isCreated());
    }

    @Test
    void foodAndMealCarryLimitNutrientsAndSummaryAddsKnownOnes() throws Exception {
        long ramen = food("""
                {"name":"라면","kcal":450,"carbsG":60,"proteinG":9,"fatG":18,"sugarsG":3,"sodiumMg":1600,"saturatedFatG":8}
                """);
        long rice = food("""
                {"name":"밥","kcal":150,"carbsG":33,"proteinG":3,"fatG":0.3}
                """);
        mvc.perform(get("/api/v1/foods").param("q", "밥"))
                .andExpect(jsonPath("$.items[0].sodiumMg").value(nullValue()));

        meal(DAY, "LUNCH", ramen, 120);
        meal(DAY, "DINNER", rice, 200);

        mvc.perform(get("/api/v1/meals").param("date", DAY))
                .andExpect(jsonPath("$[0].sodiumMg").value(closeTo(1920.0, 0.001)))
                .andExpect(jsonPath("$[0].sugarsG").value(closeTo(3.6, 0.001)))
                .andExpect(jsonPath("$[1].sodiumMg").value(nullValue()));
        mvc.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.sodiumMg").value(closeTo(1920.0, 0.001)))
                .andExpect(jsonPath("$.saturatedFatG").value(closeTo(9.6, 0.001)))
                .andExpect(jsonPath("$.mealCount").value(2))
                .andExpect(jsonPath("$.sodiumMissing").value(1));
    }

    @Test
    void foodRejectsImpossibleLimitNutrients() throws Exception {
        send(post("/api/v1/foods"), """
                {"name":"이상한 음식","kcal":100,"carbsG":5,"proteinG":1,"fatG":2,"sugarsG":6}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.sugarsG").exists());
        send(post("/api/v1/foods"), """
                {"name":"이상한 음식","kcal":100,"carbsG":5,"proteinG":1,"fatG":2,"saturatedFatG":3}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.saturatedFatG").exists());
    }

    @Test
    void limitGuideComparesTodayAndSevenDayAverageAndNamesTopFoods() throws Exception {
        send(put("/api/v1/profile"), PROFILE.formatted(",\"dailyTargetKcal\":2000")).andExpect(status().isOk());
        long ramen = food("""
                {"name":"라면","kcal":450,"carbsG":60,"proteinG":9,"fatG":18,"sugarsG":3,"sodiumMg":1600,"saturatedFatG":8}
                """);
        long kimchi = food("""
                {"name":"배추김치","kcal":20,"carbsG":4,"proteinG":1.5,"fatG":0.5,"sugarsG":1,"sodiumMg":600,"saturatedFatG":0}
                """);
        long cola = food("""
                {"name":"콜라","kcal":40,"carbsG":10,"proteinG":0,"fatG":0,"sugarsG":10,"sodiumMg":5,"saturatedFatG":0}
                """);
        long unknown = food("""
                {"name":"모르는 음식","kcal":100,"carbsG":10,"proteinG":5,"fatG":3}
                """);
        meal(DAY, "LUNCH", ramen, 120);      // 나트륨 1,920
        meal(DAY, "DINNER", kimchi, 100);    // 600 → 오늘 2,520 + 콜라 25 = 2,545
        meal(DAY, "SNACK", cola, 500);       // 당류 50 (+라면 3.6 + 김치 1 = 54.6)
        meal(DAY, "SNACK", unknown, 100);
        meal("2026-11-18", "LUNCH", kimchi, 100); // 이틀 전 600

        mvc.perform(get("/api/v1/nutrition/limits").param("date", DAY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.referenceBasis").value("TARGET"))
                .andExpect(jsonPath("$.referenceKcal").value(2000))
                .andExpect(jsonPath("$.averageFrom").value("2026-11-14"))
                .andExpect(jsonPath("$.averageDays").value(2))
                .andExpect(jsonPath("$.items", hasSize(3)))
                .andExpect(jsonPath("$.items[0].nutrient").value("SODIUM"))
                .andExpect(jsonPath("$.items[0].today").value(closeTo(2545.0, 0.001)))
                .andExpect(jsonPath("$.items[0].todayMissing").value(1))
                .andExpect(jsonPath("$.items[0].limit").value(2000))
                .andExpect(jsonPath("$.items[0].average").value(closeTo(1572.5, 0.001)))
                .andExpect(jsonPath("$.items[0].percent").value(127))
                .andExpect(jsonPath("$.items[0].status").value("OVER"))
                .andExpect(jsonPath("$.items[0].averageStatus").value("OK"))
                // 당류 상한 = 2,000 × 20% ÷ 4 = 100g, 포화지방 = 2,000 × 7% ÷ 9 = 15.6g
                .andExpect(jsonPath("$.items[1].nutrient").value("SUGARS"))
                .andExpect(jsonPath("$.items[1].limit").value(100.0))
                .andExpect(jsonPath("$.items[1].status").value("OK"))
                .andExpect(jsonPath("$.items[2].limit").value(15.6))
                .andExpect(jsonPath("$.advice", hasSize(1)))
                .andExpect(jsonPath("$.advice[0].nutrient").value("SODIUM"))
                .andExpect(jsonPath("$.advice[0].level").value("WARN"))
                .andExpect(jsonPath("$.advice[0].message").value("오늘 나트륨이 상한(2,000mg)보다 545mg 많아요."))
                .andExpect(jsonPath("$.advice[0].topFoods[0].name").value("라면"))
                .andExpect(jsonPath("$.advice[0].topFoods[0].amount").value(1920))
                .andExpect(jsonPath("$.advice[0].topFoods[1].name").value("배추김치"))
                .andExpect(jsonPath("$.advice[0].tips", hasSize(3)));
    }

    @Test
    void limitGuideWithoutProfileUsesTwoThousandKcalAndReportsNoRecord() throws Exception {
        mvc.perform(get("/api/v1/nutrition/limits").param("date", DAY))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.referenceBasis").value("DEFAULT"))
                .andExpect(jsonPath("$.averageDays").value(0))
                .andExpect(jsonPath("$.items[0].status").value("NO_RECORD"))
                .andExpect(jsonPath("$.items[0].average").value(nullValue()))
                .andExpect(jsonPath("$.advice", hasSize(0)));
    }

    /** 식단표 기본 식품(V8 seed와 같은 식약처 값). 테스트는 food를 비우므로 다시 넣는다. */
    private void seedPlanFoods() {
        List<Object[]> rows = List.of(
                new Object[] {"R101-008000349-0000", "멥쌀, 백미, 밥", 152, 32.86, 2.61, 0.38, 0.01, 1, 0.13},
                new Object[] {"R101-013000500-0000", "멥쌀, 현미, 발아현미, 밥", 178, 37.02, 4.05, 1.38, 0.38, 0, 0.31},
                new Object[] {"R101-001000000-0000", "귀리, 오트밀", 382, 64.90, 13.20, 8.20, null, 4, null},
                new Object[] {"D107-128180000-0001", "고구마_찐고구마", 139, 32.47, 1.67, 0.24, 16.32, 10, 0.05},
                new Object[] {"R109-008000451-0000", "닭고기, 가슴, 구운것(팬)", 164, 0, 35.47, 1.48, 0, 61, 0.58},
                new Object[] {"R109-027066201-0000", "소고기, 한우(1등급), 우둔, 생것", 162, 0, 23.00, 6.92, 0, 50, 2.88},
                new Object[] {"D308-388000000-0001", "연어구이", 234, 0.20, 24.78, 14.94, 0.55, 158, 2.17},
                new Object[] {"R110-003000046-0000", "달걀, 삶은것", 145, 1.37, 13.49, 8.69, 0.13, 128, 2.78},
                new Object[] {"R121-026061100-0000", "요구르트, 호상, 플레인", 86, 9.69, 4.53, 3.21, 8.51, 56, 1.99},
                new Object[] {"R106-092000047-0000", "브로콜리, 데친것", 26, 4.45, 3.20, 0.24, 1.37, 4, 0.08},
                new Object[] {"R106-115000047-0000", "시금치, 데친것", 34, 5.26, 4.02, 0.61, 0.16, 29, 0.10},
                new Object[] {"R106-186000001-0000", "토마토, 생것", 19, 4.27, 0.77, 0.19, 2.68, 2, 0.03},
                new Object[] {"R108-037000001-0000", "바나나, 생것", 77, 20.00, 1.11, 0.20, 14.18, 0, 0.05},
                new Object[] {"R105-020000058-0000", "아몬드, 볶은것", 594, 20.49, 23.45, 51.29, 3.91, 2, 3.79},
                new Object[] {"R108-064000001-0000", "아보카도, 생것", 160, 8.53, 2.00, 14.66, 0.66, 7, 2.13});
        for (Object[] r : rows) {
            jdbc.update("INSERT INTO food (external_code, name, kcal, carbs_g, protein_g, fat_g, sugars_g, sodium_mg, "
                    + "saturated_fat_g, source, volume_based, created_at, updated_at) "
                    + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'MFDS', false, now(), now())", r);
        }
    }

    @Test
    void mealPlanFollowsGoalTargetsAndSplitsIntoFourMeals() throws Exception {
        seedPlanFoods();
        send(put("/api/v1/profile"), PROFILE.formatted("")).andExpect(status().isOk());
        // BMR = 10×70 + 6.25×175 − 5×30 + 5 = 1,648.75, TDEE = ×1.2 = 1,978.5 → 1,979
        String body = mvc.perform(get("/api/v1/nutrition/meal-plan").param("goal", "GAIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goal").value("GAIN"))
                .andExpect(jsonPath("$.targets.tdeeKcal").value(1979))
                .andExpect(jsonPath("$.targets.kcal").value(2177))      // +10%
                .andExpect(jsonPath("$.targets.proteinG").value(126))   // 70 × 1.8
                .andExpect(jsonPath("$.targets.fatG").value(60))        // 2,177 × 25% ÷ 9
                .andExpect(jsonPath("$.targets.carbsG").value(283))     // 나머지 ÷ 4
                .andExpect(jsonPath("$.meals", hasSize(4)))
                .andExpect(jsonPath("$.meals[0].mealType").value("BREAKFAST"))
                .andExpect(jsonPath("$.meals[0].sharePercent").value(25))
                .andExpect(jsonPath("$.meals[3].mealType").value("SNACK"))
                .andReturn().getResponse().getContentAsString();

        double total = ((Number) JsonPath.read(body, "$.total.kcal")).doubleValue();
        double protein = ((Number) JsonPath.read(body, "$.total.proteinG")).doubleValue();
        assertThat(total).isBetween(2177 * 0.9, 2177 * 1.1);
        assertThat(protein).isBetween(126 * 0.9, 126 * 1.15);
        List<Map<String, Object>> meals = JsonPath.read(body, "$.meals");
        for (Map<String, Object> m : meals) {
            assertThat((List<?>) m.get("items")).as("%s items", m.get("mealType")).isNotEmpty();
        }
        // 식단표의 음식은 바로 기록할 수 있는 실제 음식 ID다
        List<Integer> ids = JsonPath.read(body, "$.meals[*].items[*].foodId");
        Integer known = jdbc.queryForObject("SELECT count(*) FROM food WHERE id IN ("
                + String.join(",", ids.stream().map(String::valueOf).toList()) + ")", Integer.class);
        assertThat(known).isEqualTo((int) ids.stream().distinct().count());

        String other = mvc.perform(get("/api/v1/nutrition/meal-plan").param("goal", "GAIN").param("variant", "1"))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        assertThat((List<?>) JsonPath.read(other, "$.meals[1].items[*].name"))
                .isNotEqualTo(JsonPath.read(body, "$.meals[1].items[*].name"));
    }

    @Test
    void losePlanNeverGoesBelowBmrAndDefaultsToProfileGoal() throws Exception {
        seedPlanFoods();
        send(put("/api/v1/profile"), PROFILE.formatted("").replace("MAINTAIN", "LOSE")).andExpect(status().isOk());
        // TDEE 1,979 × 0.8 = 1,583 < BMR 1,648.75 → 1,649
        mvc.perform(get("/api/v1/nutrition/meal-plan"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.goal").value("LOSE"))
                .andExpect(jsonPath("$.targets.kcal").value(1649))
                .andExpect(jsonPath("$.targets.proteinG").value(154));  // 70 × 2.2
    }

    @Test
    void mealPlanUsesLatestBodyCompositionAndInternationalBodyFatRanges() throws Exception {
        seedPlanFoods();
        send(put("/api/v1/profile"), PROFILE.formatted("")).andExpect(status().isOk());
        // 체지방률 25% → 남 20~39세 비만(25% 이상, Gallagher 2000). 제지방량 60kg
        send(post("/api/v1/body-compositions"), """
                {"measuredOn":"2026-11-10","weightKg":80,"bodyFatPct":25}
                """).andExpect(status().isCreated());

        // 기초대사량 = 370 + 21.6 × 60 = 1,666 → 유지 1,666 × 1.2 = 1,999
        mvc.perform(get("/api/v1/nutrition/meal-plan").param("goal", "GAIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.body.source").value("BODY_COMPOSITION"))
                .andExpect(jsonPath("$.body.measuredOn").value("2026-11-10"))
                .andExpect(jsonPath("$.body.leanMassKg").value(60.0))
                .andExpect(jsonPath("$.body.bmrSource").value("LEAN_MASS"))
                .andExpect(jsonPath("$.body.bmrKcal").value(1666))
                .andExpect(jsonPath("$.body.bodyFatLevel").value("VERY_HIGH"))
                .andExpect(jsonPath("$.targets.weightKg").value(80.0))
                .andExpect(jsonPath("$.targets.tdeeKcal").value(1999))
                .andExpect(jsonPath("$.targets.kcal").value(2099))      // 체지방이 많아 +5%
                .andExpect(jsonPath("$.targets.proteinG").value(126));  // 제지방 60 × 2.1

        // 인바디 측정 기초대사량이 있으면 그 값을 쓴다. 감량: 1,700 × 1.2 × 0.8 = 1,632 < 1,700 → 1,700
        send(post("/api/v1/body-compositions"), """
                {"measuredOn":"2026-11-17","weightKg":80,"bodyFatMassKg":20,"measuredBmrKcal":1700}
                """).andExpect(status().isCreated());
        mvc.perform(get("/api/v1/nutrition/meal-plan").param("goal", "LOSE"))
                .andExpect(jsonPath("$.body.measuredOn").value("2026-11-17"))
                .andExpect(jsonPath("$.body.bmrSource").value("MEASURED"))
                .andExpect(jsonPath("$.targets.kcal").value(1700))
                .andExpect(jsonPath("$.targets.proteinG").value(156));  // 제지방 60 × 2.6

        // 체지방률이 건강 범위면 감량을 15%로 천천히
        send(post("/api/v1/body-compositions"), """
                {"measuredOn":"2026-11-24","weightKg":80,"bodyFatPct":15,"measuredBmrKcal":1900}
                """).andExpect(status().isCreated());
        mvc.perform(get("/api/v1/nutrition/meal-plan").param("goal", "LOSE"))
                .andExpect(jsonPath("$.body.bodyFatLevel").value("NORMAL"))
                .andExpect(jsonPath("$.targets.kcal").value(1938));     // 1,900 × 1.2 × 0.85
    }

    @Test
    void mealPlanNeedsProfileAndValidParameters() throws Exception {
        mvc.perform(get("/api/v1/nutrition/meal-plan"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("PROFILE_REQUIRED"));
        send(put("/api/v1/profile"), PROFILE.formatted("")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/nutrition/meal-plan").param("goal", "BULK"))
                .andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/nutrition/meal-plan").param("variant", "-1"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.variant").exists());
    }
}
