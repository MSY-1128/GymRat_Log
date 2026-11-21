package com.fitlog.mfds;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** 식약처 DB 검색 결과에서 고른 식품코드(FOOD_CD). 영양값은 서버가 검색 결과에서 꺼낸다. */
public record ImportFoodRequest(
        @NotBlank(message = "식품코드가 필요합니다.")
        @Size(max = 50, message = "50자 이하여야 합니다.")
        String externalCode
) {
}
