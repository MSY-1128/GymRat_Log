package com.fitlog.summary;

import com.fitlog.common.ApiException;
import com.fitlog.common.Calculator;
import com.fitlog.food.LimitNutrients;
import com.fitlog.meal.MealEntry;
import com.fitlog.meal.MealEntryRepository;
import com.fitlog.profile.Profile;
import com.fitlog.profile.ProfileService;
import com.fitlog.workout.ExerciseEntry;
import com.fitlog.workout.ExerciseEntryRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SummaryService {

    public static final int MAX_STATS_DAYS = 366;

    private final MealEntryRepository mealRepository;
    private final ExerciseEntryRepository exerciseRepository;
    private final ProfileService profileService;

    public SummaryService(MealEntryRepository mealRepository, ExerciseEntryRepository exerciseRepository,
                          ProfileService profileService) {
        this.mealRepository = mealRepository;
        this.exerciseRepository = exerciseRepository;
        this.profileService = profileService;
    }

    @Transactional(readOnly = true)
    public DailySummary summary(Long userId, LocalDate date) {
        return stats(userId, date, date).getFirst();
    }

    /** from~to(포함) 일별 요약. 기록이 없는 날짜도 0으로 채운다. */
    @Transactional(readOnly = true)
    public List<DailySummary> stats(Long userId, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw ApiException.validation("from", "시작일은 종료일보다 늦을 수 없습니다.");
        }
        long days = ChronoUnit.DAYS.between(from, to) + 1;
        if (days > MAX_STATS_DAYS) {
            throw ApiException.validation("to", "조회 기간은 최대 " + MAX_STATS_DAYS + "일입니다.");
        }
        Integer target = profileService.current(userId).map(Profile::getDailyTargetKcal).orElse(null);

        Map<LocalDate, List<MealEntry>> meals = mealRepository.findByUserIdAndDateBetweenOrderByDateAscIdAsc(userId, from, to)
                .stream().collect(Collectors.groupingBy(MealEntry::getDate));
        Map<LocalDate, List<ExerciseEntry>> workouts = exerciseRepository
                .findByUserIdAndDateBetweenOrderByDateAscIdAsc(userId, from, to)
                .stream().collect(Collectors.groupingBy(ExerciseEntry::getDate));

        List<DailySummary> result = new ArrayList<>((int) days);
        for (LocalDate d = from; !d.isAfter(to); d = d.plusDays(1)) {
            result.add(build(d, target, meals.getOrDefault(d, List.of()), workouts.getOrDefault(d, List.of())));
        }
        return result;
    }

    static DailySummary build(LocalDate date, Integer target, List<MealEntry> meals, List<ExerciseEntry> workouts) {
        BigDecimal kcal = BigDecimal.ZERO;
        BigDecimal carbs = BigDecimal.ZERO;
        BigDecimal protein = BigDecimal.ZERO;
        BigDecimal fat = BigDecimal.ZERO;
        BigDecimal sugars = BigDecimal.ZERO;
        BigDecimal sodium = BigDecimal.ZERO;
        BigDecimal saturated = BigDecimal.ZERO;
        int sugarsMissing = 0;
        int sodiumMissing = 0;
        int saturatedMissing = 0;
        for (MealEntry m : meals) {
            kcal = kcal.add(m.calculatedKcal());
            carbs = carbs.add(m.calculatedCarbsG());
            protein = protein.add(m.calculatedProteinG());
            fat = fat.add(m.calculatedFatG());
            LimitNutrients l = m.calculatedLimits();
            if (l.sugarsG() == null) {
                sugarsMissing++;
            } else {
                sugars = sugars.add(l.sugarsG());
            }
            if (l.sodiumMg() == null) {
                sodiumMissing++;
            } else {
                sodium = sodium.add(l.sodiumMg());
            }
            if (l.saturatedFatG() == null) {
                saturatedMissing++;
            } else {
                saturated = saturated.add(l.saturatedFatG());
            }
        }
        BigDecimal exerciseKcal = BigDecimal.ZERO;
        BigDecimal minutes = BigDecimal.ZERO;
        for (ExerciseEntry e : workouts) {
            exerciseKcal = exerciseKcal.add(e.calculatedKcal());
            // 헬스는 세트 수로 추정한 시간(2.5분 단위)이라 합계를 정수 분으로 반올림한다
            minutes = minutes.add(e.durationMinutes());
        }
        return new DailySummary(date, kcal, target, Calculator.remaining(target, kcal), exerciseKcal,
                minutes.setScale(0, java.math.RoundingMode.HALF_UP).intValue(), carbs, protein, fat,
                sugars, sodium, saturated, meals.size(), sugarsMissing, sodiumMissing, saturatedMissing);
    }
}
