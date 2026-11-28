package com.fitlog.body;

import com.fitlog.common.SexForFormula;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * 체성분 판정 기준. 출처가 있는 기준만 쓴다.
 *
 * <ul>
 *   <li>체지방률: Gallagher D, et al. Healthy percentage body fat ranges: an approach for developing guidelines
 *       based on body mass index. Am J Clin Nutr. 2000;72:694–701. 나이·성별별 건강 범위(BMI 18.5·25·30에 대응)</li>
 *   <li>BMI: WHO Western Pacific Region. The Asia-Pacific perspective: redefining obesity and its treatment. 2000.
 *       정상 18.5~22.9, 과체중 23~24.9, 비만 25 이상</li>
 *   <li>체지방량지수(FMI): Kelly TL, Wilson KE, Heymsfield SB. Dual energy X-ray absorptiometry body composition
 *       reference values from NHANES. PLoS One. 2009;4(9):e7038</li>
 *   <li>복부지방률(허리-엉덩이 둘레비): WHO. Waist circumference and waist–hip ratio: report of a WHO expert
 *       consultation. 2008. 남 0.90·여 0.85 이상이면 대사 위험 증가</li>
 *   <li>사지근육지수(ASMI): Chen LK, et al. Asian Working Group for Sarcopenia: 2019 consensus update. J Am Med Dir
 *       Assoc. 2020;21:300–307. 생체전기저항법 기준 남 7.0·여 5.7kg/m² 미만이면 근육량 낮음</li>
 *   <li>내장지방 레벨·세포외수분비: 국제 기준이 없어 인바디(제조사) 기준을 쓰고 그렇게 표시한다</li>
 * </ul>
 */
public final class BodyStandards {

    private BodyStandards() {
    }

    public enum Level { LOW, NORMAL, HIGH, VERY_HIGH }

    /**
     * 판정 결과.
     *
     * @param normalLow  정상 범위 아래 끝(없으면 null)
     * @param normalHigh 정상 범위 위 끝(없으면 null)
     */
    public record Judgement(Level level, String label, BigDecimal normalLow, BigDecimal normalHigh, String basis) {
    }

    static final String GALLAGHER = "Gallagher 외 2000 (AJCN) 나이·성별 건강 범위";
    static final String WHO_ASIA_BMI = "WHO 아시아·태평양 기준 (2000)";
    static final String KELLY = "Kelly 외 2009 (NHANES) 체지방량지수 기준";
    static final String WHO_WHR = "WHO 전문가 협의 (2008)";
    static final String AWGS = "아시아 근감소증 연구그룹(AWGS) 2019";
    static final String INBODY = "인바디 제조사 기준(국제 기준 없음)";

    /** Gallagher 2000: {건강 범위 아래 끝, 위 끝, 비만 시작}. 20~39세, 40~59세, 60~79세. */
    private static final int[][] FAT_MALE = {{8, 20, 25}, {11, 22, 28}, {13, 25, 30}};
    private static final int[][] FAT_FEMALE = {{21, 33, 39}, {23, 34, 40}, {24, 36, 42}};

    /** 체지방률. 18세 미만이나 성별을 모르면 null(이 기준은 성인용). 80세 이상은 60~79세 기준. */
    public static Judgement bodyFatPct(SexForFormula sex, Integer age, BigDecimal pct) {
        if (sex == null || age == null || age < 18 || pct == null) {
            return null;
        }
        int[] r = (sex == SexForFormula.MALE ? FAT_MALE : FAT_FEMALE)[age < 40 ? 0 : age < 60 ? 1 : 2];
        double v = pct.doubleValue();
        Level level = v < r[0] ? Level.LOW : v <= r[1] ? Level.NORMAL : v < r[2] ? Level.HIGH : Level.VERY_HIGH;
        String label = switch (level) {
            case LOW -> "체지방 부족";
            case NORMAL -> "건강 범위";
            case HIGH -> "과체지방";
            case VERY_HIGH -> "비만";
        };
        return new Judgement(level, label, BigDecimal.valueOf(r[0]), BigDecimal.valueOf(r[1]), GALLAGHER);
    }

    public static Judgement bmi(BigDecimal bmi) {
        if (bmi == null) {
            return null;
        }
        double v = bmi.doubleValue();
        Level level = v < 18.5 ? Level.LOW : v < 23 ? Level.NORMAL : v < 25 ? Level.HIGH : Level.VERY_HIGH;
        String label = switch (level) {
            case LOW -> "저체중";
            case NORMAL -> "정상";
            case HIGH -> "과체중";
            case VERY_HIGH -> "비만";
        };
        return new Judgement(level, label, new BigDecimal("18.5"), new BigDecimal("22.9"), WHO_ASIA_BMI);
    }

    public static Judgement fatMassIndex(SexForFormula sex, BigDecimal fmi) {
        if (sex == null || fmi == null) {
            return null;
        }
        boolean male = sex == SexForFormula.MALE;
        double lo = male ? 3 : 5;
        double hi = male ? 6 : 9;
        double obese = male ? 9 : 13;
        double v = fmi.doubleValue();
        Level level = v < lo ? Level.LOW : v <= hi ? Level.NORMAL : v <= obese ? Level.HIGH : Level.VERY_HIGH;
        String label = switch (level) {
            case LOW -> "체지방 부족";
            case NORMAL -> "정상";
            case HIGH -> "체지방 과다";
            case VERY_HIGH -> "비만";
        };
        return new Judgement(level, label, BigDecimal.valueOf(lo), BigDecimal.valueOf(hi), KELLY);
    }

    public static Judgement waistHipRatio(SexForFormula sex, BigDecimal whr) {
        if (sex == null || whr == null) {
            return null;
        }
        BigDecimal cut = sex == SexForFormula.MALE ? new BigDecimal("0.90") : new BigDecimal("0.85");
        boolean high = whr.compareTo(cut) >= 0;
        return new Judgement(high ? Level.HIGH : Level.NORMAL, high ? "복부비만 위험" : "정상", null,
                cut.subtract(new BigDecimal("0.01")), WHO_WHR);
    }

    public static Judgement appendicularMuscleIndex(SexForFormula sex, BigDecimal asmi) {
        if (sex == null || asmi == null) {
            return null;
        }
        BigDecimal cut = sex == SexForFormula.MALE ? new BigDecimal("7.0") : new BigDecimal("5.7");
        boolean low = asmi.compareTo(cut) < 0;
        return new Judgement(low ? Level.LOW : Level.NORMAL, low ? "근육량 낮음" : "정상", cut, null, AWGS);
    }

    public static Judgement visceralFatLevel(Integer level) {
        if (level == null) {
            return null;
        }
        boolean high = level >= 10;
        return new Judgement(high ? Level.HIGH : Level.NORMAL, high ? "높음" : "정상", BigDecimal.ONE,
                BigDecimal.valueOf(9), INBODY);
    }

    public static Judgement ecwRatio(BigDecimal ratio) {
        if (ratio == null) {
            return null;
        }
        BigDecimal lo = new BigDecimal("0.360");
        BigDecimal hi = new BigDecimal("0.390");
        Level level = ratio.compareTo(lo) < 0 ? Level.LOW : ratio.compareTo(hi) <= 0 ? Level.NORMAL : Level.HIGH;
        String label = switch (level) {
            case LOW -> "낮음";
            case HIGH -> "높음(부종·수분 불균형 가능)";
            default -> "표준";
        };
        return new Judgement(level, label, lo, hi, INBODY);
    }

    /** 값 ÷ 키(m)². 키가 없으면 null. 소수 첫째 자리. */
    public static BigDecimal perHeightSquared(BigDecimal value, BigDecimal heightCm) {
        if (value == null || heightCm == null || heightCm.signum() <= 0) {
            return null;
        }
        BigDecimal m = heightCm.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return value.divide(m.multiply(m), 1, RoundingMode.HALF_UP);
    }

    /** 표준체중 = BMI 22 × 키(m)² (소수 첫째 자리). */
    public static BigDecimal standardWeight(BigDecimal heightCm) {
        if (heightCm == null) {
            return null;
        }
        BigDecimal m = heightCm.divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        return BigDecimal.valueOf(22).multiply(m).multiply(m).setScale(1, RoundingMode.HALF_UP);
    }
}
