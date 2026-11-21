package com.fitlog.mfds;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fitlog.common.ApiException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** data.go.kr 응답 형식 처리. 응답 예시는 실제 API(2026-11) 응답 형태를 줄인 것. */
class MfdsClientTest {

    private static final String KEY = "ab+c/d==";

    private MockRestServiceServer server;

    private MfdsClient client(String key) {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        MfdsProperties props = new MfdsProperties(key, "https://apis.example.test/1471000/FoodNtrCpntDbInfo03",
                Duration.ofSeconds(1), Duration.ofSeconds(1));
        return new MfdsClient(builder, props, JsonMapper.builder().build());
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }

    @Test
    void parsesItemsAndEncodesKeyAndKoreanQuery() {
        MfdsClient c = client(KEY);
        server.expect(method(HttpMethod.GET))
                .andExpect(requestTo(allOf(
                        containsString("/FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03?"),
                        containsString("serviceKey=ab%2Bc%2Fd%3D%3D"),
                        containsString("type=json"),
                        containsString("pageNo=2"),
                        containsString("numOfRows=20"),
                        containsString("FOOD_NM_KR=" + enc("현미밥")),
                        containsString("DB_CLASS_NM=" + enc("품목대표")))))
                .andRespond(withSuccess("""
                        {"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},
                         "body":{"pageNo":2,"totalCount":288,"numOfRows":20,"items":[
                           {"FOOD_CD":"D101-050000000-0001","FOOD_NM_KR":"현미밥","SERVING_SIZE":"100g",
                            "AMT_NUM1":"172.000","AMT_NUM6":"38.90","AMT_NUM3":"3.10","AMT_NUM4":"0.47",
                            "Z10500":"230.000g","MAKER_NM":null},
                           {"FOOD_CD":"D401-050000000-0001","FOOD_NM_KR":"현미밥","SERVING_SIZE":"100mL",
                            "AMT_NUM1":120.0}
                         ]}}""", MediaType.APPLICATION_JSON));

        MfdsSearchResult r = c.search("현미밥", "품목대표", 2, 20);

        server.verify();
        assertThat(r.totalCount()).isEqualTo(288);
        assertThat(r.items()).hasSize(2);
        assertThat(r.items().get(0)).containsEntry("AMT_NUM1", "172.000").containsEntry("MAKER_NM", null);
        assertThat(r.items().get(1)).containsEntry("AMT_NUM1", "120.0");
    }

    @Test
    void singleItemObjectAndNoClassFilter() {
        MfdsClient c = client(KEY);
        server.expect(requestTo(not(containsString("DB_CLASS_NM"))))
                .andRespond(withSuccess("""
                        {"header":{"resultCode":"00"},"body":{"totalCount":"1","items":
                          {"FOOD_CD":"X","FOOD_NM_KR":"콜라"}}}""", MediaType.APPLICATION_JSON));

        MfdsSearchResult r = c.search("콜라", null, 1, 20);

        assertThat(r.items()).singleElement().satisfies(m -> assertThat(m).containsEntry("FOOD_CD", "X"));
        assertThat(r.totalCount()).isEqualTo(1);
    }

    @Test
    void emptyBodyAndNoDataCodeAreEmptyResults() {
        MfdsClient c = client(KEY);
        server.expect(requestTo(containsString("FOOD_NM_KR")))
                .andRespond(withSuccess("""
                        {"header":{"resultCode":"00","resultMsg":"NORMAL SERVICE."},
                         "body":{"pageNo":1,"totalCount":0,"numOfRows":3}}""", MediaType.APPLICATION_JSON));
        assertThat(c.search("없는음식", null, 1, 3).items()).isEmpty();

        MfdsClient c2 = client(KEY);
        server.expect(requestTo(containsString("FOOD_NM_KR")))
                .andRespond(withSuccess("{\"header\":{\"resultCode\":\"03\",\"resultMsg\":\"NODATA_ERROR\"}}",
                        MediaType.APPLICATION_JSON));
        assertThat(c2.search("없는음식", null, 1, 3).totalCount()).isZero();
    }

    @Test
    void gatewayAuthErrorBecomesSafe502() {
        MfdsClient c = client(KEY);
        server.expect(requestTo(containsString("serviceKey")))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED).contentType(MediaType.APPLICATION_JSON).body("""
                        {"OpenAPI_ServiceResponse":{"cmmMsgHeader":{"errMsg":"SERVICE_KEY_IS_NOT_REGISTERED_ERROR",
                         "returnAuthMsg":"서비스 접근거부","returnReasonCode":"30"}}}"""));

        assertThatThrownBy(() -> c.search("현미밥", null, 1, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
                    assertThat(e.getCode()).isEqualTo("MFDS_UNAVAILABLE");
                    assertThat(e.getMessage()).doesNotContain(KEY).doesNotContain("SERVICE_KEY");
                });
    }

    @Test
    void errorResultCodeAndNonJsonAreUnavailable() {
        MfdsClient c = client(KEY);
        server.expect(requestTo(containsString("serviceKey")))
                .andRespond(withSuccess("{\"header\":{\"resultCode\":\"22\",\"resultMsg\":\"LIMITED\"}}",
                        MediaType.APPLICATION_JSON));
        assertThatThrownBy(() -> c.search("a", null, 1, 1)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("MFDS_UNAVAILABLE"));

        MfdsClient c2 = client(KEY);
        server.expect(requestTo(containsString("serviceKey")))
                .andRespond(withSuccess("<OpenAPI_ServiceResponse><cmmMsgHeader/></OpenAPI_ServiceResponse>",
                        MediaType.APPLICATION_XML));
        assertThatThrownBy(() -> c2.search("a", null, 1, 1)).isInstanceOfSatisfying(ApiException.class,
                e -> assertThat(e.getCode()).isEqualTo("MFDS_UNAVAILABLE"));
    }

    @Test
    void missingKeyFailsWithoutCallingApi() {
        MfdsClient c = client("  ");

        assertThatThrownBy(() -> c.search("현미밥", null, 1, 20))
                .isInstanceOfSatisfying(ApiException.class, e -> {
                    assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(e.getCode()).isEqualTo("MFDS_NOT_CONFIGURED");
                });
        server.verify(); // 기대 요청 없음 = 호출하지 않았음
    }
}
