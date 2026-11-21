package com.fitlog.mfds;

import java.util.List;

/**
 * 식약처 DB 검색 한 페이지.
 *
 * @param totalElements 원본 기준 전체 건수(제외 건 포함)
 * @param excluded      이 페이지에서 데이터 부족·오류로 제외한 건수
 */
public record ExternalFoodPage(List<ExternalFoodResponse> items, int page, int size, long totalElements,
                               int excluded) {
}
