package com.fitlog.foodsafety;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 식품안전나라(foodsafetykorea.go.kr) 오픈API 설정. 바코드 → 제품(품목제조보고번호) 조회에 쓴다.
 *
 * @param apiKey 식품안전나라 인증키(환경변수 FOODSAFETY_API_KEY). 비어 있으면 바코드 조회만 비활성.
 */
@ConfigurationProperties("fitlog.foodsafety")
public record FoodSafetyProperties(
        String apiKey,
        @DefaultValue("https://openapi.foodsafetykorea.go.kr/api") String baseUrl,
        @DefaultValue("5s") Duration connectTimeout,
        @DefaultValue("10s") Duration readTimeout
) {

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank();
    }
}
