package com.fitlog.mfds;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Component;

/**
 * 최근 검색 결과(정규화된 후보)를 잠시 보관한다.
 *
 * <p>가져오기 요청은 식품코드만 받고 영양값은 여기서 꺼낸다. 브라우저가 보낸 영양값을 신뢰하지 않기 위해서이며,
 * 식약처 API에는 식품코드로 단건 조회하는 파라미터가 없다.
 */
@Component
public class MfdsCandidateCache {

    static final int MAX_ENTRIES = 1000;
    static final Duration TTL = Duration.ofHours(2);

    private final Clock clock;
    private final Map<String, Entry> entries = new LinkedHashMap<>(256, 0.75f, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, Entry> eldest) {
            return size() > MAX_ENTRIES;
        }
    };

    public MfdsCandidateCache() {
        this(Clock.systemUTC());
    }

    MfdsCandidateCache(Clock clock) {
        this.clock = clock;
    }

    public synchronized void putAll(Collection<MfdsFoodCandidate> candidates) {
        Instant now = clock.instant();
        candidates.forEach(c -> entries.put(c.externalCode(), new Entry(c, now)));
    }

    public synchronized Optional<MfdsFoodCandidate> get(String externalCode) {
        Entry e = entries.get(externalCode);
        if (e == null) {
            return Optional.empty();
        }
        if (e.storedAt().plus(TTL).isBefore(clock.instant())) {
            entries.remove(externalCode);
            return Optional.empty();
        }
        return Optional.of(e.candidate());
    }

    private record Entry(MfdsFoodCandidate candidate, Instant storedAt) {
    }
}
