package com.fitlog.workout;

import static org.hamcrest.Matchers.contains;
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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.web.context.WebApplicationContext;

/** 헬스(세트)·거리·시간 기록 방식과 칼로리 계산. 실제 PostgreSQL. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WorkoutModesIntegrationTest {

    private static final String DAY = "2026-11-20";

    @Autowired
    WebApplicationContext ctx;

    @Autowired
    JdbcTemplate jdbc;

    MockMvc mvc;
    long bench;
    long running;
    long tennis;

    @BeforeEach
    void setUp() throws Exception {
        jdbc.execute("TRUNCATE meal_entry, exercise_entry, food, exercise, profile, seed_history, app_user "
                + "RESTART IDENTITY CASCADE");
        mvc = TestUsers.mvcAs(ctx, TestUsers.create(jdbc, "tester"));
        bench = insert("벤치프레스", "5.0", "STRENGTH", "'CHEST'", "NULL", 1010);
        running = insert("달리기", "8.0", "TIME", "NULL", "1.00", 20);
        tennis = insert("테니스", "7.3", "TIME", "NULL", "NULL", 50);
        send(put("/api/v1/profile"), """
                {"age":30,"sexForFormula":"MALE","heightCm":175,"weightKg":70,"activityFactor":1.2,"goal":"MAINTAIN"}
                """).andExpect(status().isOk());
    }

    private long insert(String name, String met, String kind, String bodyPart, String perKm, int order) {
        // 헬스 종목은 도구·근육이 필수(카탈로그 제약)
        boolean strength = kind.equals("STRENGTH");
        return jdbc.queryForObject("INSERT INTO exercise (name, met, source, kind, body_part, kcal_per_kg_km, "
                + "equipment, primary_muscles, secondary_muscles, "
                + "sort_order, created_at, updated_at) VALUES (?, " + met + ", 'CATALOG', ?, " + bodyPart + ", "
                + perKm + ", ?, ?, ?, ?, now(), now()) RETURNING id", Long.class, name, kind,
                strength ? "BARBELL" : null, strength ? "CHEST" : null, strength ? "FRONT_DELT,TRICEPS" : null, order);
    }

    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req,
                               String body) throws Exception {
        return mvc.perform(req.contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void catalogListsKindBodyPartAndDistanceInCatalogOrder() throws Exception {
        mvc.perform(get("/api/v1/exercises"))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].name").value("달리기"))
                .andExpect(jsonPath("$[0].kind").value("TIME"))
                .andExpect(jsonPath("$[0].kcalPerKgKm").value(1.0))
                .andExpect(jsonPath("$[2].name").value("벤치프레스"))
                .andExpect(jsonPath("$[2].kind").value("STRENGTH"))
                .andExpect(jsonPath("$[2].bodyPart").value("CHEST"))
                .andExpect(jsonPath("$[2].kcalPerKgKm").value(nullValue()))
                .andExpect(jsonPath("$[2].equipment").value("BARBELL"))
                .andExpect(jsonPath("$[2].primaryMuscles", contains("CHEST")))
                .andExpect(jsonPath("$[2].secondaryMuscles", contains("FRONT_DELT", "TRICEPS")))
                .andExpect(jsonPath("$[0].primaryMuscles", hasSize(0)))
                .andExpect(jsonPath("$[0].equipment").value(nullValue()));
    }

    @Test
    void strengthUsesSetsForTimeAndRecordsVolume() throws Exception {
        // 4세트 → 10분 추정: 5.0 × 3.5 × 70 / 200 × 10 = 61.25 kcal, 볼륨 4 × 10 × 60 = 2400kg
        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":4,"reps":10,"liftedKg":60}
                """.formatted(DAY, bench))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mode").value("SETS"))
                .andExpect(jsonPath("$.bodyPart").value("CHEST"))
                .andExpect(jsonPath("$.minutes").value(nullValue()))
                .andExpect(jsonPath("$.durationMinutes").value(10.0))
                .andExpect(jsonPath("$.volumeKg").value(2400.0))
                .andExpect(jsonPath("$.calculatedKcal").value(61.25));

        // 맨몸(0kg)도 기록 가능
        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":3,"reps":15,"liftedKg":0}
                """.formatted(DAY, bench)).andExpect(status().isCreated());
    }

    @Test
    void distanceUsesPerKmCostAndOptionalTime() throws Exception {
        // 1.0 × 70 × 5 = 350 kcal (시간은 기록용)
        String res = send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"DISTANCE","distanceKm":5,"minutes":30}
                """.formatted(DAY, running))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mode").value("DISTANCE"))
                .andExpect(jsonPath("$.kcalPerKgKmSnapshot").value(1.0))
                .andExpect(jsonPath("$.calculatedKcal").value(350.0))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(res, "$.id")).longValue();

        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":4,"reps":10,"liftedKg":60}
                """.formatted(DAY, bench)).andExpect(status().isCreated());

        // 합계 시간 = 달리기 30분 + 헬스 4세트 10분
        mvc.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.exerciseMinutes").value(40))
                .andExpect(jsonPath("$.exerciseKcal").value(411.25));

        // 같은 기록을 시간 방식으로 바꾸면 MET로 다시 계산: 8 × 3.5 × 70 / 200 × 30 = 294
        send(put("/api/v1/workouts/" + id), """
                {"date":"%s","exerciseId":%d,"mode":"TIME","minutes":30,"distanceKm":5}
                """.formatted(DAY, running))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mode").value("TIME"))
                .andExpect(jsonPath("$.distanceKm").value(nullValue()))
                .andExpect(jsonPath("$.calculatedKcal").value(294));
    }

    @Test
    void modeMustFitExerciseAndRequiredValuesArePerMode() throws Exception {
        // 헬스 종목을 시간으로
        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"minutes":30}
                """.formatted(DAY, bench))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.mode").exists());
        // 거리 계수가 없는 운동(테니스)을 거리로
        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"DISTANCE","distanceKm":3}
                """.formatted(DAY, tennis))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.distanceKm").exists());
        // 세트 방식인데 횟수·무게 없음
        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":3}
                """.formatted(DAY, bench))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.reps").value("필수 값입니다."))
                .andExpect(jsonPath("$.fieldErrors.liftedKg").value("필수 값입니다."));
        // 범위
        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":51,"reps":10,"liftedKg":501}
                """.formatted(DAY, bench))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.sets").exists())
                .andExpect(jsonPath("$.fieldErrors.liftedKg").exists());
        // 시간 방식인데 시간 없음
        send(post("/api/v1/workouts"), """
                {"date":"%s","exerciseId":%d,"mode":"TIME"}
                """.formatted(DAY, tennis))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.minutes").value("필수 값입니다."));
    }
}
