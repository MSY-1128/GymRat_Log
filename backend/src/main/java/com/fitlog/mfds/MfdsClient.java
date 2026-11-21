package com.fitlog.mfds;

import com.fitlog.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
 * data.go.kr 식약처 식품영양성분DB(FoodNtrCpntDbInfo03) 호출.
 *
 * <p>서비스키는 서버에만 두고 브라우저로 내보내지 않는다. 키가 URL 쿼리에 실리므로 요청 URL·원본 예외 메시지는 로그에 남기지 않는다.
 */
@Component
public class MfdsClient {

    private static final Logger log = LoggerFactory.getLogger(MfdsClient.class);
    private static final String OPERATION = "/getFoodNtrCpntDbInq03";
    /** data.go.kr: 00 정상, 03 데이터 없음 */
    private static final String OK = "00";
    private static final String NO_DATA = "03";

    private final RestClient http;
    private final MfdsProperties props;
    private final JsonMapper json;

    @Autowired
    public MfdsClient(MfdsProperties props, JsonMapper json) {
        this(RestClient.builder().requestFactory(requestFactory(props)), props, json);
    }

    /** 테스트에서 MockRestServiceServer를 붙일 수 있도록 builder를 받는다. */
    MfdsClient(RestClient.Builder builder, MfdsProperties props, JsonMapper json) {
        this.http = builder.baseUrl(props.baseUrl()).build();
        this.props = props;
        this.json = json;
    }

    private static JdkClientHttpRequestFactory requestFactory(MfdsProperties props) {
        HttpClient client = HttpClient.newBuilder().connectTimeout(props.connectTimeout()).build();
        JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(client);
        factory.setReadTimeout(props.readTimeout());
        return factory;
    }

    /**
     * 식품명(부분 일치)으로 검색한다.
     *
     * @param dbClassName 품목대표/상용제품, null이면 전체
     * @param pageNo      1부터
     */
    public MfdsSearchResult search(String foodName, String dbClassName, int pageNo, int numOfRows) {
        return search(new MfdsQuery(foodName, dbClassName, null, null), pageNo, numOfRows);
    }

    /** 검색 조건(식품명·구분·업체명·품목보고번호)으로 조회한다. null 조건은 보내지 않는다. */
    public MfdsSearchResult search(MfdsQuery query, int pageNo, int numOfRows) {
        if (!props.configured()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "MFDS_NOT_CONFIGURED",
                    "식약처 DB 연동 키가 설정되지 않았어요. .env의 MFDS_SERVICE_KEY를 확인해 주세요.");
        }
        Map<String, Object> vars = new HashMap<>();
        vars.put("serviceKey", props.serviceKey().strip());
        vars.put("pageNo", pageNo);
        vars.put("numOfRows", numOfRows);
        Map<String, String> filters = new LinkedHashMap<>();
        filters.put("FOOD_NM_KR", query.foodName());
        filters.put("DB_CLASS_NM", query.dbClassName());
        filters.put("MAKER_NM", query.makerName());
        filters.put("ITEM_REPORT_NO", query.itemReportNo());
        filters.forEach((k, v) -> {
            if (v != null) {
                vars.put(k, v);
            }
        });

        Response res;
        try {
            // URI 변수 값은 엄격하게 인코딩된다(키의 +, /, = 와 한글 포함). Decoding 키를 그대로 넘긴다.
            res = http.get()
                    .uri(b -> {
                        b.path(OPERATION)
                                .queryParam("serviceKey", "{serviceKey}")
                                .queryParam("type", "json")
                                .queryParam("pageNo", "{pageNo}")
                                .queryParam("numOfRows", "{numOfRows}");
                        filters.forEach((k, v) -> {
                            if (v != null) {
                                b.queryParam(k, "{" + k + "}");
                            }
                        });
                        return b.build(vars);
                    })
                    .accept(MediaType.APPLICATION_JSON)
                    .exchange((req, r) -> new Response(r.getStatusCode().value(), readBody(r.getBody())));
        } catch (RestClientException e) {
            // 원본 메시지에 키가 포함된 URL이 들어 있으므로 예외 종류만 남긴다.
            log.warn("MFDS request failed: {}", rootName(e));
            throw unavailable();
        }
        return parse(res);
    }

    private MfdsSearchResult parse(Response res) {
        Map<String, Object> root;
        try {
            root = asMap(json.readValue(res.body(), Map.class));
        } catch (JacksonException e) {
            log.warn("MFDS non-JSON response: status={}", res.status());
            throw unavailable();
        }
        if (root == null) {
            log.warn("MFDS empty response: status={}", res.status());
            throw unavailable();
        }
        Map<String, Object> header = asMap(root.get("header"));
        if (header == null) {
            // 인증 오류 등 게이트웨이 오류 형식: {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{...}}}
            Map<String, Object> gw = asMap(root.get("OpenAPI_ServiceResponse"));
            Map<String, Object> msg = gw == null ? null : asMap(gw.get("cmmMsgHeader"));
            log.warn("MFDS gateway error: status={}, errMsg={}, reasonCode={}", res.status(),
                    msg == null ? null : msg.get("errMsg"), msg == null ? null : msg.get("returnReasonCode"));
            throw unavailable();
        }
        String code = str(header.get("resultCode"));
        if (NO_DATA.equals(code)) {
            return MfdsSearchResult.empty();
        }
        if (!OK.equals(code) || res.status() != 200) {
            log.warn("MFDS error: status={}, resultCode={}, resultMsg={}", res.status(), code,
                    header.get("resultMsg"));
            throw unavailable();
        }
        Map<String, Object> body = asMap(root.get("body"));
        if (body == null) {
            return MfdsSearchResult.empty();
        }
        long total = parseLong(body.get("totalCount"));
        return new MfdsSearchResult(items(body.get("items")), total);
    }

    /** items는 배열, 단일 객체(1건), {item: [...]}(XML 변환형), 빈 문자열 중 하나로 올 수 있다. */
    private static List<Map<String, String>> items(Object raw) {
        List<Map<String, String>> out = new ArrayList<>();
        if (raw instanceof List<?> list) {
            for (Object o : list) {
                Map<String, Object> m = asMap(o);
                if (m != null) {
                    out.add(stringify(m));
                }
            }
        } else if (raw instanceof Map<?, ?> map) {
            Map<String, Object> m = asMap(map);
            if (m.containsKey("item")) {
                return items(m.get("item"));
            }
            out.add(stringify(m));
        }
        return out;
    }

    private static Map<String, String> stringify(Map<String, Object> m) {
        Map<String, String> out = new LinkedHashMap<>();
        m.forEach((k, v) -> out.put(k, v == null || v instanceof Map || v instanceof List ? null : String.valueOf(v)));
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> asMap(Object o) {
        return o instanceof Map<?, ?> m ? (Map<String, Object>) m : null;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o).strip();
    }

    private static long parseLong(Object o) {
        try {
            return o == null ? 0 : Long.parseLong(String.valueOf(o).strip().replace(",", ""));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static String readBody(InputStream in) throws IOException {
        return in == null ? "" : new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }

    private static String rootName(Throwable e) {
        Throwable t = e;
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
        }
        return e.getClass().getSimpleName() + (t == e ? "" : " <- " + t.getClass().getSimpleName());
    }

    static ApiException unavailable() {
        return new ApiException(HttpStatus.BAD_GATEWAY, "MFDS_UNAVAILABLE",
                "식약처 DB에서 정보를 가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
    }

    private record Response(int status, String body) {
    }
}
