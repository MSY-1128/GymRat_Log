package com.fitlog.nutrition;

import com.fitlog.meal.MealEntry;
import com.fitlog.meal.MealEntryRepository;
import com.fitlog.nutrition.LimitGuideResponse.Advice;
import com.fitlog.nutrition.LimitGuideResponse.Contributor;
import com.fitlog.nutrition.LimitGuideResponse.Item;
import com.fitlog.nutrition.LimitGuideResponse.Level;
import com.fitlog.nutrition.LimitGuideResponse.ReferenceBasis;
import com.fitlog.nutrition.LimitGuideResponse.Status;
import com.fitlog.profile.ProfileResponse;
import com.fitlog.profile.ProfileService;
import com.fitlog.summary.DailySummary;
import com.fitlog.summary.SummaryService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.DecimalFormat;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LimitGuideService {

    static final int AVERAGE_DAYS = 7;
    static final BigDecimal DEFAULT_KCAL = BigDecimal.valueOf(2000);
    /** 운동이 이만큼(분) 이상이면 땀으로 인한 나트륨 손실을 안내한다. */
    static final int LONG_EXERCISE_MINUTES = 60;
    private static final BigDecimal NEAR_RATIO = new BigDecimal("0.8");
    /** 많이 먹은 음식으로 보여 줄 최소 비중 */
    private static final BigDecimal MIN_SHARE = new BigDecimal("0.10");

    private final SummaryService summaryService;
    private final MealEntryRepository meals;
    private final ProfileService profileService;

    public LimitGuideService(SummaryService summaryService, MealEntryRepository meals, ProfileService profileService) {
        this.summaryService = summaryService;
        this.meals = meals;
        this.profileService = profileService;
    }

    @Transactional(readOnly = true)
    public LimitGuideResponse guide(Long userId, LocalDate date) {
        Optional<ProfileResponse> profile = profileService.get(userId);
        ReferenceBasis basis = ReferenceBasis.DEFAULT;
        BigDecimal referenceKcal = DEFAULT_KCAL;
        if (profile.isPresent() && profile.get().dailyTargetKcal() != null) {
            basis = ReferenceBasis.TARGET;
            referenceKcal = BigDecimal.valueOf(profile.get().dailyTargetKcal());
        } else if (profile.isPresent() && profile.get().tdeeKcal() != null) {
            basis = ReferenceBasis.TDEE;
            referenceKcal = profile.get().tdeeKcal().setScale(0, RoundingMode.HALF_UP);
        }

        LocalDate from = date.minusDays(AVERAGE_DAYS - 1L);
        List<DailySummary> days = summaryService.stats(userId, from, date);
        DailySummary today = days.getLast();
        List<DailySummary> recorded = days.stream().filter(d -> d.mealCount() > 0).toList();
        List<MealEntry> todayMeals = meals.findByUserIdAndDateOrderByIdAsc(userId, date);

        List<Item> items = new ArrayList<>();
        List<Advice> advice = new ArrayList<>();
        for (LimitNutrient n : LimitNutrient.values()) {
            BigDecimal limit = n.limit(referenceKcal);
            BigDecimal todayValue = n.of(today);
            BigDecimal average = recorded.isEmpty() ? null
                    : recorded.stream().map(n::of).reduce(BigDecimal.ZERO, BigDecimal::add)
                            .divide(BigDecimal.valueOf(recorded.size()), 2, RoundingMode.HALF_UP);
            Status status = today.mealCount() == 0 ? Status.NO_RECORD : status(todayValue, limit);
            Status averageStatus = average == null ? Status.NO_RECORD : status(average, limit);
            int percent = todayValue.multiply(BigDecimal.valueOf(100)).divide(limit, 0, RoundingMode.HALF_UP).intValue();
            items.add(new Item(n, n.label(), n.unit(), todayValue, n.missing(today), average, limit, n.basis(),
                    percent, status, averageStatus));

            advice(n, status, averageStatus, todayValue, average, limit, percent, recorded.size(),
                    referenceKcal, today.exerciseMinutes(), todayMeals).ifPresent(advice::add);
        }
        // 초과(WARN)를 먼저 보여 준다
        advice.sort(Comparator.comparing(Advice::level));
        return new LimitGuideResponse(date, referenceKcal, basis, from, recorded.size(), today.mealCount(), items,
                advice);
    }

    static Status status(BigDecimal value, BigDecimal limit) {
        if (value.compareTo(limit) > 0) {
            return Status.OVER;
        }
        return value.compareTo(limit.multiply(NEAR_RATIO)) > 0 ? Status.NEAR : Status.OK;
    }

    private static Optional<Advice> advice(LimitNutrient n, Status today, Status avg, BigDecimal todayValue,
                                           BigDecimal average, BigDecimal limit, int percent, int averageDays,
                                           BigDecimal referenceKcal, int exerciseMinutes, List<MealEntry> todayMeals) {
        String subject = n.label() + (n == LimitNutrient.SUGARS ? "가" : "이");
        String message;
        Level level;
        if (today == Status.OVER) {
            level = Level.WARN;
            message = "오늘 " + subject + " 상한(" + amount(limit, n) + ")보다 " + amount(todayValue.subtract(limit), n)
                    + " 많아요.";
            if (avg == Status.OVER && averageDays > 1) {
                message += " 최근 " + averageDays + "일 평균(" + amount(average, n) + ")도 상한을 넘어요.";
            }
        } else if (avg == Status.OVER && averageDays > 1) {
            level = Level.WARN;
            message = (today == Status.NO_RECORD ? "" : "오늘은 괜찮지만 ") + "최근 " + averageDays + "일 평균 " + n.label() + "(" + amount(average, n)
                    + ")" + (n == LimitNutrient.SUGARS ? "가" : "이") + " 상한(" + amount(limit, n) + ")을 넘어요.";
        } else if (today == Status.NEAR) {
            level = Level.INFO;
            message = "오늘 " + subject + " 상한의 " + percent + "%예요. 남은 끼니는 " + n.label() + " 적은 음식으로 골라 보세요.";
        } else {
            return Optional.empty();
        }

        List<Contributor> top = todayMeals.stream()
                .filter(m -> n.of(m.calculatedLimits()) != null && n.of(m.calculatedLimits()).signum() > 0
                        // 하루 양의 10% 이상을 준 음식만(밥 2mg 같은 작은 값은 빼고)
                        && n.of(m.calculatedLimits()).compareTo(todayValue.multiply(MIN_SHARE)) >= 0)
                .sorted(Comparator.comparing((MealEntry m) -> n.of(m.calculatedLimits())).reversed())
                .limit(3)
                .map(m -> new Contributor(m.getFoodNameSnapshot(), m.getMealType(),
                        n.of(m.calculatedLimits()).setScale(n == LimitNutrient.SODIUM ? 0 : 1, RoundingMode.HALF_UP)))
                .toList();
        return Optional.of(new Advice(n, level, message, top, tips(n, referenceKcal, exerciseMinutes)));
    }

    static List<String> tips(LimitNutrient n, BigDecimal referenceKcal, int exerciseMinutes) {
        return switch (n) {
            case SODIUM -> {
                List<String> t = new ArrayList<>(List.of(
                        "국·찌개·라면은 국물을 남기면 나트륨을 크게 줄일 수 있어요.",
                        "김치·장아찌·젓갈은 한 번에 조금씩 드세요.",
                        "햄·소시지 같은 가공육과 소스·드레싱 양을 줄이세요."));
                if (exerciseMinutes >= LONG_EXERCISE_MINUTES) {
                    t.add("오늘 운동이 " + exerciseMinutes + "분이에요. 땀을 많이 흘렸다면 나트륨이 빠져나가 필요량이 늘 수 있어요"
                            + "(ACSM 수분 보충 지침). 평소에는 상한을 지키세요.");
                }
                yield t;
            }
            case SUGARS -> List.of(
                    "단 음료·디저트·가당 시리얼부터 줄이세요. 물이나 무가당 차로 바꾸면 효과가 커요.",
                    "과일은 주스보다 생과일로 드세요.",
                    "여기 당류는 과일·우유의 당까지 포함한 총당류예요. 설탕 같은 첨가당은 WHO 권고대로 열량의 10%(약 "
                            + referenceKcal.multiply(new BigDecimal("0.10")).divide(BigDecimal.valueOf(4), 0,
                                    RoundingMode.HALF_UP) + "g) 미만이 좋아요.");
            case SATURATED_FAT -> List.of(
                    "삼겹살·갈비 대신 안심·우둔·닭가슴살 같은 살코기를 고르세요.",
                    "튀김·버터·크림·치즈를 줄이고 생선·견과·식물성 기름으로 바꾸세요.");
        };
    }

    /** 1,234mg · 12.5g */
    static String amount(BigDecimal v, LimitNutrient n) {
        DecimalFormat f = new DecimalFormat(n == LimitNutrient.SODIUM ? "#,##0" : "#,##0.#");
        f.setRoundingMode(RoundingMode.HALF_UP);
        return f.format(v) + n.unit();
    }
}
