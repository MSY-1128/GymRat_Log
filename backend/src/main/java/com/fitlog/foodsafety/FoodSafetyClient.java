package com.fitlog.foodsafety;

import com.fitlog.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

/**
 * 식품안전나라 오픈API로 바코드 → 제품을 찾는다.
 *
 * <ol>
 *   <li>C005 바코드연계제품정보(BAR_CD): 품목제조보고 제품, 약 26만 건</li>
 *   <li>I2570 유통바코드(BRCD_NO): C005에 없을 때</li>
 * </ol>
 *
 * <p>인증키가 URL 경로에 실리므로 요청 URL·원본 예외 메시지는 로그에 남기지 않는다.
 */
@Component
public class FoodSafetyClient {

    private static final Logger log = LoggerFactory.getLogger(FoodSafetyClient.class);
    /** 식품안전나라: INFO-000 정상, INFO-200 데이터 없음, INFO-100 인증키 오류 */
    private static final String OK = "INFO-000";
    private static final String NO_DATA = "INFO-200";
    private static final int ROWS = 5;

    private final RestClient http;
    private final FoodSafetyProperties props;
    private final JsonMapper json;

    @Autowired
    public FoodSafetyClient(FoodSafetyProperties props, JsonMapper json) {
        this(RestClient.builder().requestFactory(requestFactory(props)), props, json);
    }

    /** 테스트에서 MockRestServiceServer를 붙일 수 있도록 builder를 받는다. */
    FoodSafetyClient(RestClient.Builder builder, FoodSafetyProperties props, JsonMapper json) {
        this.http = builder.baseUrl(props.baseUrl()).build();
        this.props = props;
        this.json = json;
    }

    private static JdkClientHttpRequestFactory requestFactory(FoodSafetyProperties props) {
        HttpClient client = HttpClient.newBuilder().connectTimeout(props.connectTimeout()).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(props.readTimeout());
        return factory;
    }

    public boolean configured() {
        return props.configured();
    }

    /** @param barcode 숫자 8~14자리(호출 전에 검증) */
    public Optional<BarcodeProduct> findByBarcode(String barcode) {
        if (!props.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "FOODSAFETY_NOT_CONFIGURED",
                    "바코드 조회 키가 설정되지 않았어요. .env의 FOODSAFETY_API_KEY를 확인해 주세요.");
        }
        Optional<BarcodeProduct> found = fetch("C005", "BAR_CD", barcode)
                .map(rows -> product(barcode, rows, "PRDLST_NM", "BSSH_NM", "PRDLST_DCNM", "C005"));
        if (found.isPresent()) {
            return found;
        }
        return fetch("I2570", "BRCD_NO", barcode)
                .map(rows -> product(barcode, rows, "PRDT_NM", "CMPNY_NM", "PRDLST_NM", "I2570"));
    }

    /** 대표 행(보고번호가 있는 첫 행, 없으면 첫 행)의 이름 + 모든 행의 보고번호. */
    private static BarcodeProduct product(String barcode, List<Map<String, Object>> rows, String nameKey,
                                          String makerKey, String categoryKey, String source) {
        Map<String, Object> main = rows.stream().filter(r -> text(r.get("PRDLST_REPORT_NO")) != null).findFirst()
                .orElse(rows.getFirst());
        List<String> reportNos = rows.stream().map(r -> text(r.get("PRDLST_REPORT_NO")))
                .filter(java.util.Objects::nonNull).distinct().toList();
        return new BarcodeProduct(barcode, text(main.get(nameKey)), text(main.get(makerKey)),
                text(main.get(categoryKey)), reportNos.isEmpty() ? null : reportNos.getFirst(), reportNos, source);
    }

    /** 응답 행 목록. 데이터가 없으면 empty. */
    private Optional<List<Map<String, Object>>> fetch(String service, String field, String barcode) {
        String body;
        int status;
        try {
            Response res = http.get()
                    .uri(b -> b.path("/{key}/{service}/json/1/{rows}/{field}={barcode}")
                            .build(props.apiKey().strip(), service, ROWS, field, barcode))
                    .accept(MediaType.APPLICATION_JSON)
                    .exchange((req, r) -> new Response(r.getStatusCode().value(), readBody(r.getBody())));
            body = res.body();
            status = res.status();
        } catch (RestClientException e) {
            log.warn("FoodSafety {} request failed: {}", service, e.getClass().getSimpleName());
            throw unavailable();
        }

        Map<String, Object> root;
        try {
            root = asMap(json.readValue(body, Map.class));
        } catch (JacksonException e) {
            log.warn("FoodSafety {} non-JSON response: status={}", service, status);
            throw unavailable();
        }
        Map<String, Object> svc = root == null ? null : asMap(root.get(service));
        // 서비스명이 틀리는 등 일부 오류는 최상위에 RESULT만 온다
        Map<String, Object> holder = svc != null ? svc : root;
        Map<String, Object> result = holder == null ? null : asMap(holder.get("RESULT"));
        String code = result == null ? null : String.valueOf(result.get("CODE"));
        if (NO_DATA.equals(code)) {
            return Optional.empty();
        }
        if (!OK.equals(code) || status != 200 || svc == null) {
            log.warn("FoodSafety {} error: status={}, code={}, msg={}", service, status, code,
                    result == null ? null : result.get("MSG"));
            throw unavailable();
        }
        if (!(svc.get("row") instanceof List<?> rows) || rows.isEmpty()) {
            return Optional.empty();
        }
        List<Map<String, Object>> out = rows.stream().map(FoodSafetyClient::asMap)
                .filter(java.util.Objects::nonNull).toList();
        return out.isEmpty() ? Optional.empty() : Optional.of(out);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }

    private static String text(Object o) {
        if (o == null) {
            return null;
        }
        String s = String.valueOf(o).strip();
        return s.isEmpty() ? null : s;
    }

    private static String readBody(InputStream in) throws IOException {
        return in == null ? "" : new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }

    static ApiException unavailable() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "FOODSAFETY_UNAVAILABLE",
                "식품안전나라에서 바코드 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    private record Response(int status, String body) {
    }
}
