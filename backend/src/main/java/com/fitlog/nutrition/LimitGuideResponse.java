package com.fitlog.nutrition;

import com.fitlog.meal.MealType;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 하루 섭취한 당류·나트륨·포화지방과 상한 비교, 줄일 부분 안내.
 *
 * @param referenceKcal  상한 계산에 쓴 열량
 * @param referenceBasis TARGET(설정한 하루 목표) · TDEE(프로필 계산) · DEFAULT(프로필이 없어 2,000kcal)
 * @param averageFrom    평균 기간 시작일(date 포함 7일)
 * @param averageDays    그 기간 중 식단 기록이 있는 날 수(평균의 분모)
 * @param mealCount      date의 식단 기록 수
 */
public record LimitGuideResponse(
        LocalDate date,
        BigDecimal referenceKcal,
        ReferenceBasis referenceBasis,
        LocalDate averageFrom,
        int averageDays,
        int mealCount,
        List<Item> items,
        List<Advice> advice
) {

    public enum ReferenceBasis { TARGET, TDEE, DEFAULT }

    /** NO_RECORD: 기록 없음 · OK: 상한의 80% 이하 · NEAR: 80~100% · OVER: 상한 초과 */
    public enum Status { NO_RECORD, OK, NEAR, OVER }

    /**
     * @param today        정보가 있는 기록만 더한 오늘 섭취량
     * @param todayMissing 정보가 없어 합계에서 빠진 오늘 기록 수
     * @param average      기록이 있는 날의 하루 평균(없으면 null)
     * @param percent      오늘 섭취량 ÷ 상한 × 100(반올림)
     */
    public record Item(
            LimitNutrient nutrient,
            String label,
            String unit,
            BigDecimal today,
            int todayMissing,
            BigDecimal average,
            BigDecimal limit,
            String limitBasis,
            int percent,
            Status status,
            Status averageStatus
    ) {
    }

    /** WARN: 상한 초과 · INFO: 상한에 가까움·참고 */
    public enum Level { WARN, INFO }

    /**
     * @param topFoods 오늘 이 영양소를 가장 많이 준 기록(최대 3개)
     * @param tips     줄이는 방법
     */
    public record Advice(LimitNutrient nutrient, Level level, String message, List<Contributor> topFoods,
                         List<String> tips) {
    }

    public record Contributor(String name, MealType mealType, BigDecimal amount) {
    }
}
