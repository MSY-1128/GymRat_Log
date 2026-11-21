package com.fitlog.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fitlog.TestcontainersConfiguration;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/**
 * 브라우저와 같은 방식(XSRF-TOKEN 쿠키 → X-XSRF-TOKEN 헤더)의 CSRF 흐름.
 *
 * <p>spring-security-test의 csrf() 후처리기는 공유 컨텍스트의 CSRF 저장소를 테스트용으로 바꿔 놓기 때문에,
 * 실제 쿠키 저장소를 검증하려고 새 컨텍스트에서 실행하고 csrf()를 쓰지 않는다.
 */
@SpringBootTest
@Import(TestcontainersConfiguration.class)
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
class CsrfCookieFlowTest {

    private static final String FOOD = "{\"name\":\"x\",\"kcal\":1,\"carbsG\":1,\"proteinG\":1,\"fatG\":1}";

    @Autowired
    WebApplicationContext ctx;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void cookieTokenWorksAndRotatesOnLogin() throws Exception {
        jdbc.execute("TRUNCATE meal_entry, exercise_entry, food, exercise, profile, seed_history, app_user "
                + "RESTART IDENTITY CASCADE");
        MockMvc browser = MockMvcBuilders.webAppContextSetup(ctx).apply(springSecurity()).build();

        // 1) 토큰 쿠키 받기(JS가 읽을 수 있어야 함)
        Cookie first = browser.perform(get("/api/v1/auth/csrf")).andExpect(status().isNoContent())
                .andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(first).isNotNull();
        assertThat(first.isHttpOnly()).isFalse();

        // 헤더 없이 가입하면 거부
        browser.perform(post("/api/v1/auth/signup").cookie(first).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"grace\",\"password\":\"pass-word-9\"}"))
                .andExpect(status().isForbidden());

        // 2) 쿠키 값을 헤더로 돌려보내 가입
        MvcResult r = browser.perform(post("/api/v1/auth/signup").cookie(first)
                        .header("X-XSRF-TOKEN", first.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"grace\",\"password\":\"pass-word-9\"}"))
                .andExpect(status().isCreated()).andReturn();
        MockHttpSession s = (MockHttpSession) r.getRequest().getSession(false);

        // 3) 로그인하면 이전 토큰 쿠키를 지운다(브라우저가 버림) → 토큰 없이 보내면 거부
        Cookie cleared = r.getResponse().getCookie("XSRF-TOKEN");
        assertThat(cleared).isNotNull();
        assertThat(cleared.getMaxAge()).isZero();
        browser.perform(post("/api/v1/foods").session(s).contentType(MediaType.APPLICATION_JSON).content(FOOD))
                .andExpect(status().isForbidden());

        // 4) 새 토큰을 받아 보내면 성공
        Cookie fresh = browser.perform(get("/api/v1/auth/csrf").session(s)).andReturn().getResponse()
                .getCookie("XSRF-TOKEN");
        assertThat(fresh).isNotNull();
        assertThat(fresh.getValue()).isNotEqualTo(first.getValue());
        browser.perform(post("/api/v1/foods").session(s).cookie(fresh).header("X-XSRF-TOKEN", fresh.getValue())
                        .contentType(MediaType.APPLICATION_JSON).content(FOOD))
                .andExpect(status().isCreated());
    }
}
