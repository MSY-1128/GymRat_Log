package com.fitlog.auth;

import com.fitlog.common.ApiException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    /** 가입을 한 번에 하나씩 처리하기 위한 PostgreSQL advisory lock 키 */
    private static final long SIGNUP_LOCK = 0x46_49_54_4C_4F_47L; // "FITLOG"
    /** bcrypt는 72바이트까지만 사용한다 */
    private static final int MAX_PASSWORD_BYTES = 72;

    private final AppUserRepository users;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;

    public AuthService(AppUserRepository users, PasswordEncoder encoder, JdbcTemplate jdbc) {
        this.users = users;
        this.encoder = encoder;
        this.jdbc = jdbc;
    }

    /**
     * 계정을 만든다. 처음 만들어지는 계정이면 로그인 도입 전에 쌓인 기록(주인 없는 프로필·식단·운동·직접 등록 음식)을 이어받는다.
     */
    @Transactional
    public AuthUser signup(AuthRequests.SignupRequest r) {
        String username = r.username().strip();
        String password = r.password();
        if (password.getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw ApiException.validation("password", "비밀번호가 너무 길어요. 한글은 24자 이하로 입력해 주세요.");
        }
        if (password.equalsIgnoreCase(username)) {
            throw ApiException.validation("password", "아이디와 다른 비밀번호를 사용해 주세요.");
        }

        // 트랜잭션이 끝날 때 풀린다. 동시에 들어온 "첫 가입"이 기존 기록을 나눠 갖지 않게 한다.
        jdbc.execute("SELECT pg_advisory_xact_lock(" + SIGNUP_LOCK + ")");
        if (users.existsByUsernameIgnoreCase(username)) {
            throw usernameTaken();
        }
        boolean first = users.count() == 0;
        AppUser user;
        try {
            user = users.saveAndFlush(new AppUser(username, encoder.encode(password)));
        } catch (DataIntegrityViolationException e) {
            throw usernameTaken();
        }
        if (first) {
            adoptLegacyData(user.getId());
        }
        return new AuthUser(user.getId(), user.getUsername(), null);
    }

    private void adoptLegacyData(Long userId) {
        int profiles = jdbc.update("UPDATE profile SET user_id = ? WHERE id = "
                + "(SELECT min(id) FROM profile WHERE user_id IS NULL)", userId);
        int meals = jdbc.update("UPDATE meal_entry SET user_id = ? WHERE user_id IS NULL", userId);
        int workouts = jdbc.update("UPDATE exercise_entry SET user_id = ? WHERE user_id IS NULL", userId);
        int foods = jdbc.update("UPDATE food SET owner_id = ? WHERE owner_id IS NULL AND source = 'USER'", userId);
        if (profiles + meals + workouts + foods > 0) {
            log.info("First account adopted legacy data: profile={}, meals={}, workouts={}, userFoods={}",
                    profiles, meals, workouts, foods);
        }
    }

    private static ApiException usernameTaken() {
        return new ApiException(HttpStatus.CONFLICT, "USERNAME_TAKEN", "이미 사용 중인 아이디예요.",
                Map.of("username", "이미 사용 중인 아이디예요."));
    }
}
