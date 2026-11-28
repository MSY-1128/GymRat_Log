package com.fitlog.workout;

import static org.hamcrest.Matchers.closeTo;
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

/** 헬스(세트)와 시간 운동(체감 강도·거리·속도) 기록과 칼로리 계산. 실제 PostgreSQL. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class WorkoutModesIntegrationTest {

    private static final String DAY = "2026-11-20";
    /** 70kg 기준 MET 1당 분당 kcal = 3.5 × 70 / 200 */
    private static final double PER_MET_MIN = 1.225;

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
        bench = jdbc.queryForObject("INSERT INTO exercise (name, met, source, kind, body_part, equipment, "
                + "primary_muscles, secondary_muscles, motion, sort_order, created_at, updated_at) VALUES "
                + "('벤치프레스', 5.0, 'CATALOG', 'STRENGTH', 'CHEST', 'BARBELL', 'CHEST', 'FRONT_DELT,TRICEPS', "
                + "'bench', 1010, now(), now()) RETURNING id", Long.class);
        running = time("달리기", "AEROBIC", "6.0", "8.3", "11.0", "6.4:6.0,8.0:8.3,9.7:9.8,11.3:11.0", 20);
        tennis = time("테니스", "MIXED", "5.0", "7.3", "8.0", null, 110);
        send(put("/api/v1/profile"), """
                {"age":30,"sexForFormula":"MALE","heightCm":175,"weightKg":70,"activityFactor":1.2,"goal":"MAINTAIN"}
                """).andExpect(status().isOk());
    }

    private long time(String name, String energy, String light, String met, String vigorous, String curve, int order) {
        return jdbc.queryForObject("INSERT INTO exercise (name, met, source, kind, energy_system, met_light, "
                + "met_vigorous, speed_met_curve, motion, sort_order, created_at, updated_at) VALUES (?, " + met
                + ", 'CATALOG', 'TIME', ?, " + light + ", " + vigorous + ", ?, 'run', ?, now(), now()) RETURNING id",
                Long.class, name, energy, curve, order);
    }

    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req,
                               String body) throws Exception {
        return mvc.perform(req.contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions create(String json) throws Exception {
        return send(post("/api/v1/workouts"), json.formatted(DAY));
    }

    @Test
    void catalogListsEnergySystemIntensityAndStrengthDetail() throws Exception {
        mvc.perform(get("/api/v1/exercises"))
                .andExpect(jsonPath("$", hasSize(3)))
                .andExpect(jsonPath("$[0].name").value("달리기"))
                .andExpect(jsonPath("$[0].kind").value("TIME"))
                .andExpect(jsonPath("$[0].energySystem").value("AEROBIC"))
                .andExpect(jsonPath("$[0].metLight").value(6.0))
                .andExpect(jsonPath("$[0].met").value(8.3))
                .andExpect(jsonPath("$[0].metVigorous").value(11.0))
                .andExpect(jsonPath("$[0].speedMetCurve", hasSize(4)))
                .andExpect(jsonPath("$[0].speedMetCurve[1].speedKmh").value(8.0))
                .andExpect(jsonPath("$[0].speedMetCurve[1].met").value(8.3))
                .andExpect(jsonPath("$[0].primaryMuscles", hasSize(0)))
                .andExpect(jsonPath("$[1].energySystem").value("MIXED"))
                .andExpect(jsonPath("$[1].speedMetCurve", hasSize(0)))
                .andExpect(jsonPath("$[2].name").value("벤치프레스"))
                .andExpect(jsonPath("$[2].kind").value("STRENGTH"))
                .andExpect(jsonPath("$[2].energySystem").value("ANAEROBIC"))
                .andExpect(jsonPath("$[2].bodyPart").value("CHEST"))
                .andExpect(jsonPath("$[2].metLight").value(nullValue()))
                .andExpect(jsonPath("$[2].equipment").value("BARBELL"))
                .andExpect(jsonPath("$[2].motion").value("bench"))
                .andExpect(jsonPath("$[2].primaryMuscles", contains("CHEST")))
                .andExpect(jsonPath("$[2].secondaryMuscles", contains("FRONT_DELT", "TRICEPS")));
    }

    @Test
    void strengthUsesSetsForTimeAndRecordsVolume() throws Exception {
        // 4세트 → 10분 추정: 5.0 × 3.5 × 70 / 200 × 10 = 61.25 kcal, 볼륨 4 × 10 × 60 = 2400kg
        create("""
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":4,"reps":10,"liftedKg":60}
                """.replace("%d", String.valueOf(bench)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mode").value("SETS"))
                .andExpect(jsonPath("$.bodyPart").value("CHEST"))
                .andExpect(jsonPath("$.energySystem").value("ANAEROBIC"))
                .andExpect(jsonPath("$.minutes").value(nullValue()))
                .andExpect(jsonPath("$.intensityBasis").value(nullValue()))
                .andExpect(jsonPath("$.durationMinutes").value(10.0))
                .andExpect(jsonPath("$.volumeKg").value(2400.0))
                .andExpect(jsonPath("$.calculatedKcal").value(61.25));

        // 맨몸(0kg)도 기록 가능
        create("""
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":3,"reps":15,"liftedKg":0}
                """.replace("%d", String.valueOf(bench))).andExpect(status().isCreated());
    }

    @Test
    void timeWithLevelUsesIntensityMet() throws Exception {
        // 강도를 생략하면 보통: 7.3 × 1.225 × 60 = 536.55
        create("""
                {"date":"%s","exerciseId":%d,"mode":"TIME","minutes":60}
                """.replace("%d", String.valueOf(tennis)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.intensityBasis").value("LEVEL"))
                .andExpect(jsonPath("$.intensity").value("MODERATE"))
                .andExpect(jsonPath("$.metSnapshot").value(7.3))
                .andExpect(jsonPath("$.calculatedKcal").value(closeTo(7.3 * PER_MET_MIN * 60, 0.001)));
        // 힘들게: 8.0 × 1.225 × 60 = 588
        create("""
                {"date":"%s","exerciseId":%d,"mode":"TIME","minutes":60,"intensity":"VIGOROUS"}
                """.replace("%d", String.valueOf(tennis)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.intensity").value("VIGOROUS"))
                .andExpect(jsonPath("$.energySystem").value("MIXED"))
                .andExpect(jsonPath("$.calculatedKcal").value(closeTo(588, 0.001)));
    }

    @Test
    void distanceOrSpeedSetsMetFromSpeedCurve() throws Exception {
        // 4km ÷ 30분 = 시속 8km → MET 8.3: 8.3 × 1.225 × 30 = 305.025
        String res = create("""
                {"date":"%s","exerciseId":%d,"mode":"TIME","minutes":30,"distanceKm":4}
                """.replace("%d", String.valueOf(running)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mode").value("TIME"))
                .andExpect(jsonPath("$.intensityBasis").value("DISTANCE"))
                .andExpect(jsonPath("$.speedKmh").value(8.0))
                .andExpect(jsonPath("$.distanceKm").value(4.0))
                .andExpect(jsonPath("$.metSnapshot").value(8.3))
                .andExpect(jsonPath("$.calculatedKcal").value(closeTo(305.025, 0.001)))
                .andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(res, "$.id")).longValue();

        // 속도 입력: 시속 9.7km(곡선의 점 사이 값은 직선 보간), 60분 → 거리 9.7km, MET 9.8
        create("""
                {"date":"%s","exerciseId":%d,"minutes":60,"speedKmh":9.7}
                """.replace("%d", String.valueOf(running)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.intensityBasis").value("SPEED"))
                .andExpect(jsonPath("$.distanceKm").value(9.7))
                .andExpect(jsonPath("$.metSnapshot").value(9.8));
        // 시속 8.85km → 8.3 + (9.8 − 8.3) × 0.5 = 9.05
        create("""
                {"date":"%s","exerciseId":%d,"minutes":20,"speedKmh":8.85}
                """.replace("%d", String.valueOf(running)))
                .andExpect(jsonPath("$.metSnapshot").value(9.05));
        // 곡선 밖은 끝점 값: 시속 20km → 11.0
        create("""
                {"date":"%s","exerciseId":%d,"minutes":30,"speedKmh":20}
                """.replace("%d", String.valueOf(running)))
                .andExpect(jsonPath("$.metSnapshot").value(11.0));

        // 이전 형식(DISTANCE)도 시간이 있으면 시간 + 거리로 저장
        create("""
                {"date":"%s","exerciseId":%d,"mode":"DISTANCE","minutes":30,"distanceKm":4}
                """.replace("%d", String.valueOf(running)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.mode").value("TIME"))
                .andExpect(jsonPath("$.intensityBasis").value("DISTANCE"));

        // 같은 기록을 체감 강도(가볍게)로 바꾸면 MET 6.0: 6 × 1.225 × 30 = 220.5, 거리는 지운다
        send(put("/api/v1/workouts/" + id), """
                {"date":"%s","exerciseId":%d,"mode":"TIME","minutes":30,"intensity":"LIGHT"}
                """.formatted(DAY, running))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.intensityBasis").value("LEVEL"))
                .andExpect(jsonPath("$.distanceKm").value(nullValue()))
                .andExpect(jsonPath("$.speedKmh").value(nullValue()))
                .andExpect(jsonPath("$.calculatedKcal").value(closeTo(220.5, 0.001)));

        // 강도 입력이 같으면 카탈로그 MET가 바뀌어도 기록 당시 MET를 유지하고 시간만 다시 계산
        jdbc.update("UPDATE exercise SET met_light = 3.0 WHERE id = ?", running);
        send(put("/api/v1/workouts/" + id), """
                {"date":"%s","exerciseId":%d,"mode":"TIME","minutes":60,"intensity":"LIGHT"}
                """.formatted(DAY, running))
                .andExpect(jsonPath("$.metSnapshot").value(6.0))
                .andExpect(jsonPath("$.calculatedKcal").value(closeTo(441, 0.001)));
    }

    @Test
    void summaryAddsTimeAndEstimatedStrengthMinutes() throws Exception {
        create("""
                {"date":"%s","exerciseId":%d,"minutes":30,"distanceKm":4}
                """.replace("%d", String.valueOf(running))).andExpect(status().isCreated());
        create("""
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":4,"reps":10,"liftedKg":60}
                """.replace("%d", String.valueOf(bench))).andExpect(status().isCreated());
        // 달리기 30분 + 헬스 4세트(10분)
        mvc.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.exerciseMinutes").value(40));
    }

    @Test
    void modeAndIntensityMustFitExercise() throws Exception {
        // 헬스 종목을 시간으로
        create("""
                {"date":"%s","exerciseId":%d,"minutes":30}
                """.replace("%d", String.valueOf(bench)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.mode").exists());
        // 속도 곡선이 없는 운동(테니스)을 거리로
        create("""
                {"date":"%s","exerciseId":%d,"minutes":60,"distanceKm":3}
                """.replace("%d", String.valueOf(tennis)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.distanceKm").exists());
        // 강도는 하나만
        create("""
                {"date":"%s","exerciseId":%d,"minutes":30,"distanceKm":4,"intensity":"LIGHT"}
                """.replace("%d", String.valueOf(running)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.intensity").exists());
        // 비현실적인 속도(100km ÷ 30분 = 시속 200km)
        create("""
                {"date":"%s","exerciseId":%d,"minutes":30,"distanceKm":100}
                """.replace("%d", String.valueOf(running)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.distanceKm").exists());
        // 시간 없이 거리만(이전 형식)
        create("""
                {"date":"%s","exerciseId":%d,"mode":"DISTANCE","distanceKm":3}
                """.replace("%d", String.valueOf(running)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.minutes").value("필수 값입니다."));
        // 세트 방식인데 횟수·무게 없음
        create("""
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":3}
                """.replace("%d", String.valueOf(bench)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.reps").value("필수 값입니다."))
                .andExpect(jsonPath("$.fieldErrors.liftedKg").value("필수 값입니다."));
        // 범위
        create("""
                {"date":"%s","exerciseId":%d,"mode":"SETS","sets":51,"reps":10,"liftedKg":501}
                """.replace("%d", String.valueOf(bench)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.sets").exists())
                .andExpect(jsonPath("$.fieldErrors.liftedKg").exists());
        // 헬스 종목에 세트 대신 시간
        create("""
                {"date":"%s","exerciseId":%d,"mode":"SETS","minutes":30}
                """.replace("%d", String.valueOf(tennis)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.mode").exists());
    }
}
