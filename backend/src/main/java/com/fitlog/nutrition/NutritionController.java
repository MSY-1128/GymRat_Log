package com.fitlog.nutrition;

import com.fitlog.auth.AuthUser;
import com.fitlog.profile.Goal;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/nutrition")
public class NutritionController {

    private final LimitGuideService limitGuide;
    private final MealPlanService mealPlan;

    public NutritionController(LimitGuideService limitGuide, MealPlanService mealPlan) {
        this.limitGuide = limitGuide;
        this.mealPlan = mealPlan;
    }

    /** 하루 당류·나트륨·포화지방 섭취와 상한·최근 7일 평균 비교, 줄일 부분 안내. */
    @GetMapping("/limits")
    public LimitGuideResponse limits(@AuthenticationPrincipal AuthUser user,
                                     @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        return limitGuide.guide(user.id(), date);
    }

    /** 목표별 하루 식단표. goal을 비우면 프로필 목표. */
    @GetMapping("/meal-plan")
    public MealPlanResponse mealPlan(@AuthenticationPrincipal AuthUser user,
                                     @RequestParam(required = false) Goal goal,
                                     @RequestParam(defaultValue = "0") int variant) {
        return mealPlan.plan(user.id(), goal, variant);
    }
}
