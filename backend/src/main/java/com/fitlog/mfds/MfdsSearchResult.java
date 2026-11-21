package com.fitlog.mfds;

import java.util.List;
import java.util.Map;

/** 식약처 API 원본 응답 한 페이지. item 값은 모두 문자열(없으면 null). */
public record MfdsSearchResult(List<Map<String, String>> items, long totalCount) {

    public static MfdsSearchResult empty() {
        return new MfdsSearchResult(List.of(), 0);
    }
}
