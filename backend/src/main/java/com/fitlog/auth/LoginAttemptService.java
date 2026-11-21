package com.fitlog.auth;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * 아이디별 연속 로그인 실패를 세어 잠시 막는다(비밀번호 대입 방지). 서버 메모리에만 보관한다.
 * 5번 연속 실패하면 5분 동안 로그인할 수 없고, 성공하면 초기화된다.
 */
@Component
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration LOCK = Duration.ofMinutes(5);
    private static final int MAX_TRACKED = 10_000;

    private final Clock clock;
    private final Map<String, State> states = new ConcurrentHashMap<>();

    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public boolean isLocked(String username) {
        State s = states.get(key(username));
        return s != null && s.lockedUntil() != null && s.lockedUntil().isAfter(clock.instant());
    }

    public void failed(String username) {
        if (states.size() > MAX_TRACKED) {
            Instant now = clock.instant();
            states.values().removeIf(s -> s.lockedUntil() == null || !s.lockedUntil().isAfter(now));
        }
        states.compute(key(username), (k, s) -> {
            Instant now = clock.instant();
            // 잠금이 끝났으면 다시 0부터 센다
            int count = (s == null || (s.lockedUntil() != null && !s.lockedUntil().isAfter(now))) ? 1
                    : s.failures() + 1;
            return new State(count, count >= MAX_FAILURES ? now.plus(LOCK) : null);
        });
    }

    public void succeeded(String username) {
        states.remove(key(username));
    }

    private static String key(String username) {
        return username == null ? "" : username.strip().toLowerCase(Locale.ROOT);
    }

    private record State(int failures, Instant lockedUntil) {
    }
}
