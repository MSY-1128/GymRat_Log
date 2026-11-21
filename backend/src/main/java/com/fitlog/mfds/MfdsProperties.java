package com.fitlog.mfds;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * 식약처 식품영양성분DB(data.go.kr FoodNtrCpntDbInfo03) 연동 설정.
 *
 * @param serviceKey data.go.kr에서 발급받은 Decoding 키(환경변수 MFDS_SERVICE_KEY). 비어 있으면 연동 비활성.
 */
@ConfigurationProperties("fitlog.mfds")
public record MfdsProperties(
        String serviceKey,
        @DefaultValue("https://apis.data.go.kr/1471000/FoodNtrCpntDbInfo03") String baseUrl,
        @DefaultValue("5s") Duration connectTimeout,
        @DefaultValue("10s") Duration readTimeout
) {

    public boolean configured() {
        return serviceKey != null && !serviceKey.isBlank();
    }
}
