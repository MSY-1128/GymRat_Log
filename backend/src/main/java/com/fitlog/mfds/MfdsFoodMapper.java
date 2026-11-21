package com.fitlog.mfds;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 식약처 원본 item → FitLog 100g 기준 후보 변환.
 *
 * <ul>
 *   <li>값은 문자열로 오며 쉼표("1,010.000"), 빈 값, "N/A"가 섞여 있다.</li>
 *   <li>영양성분은 SERVING_SIZE(예: 100g, 100mL, 30g) 기준이다. 100g 기준으로 환산하고, mL은 1mL ≈ 1g으로 근사한다.</li>
 *   <li>에너지(AMT_NUM1)가 없거나 값이 범위를 벗어나면(데이터 오류) 후보에서 제외한다.</li>
 *   <li>탄수화물·단백질·지방이 비어 있으면 0으로 두고 missingNutrients로 알린다.</li>
 * </ul>
 */
public final class MfdsFoodMapper {

    static final String ENERGY = "AMT_NUM1";
    static final String PROTEIN = "AMT_NUM3";
    static final String FAT = "AMT_NUM4";
    static final String CARBS = "AMT_NUM6";

    private static final Pattern AMOUNT = Pattern.compile("^([0-9][0-9,]*(?:\\.[0-9]+)?)\\s*(g|ml)$",
            Pattern.CASE_INSENSITIVE);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);
    private static final BigDecimal MAX_KCAL = BigDecimal.valueOf(900);
    private static final BigDecimal MAX_SERVING = BigDecimal.valueOf(5000);
    private static final int NAME_MAX = 100;

    private MfdsFoodMapper() {
    }

    /** 변환 결과. excluded는 데이터 부족·오류로 제외한 건수. */
    public record Result(List<MfdsFoodCandidate> candidates, int excluded) {
    }

    public static Result mapAll(List<Map<String, String>> items) {
        List<MfdsFoodCandidate> out = new ArrayList<>();
        int excluded = 0;
        for (Map<String, String> item : items) {
            Optional<MfdsFoodCandidate> c = map(item);
            if (c.isPresent()) {
                out.add(c.get());
            } else {
                excluded++;
            }
        }
        return new Result(out, excluded);
    }

    public static Optional<MfdsFoodCandidate> map(Map<String, String> item) {
        String code = text(item.get("FOOD_CD"));
        String foodName = text(item.get("FOOD_NM_KR"));
        if (code == null || foodName == null || code.length() > 50) {
            return Optional.empty();
        }
        Amount basis = amount(item.get("SERVING_SIZE")).orElse(null);
        if (basis == null || basis.value().signum() <= 0) {
            return Optional.empty();
        }

        Nutrient kcal = nutrient(item.get(ENERGY));
        if (kcal.invalid() || kcal.value() == null) {
            return Optional.empty();
        }
        Nutrient carbs = nutrient(item.get(CARBS));
        Nutrient protein = nutrient(item.get(PROTEIN));
        Nutrient fat = nutrient(item.get(FAT));
        if (carbs.invalid() || protein.invalid() || fat.invalid()) {
            return Optional.empty();
        }

        BigDecimal kcal100 = per100(kcal.value(), basis.value());
        BigDecimal carbs100 = per100(orZero(carbs.value()), basis.value());
        BigDecimal protein100 = per100(orZero(protein.value()), basis.value());
        BigDecimal fat100 = per100(orZero(fat.value()), basis.value());
        // FitLog 사용자 등록과 같은 상한(100g 기준). 넘으면 원본 데이터 오류로 본다.
        if (kcal100.compareTo(MAX_KCAL) > 0 || carbs100.compareTo(HUNDRED) > 0
                || protein100.compareTo(HUNDRED) > 0 || fat100.compareTo(HUNDRED) > 0) {
            return Optional.empty();
        }

        List<String> missing = new ArrayList<>();
        if (carbs.value() == null) {
            missing.add("carbsG");
        }
        if (protein.value() == null) {
            missing.add("proteinG");
        }
        if (fat.value() == null) {
            missing.add("fatG");
        }

        String maker = text(item.get("MAKER_NM"));
        return Optional.of(new MfdsFoodCandidate(
                code,
                displayName(foodName, maker),
                foodName,
                maker,
                text(item.get("DB_GRP_NM")),
                text(item.get("DB_CLASS_NM")),
                text(item.get("FOOD_CAT1_NM")),
                kcal100,
                carbs100,
                protein100,
                fat100,
                servingGrams(item),
                basis.label(),
                basis.volume(),
                List.copyOf(missing),
                text(item.get("ITEM_REPORT_NO"))));
    }

    /**
     * 같은 페이지 안에서 검색어와 가까운 이름을 위로 올린다(원본 API는 부분 일치만 하고 관련도 정렬이 없다).
     * 정확히 일치 → 앞부분 일치 → 단어(_, 공백, 괄호 구분) 일치 → 단어 앞부분 일치 → 그 외.
     * 같은 순위면 근사가 필요 없는 g 기준을 mL 기준보다 먼저, 그다음은 원본 순서 유지.
     */
    public static List<MfdsFoodCandidate> rank(String keyword, List<MfdsFoodCandidate> candidates) {
        String k = keyword.strip().toLowerCase(Locale.ROOT);
        List<MfdsFoodCandidate> sorted = new ArrayList<>(candidates);
        sorted.sort(Comparator.<MfdsFoodCandidate>comparingInt(c -> score(k, c.foodName()))
                .thenComparing(MfdsFoodCandidate::volumeBased));
        return sorted;
    }

    static int score(String keyword, String foodName) {
        String n = foodName.toLowerCase(Locale.ROOT);
        if (n.equals(keyword)) {
            return 0;
        }
        if (n.startsWith(keyword)) {
            return 1;
        }
        String[] tokens = n.split("[_\\s()\\[\\],/]+");
        for (String t : tokens) {
            if (t.equals(keyword)) {
                return 2;
            }
        }
        for (String t : tokens) {
            if (t.startsWith(keyword)) {
                return 3;
            }
        }
        return 4;
    }

    // ---------- 내부 ----------

    private static String displayName(String foodName, String maker) {
        String name = maker == null ? foodName : foodName + " (" + maker + ")";
        if (name.length() <= NAME_MAX) {
            return name;
        }
        return foodName.length() <= NAME_MAX ? foodName : foodName.substring(0, NAME_MAX);
    }

    /** 1회 섭취참고량(NUTRI_AMOUNT_SERVING)을 우선, 없으면 식품 중량(Z10500). mL은 1mL ≈ 1g 근사. */
    private static BigDecimal servingGrams(Map<String, String> item) {
        for (String key : List.of("NUTRI_AMOUNT_SERVING", "Z10500")) {
            Optional<Amount> a = amount(item.get(key));
            if (a.isPresent()) {
                BigDecimal g = a.get().value().setScale(1, RoundingMode.HALF_UP);
                if (g.signum() > 0 && g.compareTo(MAX_SERVING) <= 0) {
                    return g;
                }
            }
        }
        return null;
    }

    private static BigDecimal per100(BigDecimal value, BigDecimal basis) {
        return value.multiply(HUNDRED).divide(basis, 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal orZero(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }

    private static String text(String s) {
        if (s == null) {
            return null;
        }
        String t = s.strip();
        return t.isEmpty() || t.equalsIgnoreCase("null") ? null : t;
    }

    private record Amount(BigDecimal value, boolean volume, String label) {
    }

    private static Optional<Amount> amount(String raw) {
        String t = text(raw);
        if (t == null) {
            return Optional.empty();
        }
        Matcher m = AMOUNT.matcher(t);
        if (!m.matches()) {
            return Optional.empty();
        }
        BigDecimal v = new BigDecimal(m.group(1).replace(",", ""));
        boolean volume = m.group(2).equalsIgnoreCase("ml");
        return Optional.of(new Amount(v, volume, v.stripTrailingZeros().toPlainString() + (volume ? "mL" : "g")));
    }

    /** value=null은 값 없음, invalid=true는 숫자가 아니거나 음수(데이터 오류). */
    private record Nutrient(BigDecimal value, boolean invalid) {
    }

    private static Nutrient nutrient(String raw) {
        String t = text(raw);
        if (t == null || t.equals("-") || t.equalsIgnoreCase("N/A")) {
            return new Nutrient(null, false);
        }
        try {
            BigDecimal v = new BigDecimal(t.replace(",", ""));
            return v.signum() < 0 ? new Nutrient(null, true) : new Nutrient(v, false);
        } catch (NumberFormatException e) {
            return new Nutrient(null, true);
        }
    }
}
