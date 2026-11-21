package com.fitlog.foodsafety;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.ExpectedCount.never;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.fitlog.common.ApiException;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

/** 식품안전나라 응답 형식 처리. 응답 예시는 실제 API(2026-11) 응답을 줄인 것. */
class FoodSafetyClientTest {

    private static final String BASE = "https://openapi.example.test/api";
    private MockRestServiceServer server;

    private FoodSafetyClient client(String key) {
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        return new FoodSafetyClient(builder,
                new FoodSafetyProperties(key, BASE, Duration.ofSeconds(1), Duration.ofSeconds(1)),
                JsonMapper.builder().build());
    }

    private static String json(String s) {
        return s;
    }

    @Test
    void findsInC005AndPrefersRowWithReportNo() {
        FoodSafetyClient c = client("k3y/1");
        server.expect(requestTo(BASE + "/k3y%2F1/C005/json/1/5/BAR_CD=8805522061018"))
                .andRespond(withSuccess(json("""
                        {"C005":{"total_count":"2","row":[
                          {"PRDLST_REPORT_NO":"","PRDLST_NM":"옛 제품","BAR_CD":"8805522061018","BSSH_NM":"A"},
                          {"PRDLST_REPORT_NO":"19950129282236","PRDLST_NM":"좋은상품 유기농 부침가루",
                           "BAR_CD":"8805522061018","PRDLST_DCNM":"기타가공품","BSSH_NM":"사조동아원(주) 부산공장"}],
                         "RESULT":{"MSG":"정상처리되었습니다.","CODE":"INFO-000"}}}
                        """), MediaType.APPLICATION_JSON));

        Optional<BarcodeProduct> p = c.findByBarcode("8805522061018");

        assertThat(p).contains(new BarcodeProduct("8805522061018", "좋은상품 유기농 부침가루", "사조동아원(주) 부산공장",
                "기타가공품", "19950129282236", List.of("19950129282236"), "C005"));
        server.verify();
    }

    @Test
    void fallsBackToI2570WhenC005HasNoData() {
        FoodSafetyClient c = client("key");
        server.expect(requestTo(BASE + "/key/C005/json/1/5/BAR_CD=8809360172547"))
                .andRespond(withSuccess("""
                        {"C005":{"total_count":"0","RESULT":{"MSG":"해당하는 데이터가 없습니다.","CODE":"INFO-200"}}}
                        """, MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/key/I2570/json/1/5/BRCD_NO=8809360172547"))
                .andRespond(withSuccess("""
                        {"I2570":{"total_count":"1","row":[{"PRDLST_REPORT_NO":"201204020263","PRDLST_NM":"건어포",
                          "BRCD_NO":"8809360172547","PRDT_NM":"황금빛하늘내린황태포5미370g","CMPNY_NM":"용대황태"}],
                         "RESULT":{"MSG":"정상처리되었습니다.","CODE":"INFO-000"}}}
                        """, MediaType.APPLICATION_JSON));

        assertThat(c.findByBarcode("8809360172547")).hasValueSatisfying(p -> {
            assertThat(p.productName()).isEqualTo("황금빛하늘내린황태포5미370g");
            assertThat(p.reportNo()).isEqualTo("201204020263");
            assertThat(p.source()).isEqualTo("I2570");
        });
        server.verify();
    }

    @Test
    void emptyWhenNeitherServiceHasIt() {
        FoodSafetyClient c = client("key");
        String none = """
                {"%s":{"total_count":"0","RESULT":{"MSG":"해당하는 데이터가 없습니다.","CODE":"INFO-200"}}}
                """;
        server.expect(requestTo(BASE + "/key/C005/json/1/5/BAR_CD=00000000"))
                .andRespond(withSuccess(none.formatted("C005"), MediaType.APPLICATION_JSON));
        server.expect(requestTo(BASE + "/key/I2570/json/1/5/BRCD_NO=00000000"))
                .andRespond(withSuccess(none.formatted("I2570"), MediaType.APPLICATION_JSON));

        assertThat(c.findByBarcode("00000000")).isEmpty();
    }

    @Test
    void invalidKeyIsSafe502WithoutLeakingKey() {
        FoodSafetyClient c = client("secret-key");
        server.expect(requestTo(BASE + "/secret-key/C005/json/1/5/BAR_CD=8801043014809"))
                .andRespond(withSuccess("""
                        {"C005":{"total_count":"","RESULT":{"MSG":"인증키가 유효하지 않습니다.","CODE":"INFO-100"}}}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> c.findByBarcode("8801043014809")).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_GATEWAY);
            assertThat(e.getCode()).isEqualTo("FOODSAFETY_UNAVAILABLE");
            assertThat(e.getMessage()).doesNotContain("secret-key");
        });
    }

    @Test
    void notConfiguredIs503WithoutCalling() {
        FoodSafetyClient c = client(" ");
        server.expect(never(), requestTo(org.hamcrest.Matchers.any(String.class)));

        assertThatThrownBy(() -> c.findByBarcode("8801043014809")).isInstanceOfSatisfying(ApiException.class, e -> {
            assertThat(e.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
            assertThat(e.getCode()).isEqualTo("FOODSAFETY_NOT_CONFIGURED");
        });
        server.verify();
    }
}
