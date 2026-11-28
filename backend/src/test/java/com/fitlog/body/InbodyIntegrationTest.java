package com.fitlog.body;

import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.web.context.WebApplicationContext;

/** 인바디 결과지 항목 입력, 정형화(체지방률↔체지방량·앞뒤 검사), 국제 기준 분석. 실제 PostgreSQL. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class InbodyIntegrationTest {

    private static final String URL = "/api/v1/body-compositions";
    /** 결과지 예시(남 30세 175cm). 체수분+단백질+무기질+체지방량 = 74.85 ≈ 체중 75 */
    private static final String SHEET = """
            {"measuredOn":"2026-11-20","weightKg":75.0,
             "bodyWaterL":44.0,"proteinKg":11.8,"mineralKg":4.05,"bodyFatMassKg":15.0,
             "skeletalMuscleKg":33.5,
             "segmentalLean":{"rightArm":3.40,"leftArm":3.30,"trunk":27.0,"rightLeg":9.20,"leftLeg":9.00},
             "segmentalFat":{"rightArm":1.0,"leftArm":1.0,"trunk":7.5,"rightLeg":2.4,"leftLeg":2.4},
             "measuredBmrKcal":1666,"visceralFatLevel":6,"ecwRatio":0.381,"waistHipRatio":0.88,"inbodyScore":78}
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

    private static String metric(String group, String key, String field) {
        return "$.groups[?(@.key=='" + group + "')].items[?(@.key=='" + key + "')]." + field;
    }

    @Test
    void savesWholeSheetAndFillsBodyFatPercentFromMass() throws Exception {
        send(post(URL), SHEET).andExpect(status().isCreated())
                .andExpect(jsonPath("$.bodyFatPct").value(20.0))      // 15 ÷ 75
                .andExpect(jsonPath("$.fatMassKg").value(15.0))
                .andExpect(jsonPath("$.leanMassKg").value(60.0))
                .andExpect(jsonPath("$.bodyWaterL").value(44.0))
                .andExpect(jsonPath("$.mineralKg").value(4.05))
                .andExpect(jsonPath("$.segmentalLean.trunk").value(27.0))
                .andExpect(jsonPath("$.segmentalFat.leftLeg").value(2.4))
                .andExpect(jsonPath("$.appendicularLeanKg").value(24.9))
                .andExpect(jsonPath("$.ecwRatio").value(0.381))
                .andExpect(jsonPath("$.inbodyScore").value(78));

        // 체지방률만 넣으면 체지방량을 계산해 저장한다
        send(post(URL), """
                {"measuredOn":"2026-11-21","weightKg":80,"bodyFatPct":12.5}
                """).andExpect(status().isCreated())
                .andExpect(jsonPath("$.fatMassKg").value(10.0))
                .andExpect(jsonPath("$.segmentalLean.trunk").doesNotExist());
    }

    @Test
    void rejectsValuesThatDoNotAddUpAndReportsEveryField() throws Exception {
        send(post(URL), """
                {"measuredOn":"2026-11-20","weightKg":75,"bodyFatPct":20,"bodyFatMassKg":12,
                 "bodyWaterL":50,"proteinKg":11.8,"mineralKg":4.05,"skeletalMuscleKg":70,
                 "segmentalFat":{"trunk":30}}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.bodyFatMassKg").value("체지방량과 체지방률이 맞지 않아요. 체중 × 체지방률 = 15.0kg이에요."))
                .andExpect(jsonPath("$.fieldErrors.skeletalMuscleKg").exists())
                .andExpect(jsonPath("$.fieldErrors.segmentalFat").exists());

        send(post(URL), """
                {"measuredOn":"2026-11-20","weightKg":75,"bodyFatMassKg":15,"bodyWaterL":50,"proteinKg":11.8,"mineralKg":4.05}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.bodyWaterL").exists());

        send(post(URL), """
                {"measuredOn":"2026-11-20","weightKg":75,"segmentalLean":{"rightArm":40}}
                """).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors['segmentalLean.rightArm']").exists());
    }

    @Test
    void analysisGroupsLikeTheSheetAndJudgesByInternationalStandards() throws Exception {
        send(put("/api/v1/profile"), """
                {"age":30,"sexForFormula":"MALE","heightCm":175,"weightKg":75,"activityFactor":1.2,"goal":"MAINTAIN"}
                """).andExpect(status().isOk());
        String res = send(post(URL), SHEET).andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(res, "$.id")).longValue();

        mvc.perform(get(URL + "/" + id + "/analysis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.context.standardWeightKg").value(67.4))   // 22 × 1.75²
                .andExpect(jsonPath("$.context.missing", hasSize(0)))
                .andExpect(jsonPath("$.groups[*].key").value(org.hamcrest.Matchers.contains("COMPOSITION",
                        "MUSCLE_FAT", "OBESITY", "MUSCLE", "SEGMENT_LEAN", "SEGMENT_FAT", "RESEARCH")))
                .andExpect(jsonPath(metric("COMPOSITION", "bodyWater", "sharePct")).value(hasItem(58.7)))
                // BMI 75 ÷ 1.75² = 24.5 → 아시아·태평양 기준 과체중(23~24.9)
                .andExpect(jsonPath(metric("OBESITY", "bmi", "value")).value(hasItem(24.5)))
                .andExpect(jsonPath(metric("OBESITY", "bmi", "level")).value(hasItem("HIGH")))
                // 체지방률 20% → 남 20~39세 건강 범위 8~20% (Gallagher 2000)
                .andExpect(jsonPath(metric("OBESITY", "bodyFatPct", "level")).value(hasItem("NORMAL")))
                .andExpect(jsonPath(metric("OBESITY", "bodyFatPct", "normalHigh")).value(hasItem(20)))
                // FMI 15 ÷ 1.75² = 4.9 → 남 정상 3~6 (Kelly 2009)
                .andExpect(jsonPath(metric("OBESITY", "fatMassIndex", "value")).value(hasItem(4.9)))
                .andExpect(jsonPath(metric("OBESITY", "fatMassIndex", "level")).value(hasItem("NORMAL")))
                .andExpect(jsonPath(metric("OBESITY", "waistHipRatio", "level")).value(hasItem("NORMAL")))
                // 사지근육지수 24.9 ÷ 1.75² = 8.1 ≥ 7.0 (AWGS 2019)
                .andExpect(jsonPath(metric("MUSCLE", "appendicularMuscleIndex", "value")).value(hasItem(8.1)))
                .andExpect(jsonPath(metric("MUSCLE", "appendicularMuscleIndex", "level")).value(hasItem("NORMAL")))
                .andExpect(jsonPath(metric("MUSCLE", "fatFreeMassIndex", "value")).value(hasItem(19.6)))
                .andExpect(jsonPath(metric("SEGMENT_LEAN", "armBalance", "value")).value(hasItem(2.9)))
                .andExpect(jsonPath(metric("RESEARCH", "leanBmr", "value")).value(hasItem(1666)))
                .andExpect(jsonPath(metric("RESEARCH", "ecwRatio", "basis")).value(hasItem(BodyStandards.INBODY)));
    }

    @Test
    void analysisSaysWhatIsMissingWithoutProfile() throws Exception {
        String res = send(post(URL), """
                {"measuredOn":"2026-11-20","weightKg":75,"bodyFatPct":20}
                """).andReturn().getResponse().getContentAsString();
        long id = ((Number) JsonPath.read(res, "$.id")).longValue();

        mvc.perform(get(URL + "/" + id + "/analysis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.context.missing", hasSize(2)))
                .andExpect(jsonPath("$.groups[*].key").value(org.hamcrest.Matchers.contains("COMPOSITION",
                        "MUSCLE_FAT", "OBESITY", "RESEARCH")))
                .andExpect(jsonPath(metric("OBESITY", "bodyFatPct", "level")).value(hasItem(org.hamcrest.Matchers
                        .nullValue())));
        mvc.perform(get(URL + "/999/analysis")).andExpect(status().isNotFound());
    }
}
