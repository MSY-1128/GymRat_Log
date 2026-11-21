package com.fitlog;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.fitlog.auth.AuthUser;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

/** 통합 테스트용 로그인 사용자. */
public final class TestUsers {

    private TestUsers() {
    }

    /** app_user에 계정을 만든다(비밀번호 검증은 하지 않는 테스트용 해시). */
    public static AuthUser create(JdbcTemplate jdbc, String username) {
        Long id = jdbc.queryForObject("INSERT INTO app_user (username, password_hash, created_at, updated_at) "
                + "VALUES (?, '{noop}unused', now(), now()) RETURNING id", Long.class, username);
        return new AuthUser(id, username, null);
    }

    /** 모든 요청을 이 사용자로 로그인한 상태(+ 유효한 CSRF 토큰)로 보내는 MockMvc. */
    public static MockMvc mvcAs(WebApplicationContext ctx, AuthUser user) {
        return MockMvcBuilders.webAppContextSetup(ctx)
                .apply(springSecurity())
                .defaultRequest(get("/").with(user(user)).with(csrf()))
                .build();
    }
}
