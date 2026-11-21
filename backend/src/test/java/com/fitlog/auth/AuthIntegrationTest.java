package com.fitlog.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
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
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 로그인·가입·로그아웃, CSRF, 사용자별 데이터 분리. 실제 PostgreSQL + Spring Security 필터 체인. */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
class AuthIntegrationTest {

    private static final String DAY = "2026-11-21";

    @Autowired
    WebApplicationContext ctx;

    @Autowired
    JdbcTemplate jdbc;

    /** 로그인하지 않은 브라우저 */
    MockMvc anon;

    @BeforeEach
    void setUp() {
        jdbc.execute("TRUNCATE meal_entry, exercise_entry, food, exercise, profile, seed_history, app_user "
                + "RESTART IDENTITY CASCADE");
        anon = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).build();
    }

    private static String creds(String username, String password) {
        return "{\"username\":\"%s\",\"password\":\"%s\"}".formatted(username, password);
    }

    private MvcResult signup(String username, String password) throws Exception {
        return anon.perform(post("/api/v1/auth/signup").with(csrf())
                        .contentType(MediaType.APPLICATION_JSON).content(creds(username, password)))
                .andExpect(status().isCreated())
                .andReturn();
    }

    private static MockHttpSession session(MvcResult r) {
        return (MockHttpSession) r.getRequest().getSession(false);
    }

    private org.springframework.test.web.servlet.ResultActions login(String username, String password)
            throws Exception {
        return anon.perform(post("/api/v1/auth/login").with(csrf())
                .contentType(MediaType.APPLICATION_JSON).content(creds(username, password)));
    }

    @Test
    void signupStartsSessionAndLogoutEndsIt() throws Exception {
        MvcResult r = signup("alice", "correct-horse-1");
        assertThat(JsonPath.<String>read(r.getResponse().getContentAsString(), "$.username")).isEqualTo("alice");
        assertThat(jdbc.queryForObject("SELECT password_hash FROM app_user", String.class))
                .startsWith("{bcrypt}").doesNotContain("correct-horse-1");

        MockHttpSession s = session(r);
        anon.perform(get("/api/v1/auth/me").session(s))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("alice"));

        anon.perform(post("/api/v1/auth/logout").session(s).with(csrf())).andExpect(status().isNoContent());
        anon.perform(get("/api/v1/auth/me").session(s))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void loginIsCaseInsensitiveAndFailuresAreGenericThenLocked() throws Exception {
        signup("Bob_01", "s3cret-pass");

        MvcResult ok = login("bob_01", "s3cret-pass").andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("Bob_01")).andReturn();
        anon.perform(get("/api/v1/auth/me").session(session(ok))).andExpect(status().isOk());

        // 없는 아이디와 틀린 비밀번호는 같은 응답
        login("nobody", "whatever-123").andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("아이디 또는 비밀번호가 올바르지 않아요."));
        for (int i = 0; i < LoginAttemptService.MAX_FAILURES; i++) {
            login("Bob_01", "wrong-pass-" + i).andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        }
        // 5번 실패 후에는 맞는 비밀번호도 잠시 막힌다
        login("bob_01", "s3cret-pass").andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("TOO_MANY_ATTEMPTS"));
    }

    @Test
    void signupValidation() throws Exception {
        signup("carol", "password-123");

        anon.perform(post("/api/v1/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(creds("CAROL", "another-pass")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"))
                .andExpect(jsonPath("$.fieldErrors.username").exists());
        anon.perform(post("/api/v1/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(creds("ab", "short")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.username").exists())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
        anon.perform(post("/api/v1/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(creds("한글아이디", "password-123")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.username").exists());
        anon.perform(post("/api/v1/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(creds("dave1234", "DAVE1234")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.password").value("아이디와 다른 비밀번호를 사용해 주세요."));
        anon.perform(post("/api/v1/auth/signup").with(csrf()).contentType(MediaType.APPLICATION_JSON)
                        .content(creds("erin", "가".repeat(25))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.password").exists());
    }

    @Test
    void apiRequiresLoginAndCsrf() throws Exception {
        anon.perform(get("/api/v1/meals").param("date", DAY))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
        anon.perform(get("/api/v1/foods/external").param("q", "콜라")).andExpect(status().isUnauthorized());

        // 로그인 상태여도 CSRF 토큰이 없으면 변경 요청은 거부
        AuthUser u = TestUsers.create(jdbc, "frank");
        anon.perform(post("/api/v1/foods").with(user(u)).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"x\",\"kcal\":1,\"carbsG\":1,\"proteinG\":1,\"fatG\":1}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        anon.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(creds("frank", "whatever-1")))
                .andExpect(status().isForbidden());
    }

    @Test
    void usersOnlySeeTheirOwnData() throws Exception {
        long demoFood = jdbc.queryForObject("INSERT INTO food (name, kcal, carbs_g, protein_g, fat_g, source, "
                + "created_at, updated_at) VALUES ('공용 바나나', 89, 23, 1, 0.3, 'DEMO', now(), now()) RETURNING id",
                Long.class);
        MockMvc a = TestUsers.mvcAs(ctx, TestUsers.create(jdbc, "userA"));
        MockMvc b = TestUsers.mvcAs(ctx, TestUsers.create(jdbc, "userB"));

        String foodJson = a.perform(post("/api/v1/foods").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"A의 비밀 음식\",\"kcal\":100,\"carbsG\":1,\"proteinG\":1,\"fatG\":1}"))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        int aFood = JsonPath.read(foodJson, "$.id");
        String mealJson = a.perform(post("/api/v1/meals").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"%s\",\"mealType\":\"LUNCH\",\"foodId\":%d,\"grams\":200}"
                                .formatted(DAY, aFood)))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        int aMeal = JsonPath.read(mealJson, "$.id");
        a.perform(put("/api/v1/profile").contentType(MediaType.APPLICATION_JSON).content("""
                        {"age":30,"sexForFormula":"MALE","heightCm":175,"weightKg":70,"activityFactor":1.2,
                         "goal":"MAINTAIN","dailyTargetKcal":2000}"""))
                .andExpect(status().isOk());

        // B에게는 A의 음식·기록·프로필이 보이지 않는다(공용 음식은 보임)
        b.perform(get("/api/v1/foods").param("q", ""))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].id").value(demoFood));
        b.perform(get("/api/v1/meals").param("date", DAY)).andExpect(jsonPath("$", hasSize(0)));
        b.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.consumedKcal").value(0))
                .andExpect(jsonPath("$.targetKcal").doesNotExist());
        b.perform(get("/api/v1/profile")).andExpect(status().isNoContent());

        // B가 A의 ID를 알아도 쓰거나 지울 수 없다
        b.perform(post("/api/v1/meals").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"%s\",\"mealType\":\"LUNCH\",\"foodId\":%d,\"grams\":100}"
                                .formatted(DAY, aFood)))
                .andExpect(status().isNotFound());
        b.perform(put("/api/v1/meals/" + aMeal).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"date\":\"%s\",\"mealType\":\"LUNCH\",\"foodId\":%d,\"grams\":1}"
                                .formatted(DAY, demoFood)))
                .andExpect(status().isNotFound());
        b.perform(delete("/api/v1/meals/" + aMeal)).andExpect(status().isNotFound());

        // A의 기록은 그대로
        a.perform(get("/api/v1/meals").param("date", DAY))
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].grams").value(200));
        a.perform(get("/api/v1/summary").param("date", DAY))
                .andExpect(jsonPath("$.consumedKcal").value(200))
                .andExpect(jsonPath("$.targetKcal").value(2000));
    }

    @Test
    void firstAccountAdoptsDataCreatedBeforeLogin() throws Exception {
        long legacyFood = jdbc.queryForObject("INSERT INTO food (name, kcal, carbs_g, protein_g, fat_g, source, "
                + "created_at, updated_at) VALUES ('예전에 등록한 음식', 120, 1, 1, 1, 'USER', now(), now()) RETURNING id",
                Long.class);
        jdbc.update("INSERT INTO meal_entry (entry_date, meal_type, food_id, grams, food_name_snapshot, "
                + "kcal_per100_snapshot, carbs_per100_snapshot, protein_per100_snapshot, fat_per100_snapshot, "
                + "created_at, updated_at) VALUES (DATE '2026-11-20', 'DINNER', ?, 100, '예전에 등록한 음식', "
                + "120, 1, 1, 1, now(), now())", legacyFood);
        jdbc.update("INSERT INTO profile (age, height_cm, weight_kg, activity_factor, goal, daily_target_kcal, "
                + "created_at, updated_at) VALUES (40, 170, 65, 1.375, 'LOSE', 1800, now(), now())");

        MockHttpSession first = session(signup("owner", "owner-pass-1"));
        anon.perform(get("/api/v1/profile").session(first))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dailyTargetKcal").value(1800));
        anon.perform(get("/api/v1/meals").param("date", "2026-11-20").session(first))
                .andExpect(jsonPath("$", hasSize(1)));
        anon.perform(get("/api/v1/foods").param("q", "예전에").session(first))
                .andExpect(jsonPath("$.items", hasSize(1)));

        // 두 번째 계정은 빈 상태로 시작
        MockHttpSession second = session(signup("guest", "guest-pass-1"));
        anon.perform(get("/api/v1/profile").session(second)).andExpect(status().isNoContent());
        anon.perform(get("/api/v1/meals").param("date", "2026-11-20").session(second))
                .andExpect(jsonPath("$", hasSize(0)));
        anon.perform(get("/api/v1/foods").param("q", "예전에").session(second))
                .andExpect(jsonPath("$.items", hasSize(0)));
    }
}
