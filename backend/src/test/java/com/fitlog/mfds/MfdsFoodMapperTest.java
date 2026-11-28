package com.fitlog.mfds;

import static org.assertj.core.api.Assertions.assertThat;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** 식약처 원본 → 100g 기준 정규화 규칙. 값 형식은 실제 API 응답(2026-11)에서 관찰한 형태를 따른다. */
class MfdsFoodMapperTest {

    private static Map<String, String> item(String code, String name, String servingSize, String kcal,
                                            String carbs, String protein, String fat) {
        Map<String, String> m = new HashMap<>();
        m.put("FOOD_CD", code);
        m.put("FOOD_NM_KR", name);
        m.put("SERVING_SIZE", servingSize);
        m.put("AMT_NUM1", kcal);
        m.put("AMT_NUM6", carbs);
        m.put("AMT_NUM3", protein);
        m.put("AMT_NUM4", fat);
        m.put("DB_CLASS_NM", "품목대표");
        m.put("FOOD_CAT1_NM", "밥류");
        m.put("NUTRI_AMOUNT_SERVING", "");
        return m;
    }

    private static MfdsFoodCandidate mapOk(Map<String, String> m) {
        Optional<MfdsFoodCandidate> c = MfdsFoodMapper.map(m);
        assertThat(c).isPresent();
        return c.get();
    }

    @Test
    void gramBasisIsKeptAndServingComesFromFoodWeight() {
        Map<String, String> m = item("D101-050000000-0001", "현미밥", "100g", "172.000", "38.90", "3.10", "0.47");
        m.put("Z10500", "230.000g");

        MfdsFoodCandidate c = mapOk(m);

        assertThat(c.externalCode()).isEqualTo("D101-050000000-0001");
        assertThat(c.name()).isEqualTo("현미밥");
        assertThat(c.kcal()).isEqualByComparingTo("172");
        assertThat(c.carbsG()).isEqualByComparingTo("38.90");
        assertThat(c.proteinG()).isEqualByComparingTo("3.10");
        assertThat(c.fatG()).isEqualByComparingTo("0.47");
        assertThat(c.kcal().scale()).isEqualTo(2);
        assertThat(c.servingGrams()).isEqualByComparingTo("230.0");
        assertThat(c.basisLabel()).isEqualTo("100g");
        assertThat(c.volumeBased()).isFalse();
        assertThat(c.missingNutrients()).isEmpty();
    }

    @Test
    void sugarsSodiumAndSaturatedFatAreReadPer100g() {
        // 실제 응답(삼겹살구이 2026-11-28): AMT_NUM7 당류 g, AMT_NUM13 나트륨 mg, AMT_NUM24 포화지방 g
        Map<String, String> m = item("D108-382000000-0001", "삼겹살구이", "100g", "467.000", "0.35", "22.56", "41.69");
        m.put("AMT_NUM7", "0.00");
        m.put("AMT_NUM13", "576.000");
        m.put("AMT_NUM24", "12.42");

        MfdsFoodCandidate c = mapOk(m);

        assertThat(c.limits().sugarsG()).isEqualByComparingTo("0");
        assertThat(c.limits().sodiumMg()).isEqualByComparingTo("576");
        assertThat(c.limits().saturatedFatG()).isEqualByComparingTo("12.42");
    }

    @Test
    void limitNutrientsAreScaledAndUnknownStaysNull() {
        Map<String, String> m = item("P1", "음료", "200mL", "100", "20", "0", "0");
        m.put("AMT_NUM7", "18");
        m.put("AMT_NUM13", "1,200");

        MfdsFoodCandidate c = mapOk(m);

        assertThat(c.limits().sugarsG()).isEqualByComparingTo("9.00");
        assertThat(c.limits().sodiumMg()).isEqualByComparingTo("600.00");
        assertThat(c.limits().saturatedFatG()).isNull();
    }

    @Test
    void impossibleLimitNutrientsBecomeUnknownWithoutDroppingTheFood() {
        // 원본 오류 예: 포화지방이 지방보다 큼, 당류가 탄수화물보다 큼
        Map<String, String> m = item("P2", "달걀말이", "100g", "117", "6.33", "10.67", "5.33");
        m.put("AMT_NUM24", "265.000");
        m.put("AMT_NUM7", "9");
        m.put("AMT_NUM13", "N/A");

        MfdsFoodCandidate c = mapOk(m);

        assertThat(c.limits().saturatedFatG()).isNull();
        assertThat(c.limits().sugarsG()).isNull();
        assertThat(c.limits().sodiumMg()).isNull();
    }

    @Test
    void millilitreBasisIsApproximatedAsGrams() {
        Map<String, String> m = item("D401-050000000-0001", "현미밥", "100mL", "120.000", "25.75", "2.30", "0.38");
        m.put("Z10500", "300.000mL");

        MfdsFoodCandidate c = mapOk(m);

        assertThat(c.volumeBased()).isTrue();
        assertThat(c.basisLabel()).isEqualTo("100mL");
        assertThat(c.kcal()).isEqualByComparingTo("120");
        assertThat(c.servingGrams()).isEqualByComparingTo("300.0");
    }

    @Test
    void nonHundredBasisIsNormalizedToPer100() {
        MfdsFoodCandidate c = mapOk(item("P1", "과자", "30g", "150", "18", "1.5", "9"));

        assertThat(c.kcal()).isEqualByComparingTo("500.00");
        assertThat(c.carbsG()).isEqualByComparingTo("60.00");
        assertThat(c.proteinG()).isEqualByComparingTo("5.00");
        assertThat(c.fatG()).isEqualByComparingTo("30.00");
        assertThat(c.basisLabel()).isEqualTo("30g");
    }

    @Test
    void commaNumbersAndServingReferenceArePreferred() {
        Map<String, String> m = item("P2", "식빵", "100g", "265.000", "49.0", "8.5", "3.2");
        m.put("NUTRI_AMOUNT_SERVING", "35g");
        m.put("Z10500", "1,010.000g");

        assertThat(mapOk(m).servingGrams()).isEqualByComparingTo("35.0");

        m.put("NUTRI_AMOUNT_SERVING", "");
        assertThat(mapOk(m).servingGrams()).isEqualByComparingTo("1010.0");

        m.put("Z10500", "6,000g"); // 5000g 초과는 인분으로 쓰지 않는다
        assertThat(mapOk(m).servingGrams()).isNull();
    }

    @Test
    void missingMacrosBecomeZeroAndAreReported() {
        MfdsFoodCandidate c = mapOk(item("D202-086000000-0052", "마카롱_얼그레이 쇼콜라 마카롱", "100g", "500.000",
                "", "6.67", null));

        assertThat(c.carbsG()).isEqualByComparingTo("0");
        assertThat(c.fatG()).isEqualByComparingTo("0");
        assertThat(c.missingNutrients()).containsExactly("carbsG", "fatG");
    }

    @Test
    void makerIsAppendedToNameWithinLimit() {
        Map<String, String> m = item("P3", "커피_아메리카노", "100g", "3.00", "0.5", "0.2", "0");
        m.put("MAKER_NM", "카페봄봄");
        assertThat(mapOk(m).name()).isEqualTo("커피_아메리카노 (카페봄봄)");

        m.put("FOOD_NM_KR", "가".repeat(98));
        assertThat(mapOk(m).name()).isEqualTo("가".repeat(98)); // 업체명을 붙이면 100자 초과
        m.put("FOOD_NM_KR", "가".repeat(120));
        assertThat(mapOk(m).name()).hasSize(100);
    }

    @Test
    void unusableRowsAreExcluded() {
        List<Map<String, String>> rows = List.of(
                item("A", "에너지 없음", "100g", "", "1", "1", "1"),
                item("B", "N/A 에너지", "100g", "N/A", "1", "1", "1"),
                item("C", "음수", "100g", "100", "-1", "1", "1"),
                item("D", "숫자 아님", "100g", "abc", "1", "1", "1"),
                item("E", "기준량 없음", "", "100", "1", "1", "1"),
                item("F", "기준량 단위 모름", "1회", "100", "1", "1", "1"),
                item("G", "범위 초과", "100g", "1200", "1", "1", "1"),
                item("H", "지방 초과", "10g", "50", "1", "1", "20"),
                item("", "코드 없음", "100g", "100", "1", "1", "1"),
                item("OK", "정상", "100g", "100", "1", "1", "1"));

        MfdsFoodMapper.Result r = MfdsFoodMapper.mapAll(rows);

        assertThat(r.candidates()).extracting(MfdsFoodCandidate::externalCode).containsExactly("OK");
        assertThat(r.excluded()).isEqualTo(9);
    }

    @Test
    void rankPutsCloserNamesFirstAndKeepsOriginalOrderOtherwise() {
        List<MfdsFoodCandidate> list = List.of(
                mapOk(item("1", "도넛_베이크드 헤이즐넛 쇼콜라넛", "100g", "435", "1", "1", "1")),
                mapOk(item("2", "음료_콜라", "100mL", "40", "10", "0", "0")),
                mapOk(item("3", "마카롱_쇼콜라뚱카롱", "100g", "444", "1", "1", "1")),
                mapOk(item("4", "콜라_제로", "100mL", "0", "0", "0", "0")),
                mapOk(item("5", "콜라", "100mL", "42", "10.5", "0", "0")),
                mapOk(item("6", "탄산음료_콜라맛", "100mL", "40", "10", "0", "0")));

        assertThat(MfdsFoodMapper.rank(" 콜라 ", list)).extracting(MfdsFoodCandidate::externalCode)
                .containsExactly("5", "4", "2", "6", "1", "3");
    }

    @Test
    void gramBasisComesBeforeMillilitreWithinSameRank() {
        List<MfdsFoodCandidate> list = List.of(
                mapOk(item("ml1", "현미밥", "100mL", "120", "25", "2", "0.4")),
                mapOk(item("g1", "현미밥", "100g", "172", "38", "3", "0.5")),
                mapOk(item("ml2", "현미밥", "100mL", "118", "25", "2", "0.4")),
                mapOk(item("g2", "현미밥_쌀", "100g", "170", "38", "3", "0.5")));

        assertThat(MfdsFoodMapper.rank("현미밥", list)).extracting(MfdsFoodCandidate::externalCode)
                .containsExactly("g1", "ml1", "ml2", "g2");
    }

    @Test
    void scaleOfNormalizedValuesIsTwoDecimals() {
        MfdsFoodCandidate c = mapOk(item("X", "소스", "15g", "10", "1", "0.1", "0.05"));
        assertThat(c.kcal()).isEqualTo(new BigDecimal("66.67"));
        assertThat(c.fatG()).isEqualTo(new BigDecimal("0.33"));
    }
}
