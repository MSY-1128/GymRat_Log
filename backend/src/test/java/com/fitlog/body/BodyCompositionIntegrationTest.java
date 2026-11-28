package com.fitlog.body;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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

/** 체성분 기록 CRUD, 사용자 분리, 그리고 BMR 계산 방식·단백질 목표 반영. 실제 PostgreSQL. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BodyCompositionIntegrationTest {

    private static final String URL = "/api/v1/body-compositions";

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

    private ResultActions send(org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req,
                               String body) throws Exception {
        return mvc.perform(req.contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private long create(String date, String weight, String fat, String muscle, Integer bmr) throws Exception {
        String body = """
                {"measuredOn":"%s","weightKg":%s,"bodyFatPct":%s,"skeletalMuscleKg":%s,"measuredBmrKcal":%s}
                """.formatted(date, weight, fat, muscle, bmr);
        String res = send(post(URL), body).andExpect(status().isCreated()).andReturn().getResponse()
                .getContentAsString();
        return ((Number) JsonPath.read(res, "$.id")).longValue();
    }

    private void saveProfile(String method, String protein) throws Exception {
        send(put("/api/v1/profile"), """
                {"age":30,"sexForFormula":"MALE","heightCm":180,"weightKg":80,"activityFactor":1.2,
                 "goal":"MAINTAIN","dailyTargetKcal":null,"bmrMethod":%s,"proteinGPerKgLean":%s}
                """.formatted(method == null ? "null" : "\"" + method + "\"", protein))
                .andExpect(status().isOk());
    }

    @Test
    void crudWithDerivedMassesAndOneEntryPerDay() throws Exception {
        long id = create("2026-11-01", "80", "12", "38.5", 1850);
        create("2026-11-15", "79.2", null, null, null);

        mvc.perform(get(URL).param("from", "2026-11-01").param("to", "2026-11-30"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].measuredOn").value("2026-11-01"))
                .andExpect(jsonPath("$[0].fatMassKg").value(9.6))
                .andExpect(jsonPath("$[0].leanMassKg").value(70.4))
                // 체지방률이 없으면 계산값도 없음
                .andExpect(jsonPath("$[1].fatMassKg").value(nullValue()));

        // 같은 날짜 두 번째 기록은 409
        send(post(URL), """
                {"measuredOn":"2026-11-01","weightKg":81}
                """).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DUPLICATE_DATE"))
                .andExpect(jsonPath("$.fieldErrors.measuredOn").exists());

        send(put(URL + "/" + id), """
                {"measuredOn":"2026-11-02","weightKg":80.5,"bodyFatPct":13}
                """).andExpect(status().isOk())
                .andExpect(jsonPath("$.measuredOn").value("2026-11-02"))
                .andExpect(jsonPath("$.skeletalMuscleKg").value(nullValue()));

        mvc.perform(delete(URL + "/" + id)).andExpect(status().isNoContent());
        mvc.perform(get(URL).param("from", "2026-11-01").param("to", "2026-11-30"))
                .andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void validatesRangesAndMuscleBelowWeight() throws Exception {
        send(post(URL), """
                {"measuredOn":"2026-11-01","weightKg":80,"bodyFatPct":71,"measuredBmrKcal":100}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.bodyFatPct").exists())
                .andExpect(jsonPath("$.fieldErrors.measuredBmrKcal").exists());
        send(post(URL), """
                {"measuredOn":"2026-11-01","weightKg":40,"skeletalMuscleKg":45}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.skeletalMuscleKg").value("골격근량은 체중보다 작아야 해요."));
        mvc.perform(get(URL).param("from", "2026-11-30").param("to", "2026-11-01"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void otherUsersCannotSeeOrChangeEntries() throws Exception {
        long id = create("2026-11-01", "80", "12", null, null);
        MockMvc other = TestUsers.mvcAs(ctx, TestUsers.create(jdbc, "other"));

        other.perform(get(URL).param("from", "2026-11-01").param("to", "2026-11-30"))
                .andExpect(jsonPath("$", hasSize(0)));
        other.perform(put(URL + "/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"measuredOn\":\"2026-11-01\",\"weightKg\":50}"))
                .andExpect(status().isNotFound());
        other.perform(delete(URL + "/" + id)).andExpect(status().isNotFound());
        // 같은 날짜라도 사용자가 다르면 따로 기록할 수 있다
        other.perform(post(URL).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"measuredOn\":\"2026-11-01\",\"weightKg\":50}"))
                .andExpect(status().isCreated());
    }

    @Test
    void bmrMethodUsesLatestMeasurementOrFallsBackToFormula() throws Exception {
        // 측정 전: 체지방률 방식을 골라도 공식(Mifflin)으로 계산 = 10×80 + 6.25×180 − 5×30 + 5 = 1780
        saveProfile("BODY_FAT", "2.0");
        mvc.perform(get("/api/v1/profile"))
                .andExpect(jsonPath("$.bmrMethod").value("BODY_FAT"))
                .andExpect(jsonPath("$.bmrAppliedMethod").value("FORMULA"))
                .andExpect(jsonPath("$.bmrKcal").value(1780.0))
                .andExpect(jsonPath("$.leanMassKg").value(nullValue()))
                .andExpect(jsonPath("$.proteinTargetG").value(nullValue()));

        create("2026-10-01", "82", "15", null, 1800);
        create("2026-11-01", "80", "12", null, null);

        // 가장 최근 체지방률(11/01): 제지방 70.4kg → 370 + 21.6×70.4 = 1890.64, 단백질 2.0×70.4 = 140.8g
        mvc.perform(get("/api/v1/profile"))
                .andExpect(jsonPath("$.bmrAppliedMethod").value("BODY_FAT"))
                .andExpect(jsonPath("$.bmrMeasuredOn").value("2026-11-01"))
                .andExpect(jsonPath("$.bmrKcal").value(1890.64))
                .andExpect(jsonPath("$.tdeeKcal").value(2268.768))
                .andExpect(jsonPath("$.leanMassKg").value(70.4))
                .andExpect(jsonPath("$.proteinTargetG").value(140.8));

        // 측정값 방식: 기초대사량이 있는 가장 최근 측정(10/01)을 쓴다
        saveProfile("MEASURED", "null");
        mvc.perform(get("/api/v1/profile"))
                .andExpect(jsonPath("$.bmrAppliedMethod").value("MEASURED"))
                .andExpect(jsonPath("$.bmrMeasuredOn").value("2026-10-01"))
                .andExpect(jsonPath("$.bmrKcal").value(1800))
                .andExpect(jsonPath("$.proteinTargetG").value(nullValue()));

        // 방식 생략 → 공식
        saveProfile(null, "null");
        mvc.perform(get("/api/v1/profile"))
                .andExpect(jsonPath("$.bmrMethod").value("FORMULA"))
                .andExpect(jsonPath("$.bmrAppliedMethod").value("FORMULA"))
                .andExpect(jsonPath("$.bmrMeasuredOn").value(nullValue()));
    }

    @Test
    void proteinFactorRangeIsValidated() throws Exception {
        send(put("/api/v1/profile"), """
                {"age":30,"sexForFormula":"MALE","heightCm":180,"weightKg":80,"activityFactor":1.2,
                 "goal":"MAINTAIN","proteinGPerKgLean":3.5}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.proteinGPerKgLean").exists());
    }
}
