package com.fitlog.mfds;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/** 바코드 제품명 → 영양성분DB 이름 검색어(중량·수량·괄호 제거). */
class SearchableNameTest {

    @Test
    void stripsWeightCountAndBrackets() {
        assertThat(MfdsFoodService.searchableName("황금빛하늘내린황태포5미370g")).isEqualTo("황금빛하늘내린황태포");
        assertThat(MfdsFoodService.searchableName("코카콜라 1.5L")).isEqualTo("코카콜라");
        assertThat(MfdsFoodService.searchableName("[행사] 신라면(멀티팩) 120g x 5")).isEqualTo("신라면");
        assertThat(MfdsFoodService.searchableName("좋은상품 유기농 부침가루")).isEqualTo("좋은상품 유기농 부침가루");
    }

    @Test
    void tooShortOrMissingIsNull() {
        assertThat(MfdsFoodService.searchableName(null)).isNull();
        assertThat(MfdsFoodService.searchableName("500g")).isNull();
    }
}
