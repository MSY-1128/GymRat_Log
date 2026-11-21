package com.fitlog.mfds;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.nullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fitlog.TestUsers;
import com.fitlog.TestcontainersConfiguration;
import com.fitlog.foodsafety.BarcodeProduct;
import com.fitlog.foodsafety.FoodSafetyClient;
import com.fitlog.foodsafety.FoodSafetyTestErrors;
import com.jayway.jsonpath.JsonPath;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.context.WebApplicationContext;
import org.springframework.test.web.servlet.ResultActions;

/** 식약처 검색·가져오기 API + 실제 PostgreSQL(V2 마이그레이션). 외부 API는 MfdsClient를 대체한다. */
@SpringBootTest
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class MfdsIntegrationTest {

    @Autowired
    WebApplicationContext ctx;

    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @MockitoBean
    MfdsClient client;

    @MockitoBean
    FoodSafetyClient foodSafety;

    @BeforeEach
    void clean() {
        jdbc.execute("TRUNCATE meal_entry, exercise_entry, food, exercise, profile, seed_history, app_user "
                + "RESTART IDENTITY CASCADE");
        mvc = TestUsers.mvcAs(ctx, TestUsers.create(jdbc, "tester"));
    }

    private static Map<String, String> row(String code, String name, String basis, String kcal, String carbs,
                                           String protein, String fat, String weight) {
        Map<String, String> m = new HashMap<>();
        m.put("FOOD_CD", code);
        m.put("FOOD_NM_KR", name);
        m.put("SERVING_SIZE", basis);
        m.put("AMT_NUM1", kcal);
        m.put("AMT_NUM6", carbs);
        m.put("AMT_NUM3", protein);
        m.put("AMT_NUM4", fat);
        m.put("Z10500", weight);
        m.put("DB_CLASS_NM", "품목대표");
        return m;
    }

    private void stubSearch(String q, String dbClass, List<Map<String, String>> rows, long total) {
        when(client.search(argThat((MfdsQuery mq) -> mq != null && Objects.equals(q, mq.foodName())
                && Objects.equals(dbClass, mq.dbClassName())), anyInt(), anyInt()))
                .thenReturn(new MfdsSearchResult(rows, total));
    }

    private static Map<String, String> brand(Map<String, String> row, String group, String maker, String reportNo) {
        row.put("DB_GRP_NM", group);
        row.put("DB_CLASS_NM", "상용제품");
        row.put("MAKER_NM", maker);
        row.put("ITEM_REPORT_NO", reportNo);
        return row;
    }

    @Test
    void restaurantMenusByBrand() throws Exception {
        when(client.search(argThat((MfdsQuery mq) -> mq != null && mq.foodName() == null
                && "맥도날드".equals(mq.makerName()) && "상용제품".equals(mq.dbClassName())), anyInt(), anyInt()))
                .thenReturn(new MfdsSearchResult(List.of(brand(
                        row("D202-091000000-0056", "버거_빅맥 버거", "100g", "245.000", "20.1", "12.3", "12.9", "213g"),
                        "음식", "맥도날드", null)), 1));

        // 검색어 없이 브랜드만으로도 검색된다
        mvc.perform(get("/api/v1/foods/external").param("maker", " 맥도날드 ").param("kind", "BRAND"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].name").value("버거_빅맥 버거 (맥도날드)"))
                .andExpect(jsonPath("$.items[0].restaurant").value(true))
                .andExpect(jsonPath("$.items[0].dbGroupName").value("음식"));
        mvc.perform(get("/api/v1/foods/external").param("maker", "가".repeat(31)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void barcodeLinksByReportNoThenImports() throws Exception {
        // 공장별 보고번호가 여러 개: 첫 번호는 영양성분DB에 없고 두 번째가 연결된다
        when(foodSafety.findByBarcode("8801043014809")).thenReturn(Optional.of(new BarcodeProduct(
                "8801043014809", "신라면건면사발", "(주)농심", "유탕면", "1972015400113",
                List.of("1972015400113", "2007014900270"), "C005")));
        // 원본 검색은 부분 일치라 번호가 앞부분만 같은 다른 제품이 온다 → 걸러낸다
        when(client.search(argThat((MfdsQuery mq) -> mq != null && "1972015400113".equals(mq.itemReportNo())),
                anyInt(), anyInt()))
                .thenReturn(new MfdsSearchResult(List.of(
                        brand(row("P-HONEY", "꿀꽈배기", "100g", "500", "70", "5", "20", "90g"),
                                "가공식품", "(주)농심", "19720154001137")), 1));
        when(client.search(argThat((MfdsQuery mq) -> mq != null && "2007014900270".equals(mq.itemReportNo())),
                anyInt(), anyInt()))
                .thenReturn(new MfdsSearchResult(List.of(
                        // 한 항목에 보고번호가 "a/b"로 여러 개 들어 있다
                        brand(row("P108-001000300-0738", "신라면건면사발", "100g", "330", "60", "8", "5", "77g"),
                                "가공식품", "(주)농심", "19760342001242/2007014900270"),
                        brand(row("P999-OTHER", "다른제품", "100g", "100", "1", "1", "1", ""),
                                "가공식품", "기타", "20070149002701")), 2));

        mvc.perform(get("/api/v1/foods/barcode/8801043014809"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.match").value("REPORT_NO"))
                .andExpect(jsonPath("$.product.productName").value("신라면건면사발"))
                .andExpect(jsonPath("$.items", hasSize(1)))
                .andExpect(jsonPath("$.items[0].externalCode").value("P108-001000300-0738"))
                .andExpect(jsonPath("$.items[0].restaurant").value(false))
                .andExpect(jsonPath("$.items[0].servingGrams").value(77.0));

        postJson("/api/v1/foods/import", "{\"externalCode\":\"P108-001000300-0738\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("MFDS"))
                .andExpect(jsonPath("$.kcal").value(330.0));
    }

    @Test
    void barcodeFallsBackToNameSearch() throws Exception {
        when(foodSafety.findByBarcode("8809360172547")).thenReturn(Optional.of(new BarcodeProduct(
                "8809360172547", "황금빛하늘내린황태포5미370g", "용대황태", "건포류", "201204020263",
                List.of("201204020263"), "I2570")));
        when(client.search(argThat((MfdsQuery mq) -> mq != null && mq.itemReportNo() != null), anyInt(), anyInt()))
                .thenReturn(MfdsSearchResult.empty());
        when(client.search(argThat((MfdsQuery mq) -> mq != null && "황금빛하늘내린황태포".equals(mq.foodName())
                && "상용제품".equals(mq.dbClassName())), anyInt(), anyInt()))
                .thenReturn(new MfdsSearchResult(List.of(brand(
                        row("P1-HWANGTAE", "황금빛하늘내린황태포", "100g", "350", "1", "80", "2", "50g"),
                        "가공식품", "용대황태", "999")), 1));

        mvc.perform(get("/api/v1/foods/barcode/8809360172547"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.match").value("NAME"))
                .andExpect(jsonPath("$.items[0].externalCode").value("P1-HWANGTAE"));
    }

    @Test
    void barcodeNotFoundAndValidation() throws Exception {
        when(foodSafety.findByBarcode("0000000000000")).thenReturn(Optional.empty());
        mvc.perform(get("/api/v1/foods/barcode/0000000000000"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.match").value("NOT_FOUND"))
                .andExpect(jsonPath("$.product").value(nullValue()))
                .andExpect(jsonPath("$.items", hasSize(0)));

        mvc.perform(get("/api/v1/foods/barcode/12ab5678")).andExpect(status().isBadRequest());
        mvc.perform(get("/api/v1/foods/barcode/1234567")).andExpect(status().isBadRequest());

        when(foodSafety.findByBarcode("88010430148")).thenThrow(FoodSafetyTestErrors.unavailable());
        mvc.perform(get("/api/v1/foods/barcode/88010430148"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("FOODSAFETY_UNAVAILABLE"))
                .andExpect(content().string(not(containsString("Exception"))));
    }

    private ResultActions postJson(String url, String body) throws Exception {
        return mvc.perform(post(url).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void searchNormalizesRanksAndImportsOnce() throws Exception {
        stubSearch("현미밥", "품목대표", List.of(
                row("D501-072000000-0001", "순 현미밥", "100mL", "129.000", "27.59", "2.60", "0.72", "250.000mL"),
                row("D101-050000000-0001", "현미밥", "100g", "172.000", "38.90", "3.10", "0.47", "230.000g"),
                row("BAD", "현미밥_오류", "100g", "", "1", "1", "1", "")), 288);

        mvc.perform(get("/api/v1/foods/external").param("q", " 현미밥 ").param("kind", "GENERIC"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalElements").value(288))
                .andExpect(jsonPath("$.excluded").value(1))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].externalCode").value("D101-050000000-0001")) // 정확히 일치가 먼저
                .andExpect(jsonPath("$.items[0].kcal").value(172.0))
                .andExpect(jsonPath("$.items[0].servingGrams").value(230.0))
                .andExpect(jsonPath("$.items[0].importedFoodId").value(nullValue()))
                .andExpect(jsonPath("$.items[1].volumeBased").value(true))
                .andExpect(jsonPath("$.items[1].basisLabel").value("100mL"));

        String body = postJson("/api/v1/foods/import", "{\"externalCode\":\"D501-072000000-0001\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("순 현미밥"))
                .andExpect(jsonPath("$.source").value("MFDS"))
                .andExpect(jsonPath("$.volumeBased").value(true))
                .andExpect(jsonPath("$.kcal").value(129.0))
                .andExpect(jsonPath("$.servingGrams").value(250.0))
                .andReturn().getResponse().getContentAsString();
        int foodId = JsonPath.read(body, "$.id");

        // 두 번 가져와도 같은 음식
        postJson("/api/v1/foods/import", "{\"externalCode\":\"D501-072000000-0001\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(foodId));
        org.assertj.core.api.Assertions.assertThat(
                jdbc.queryForObject("SELECT count(*) FROM food WHERE source = 'MFDS'", Integer.class)).isEqualTo(1);

        // 다시 검색하면 이미 가져온 항목에 FitLog 음식 ID가 붙는다
        mvc.perform(get("/api/v1/foods/external").param("q", "현미밥"))
                .andExpect(jsonPath("$.items[1].importedFoodId").value(foodId));

        // 내 음식 검색과 식단 계산에 그대로 쓰인다(1mL ≈ 1g 근사: 200g → 258 kcal)
        mvc.perform(get("/api/v1/foods").param("q", "순 현미"))
                .andExpect(jsonPath("$.items[0].source").value("MFDS"))
                .andExpect(jsonPath("$.items[0].volumeBased").value(true));
        postJson("/api/v1/meals", "{\"date\":\"2026-11-21\",\"mealType\":\"LUNCH\",\"foodId\":" + foodId
                + ",\"grams\":200}")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.calculatedKcal").value(258.0));
    }

    @Test
    void importWithoutRecentSearchIsRejected() throws Exception {
        postJson("/api/v1/foods/import", "{\"externalCode\":\"NEVER-SEARCHED\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("MFDS_SEARCH_EXPIRED"));
        postJson("/api/v1/foods/import", "{\"externalCode\":\" \"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.externalCode").exists());
    }

    @Test
    void validatesQueryAndKind() throws Exception {
        mvc.perform(get("/api/v1/foods/external").param("q", "  "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.q").exists());
        mvc.perform(get("/api/v1/foods/external").param("q", "밥").param("kind", "NOPE"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors.kind").exists());
        mvc.perform(get("/api/v1/foods/external").param("q", "가".repeat(51)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void upstreamFailureIsSafe502() throws Exception {
        when(client.search(any(MfdsQuery.class), anyInt(), anyInt())).thenThrow(MfdsClient.unavailable());

        mvc.perform(get("/api/v1/foods/external").param("q", "콜라").param("kind", "ALL"))
                .andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("MFDS_UNAVAILABLE"))
                .andExpect(content().string(not(containsString("Exception"))));
    }

    @Test
    void sourceAndExternalCodeMustAgreeInDb() {
        org.assertj.core.api.Assertions.assertThatThrownBy(() -> jdbc.update(
                "INSERT INTO food (name, kcal, carbs_g, protein_g, fat_g, source, created_at, updated_at) "
                        + "VALUES ('x', 1, 1, 1, 1, 'MFDS', now(), now())"))
                .isInstanceOf(org.springframework.dao.DataIntegrityViolationException.class);
    }
}
