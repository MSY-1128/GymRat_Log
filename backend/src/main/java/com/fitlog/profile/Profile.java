package com.fitlog.profile;

import com.fitlog.common.BaseEntity;
import com.fitlog.common.SexForFormula;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "profile")
public class Profile extends BaseEntity {

    /** 소유자(app_user.id). 로그인 도입 전 데이터는 null일 수 있다. */
    @Column(name = "user_id")
    private Long userId;

    @Column(nullable = false)
    private int age;

    @Enumerated(EnumType.STRING)
    @Column(name = "sex_for_formula", length = 10)
    private SexForFormula sexForFormula;

    @Column(name = "height_cm", nullable = false)
    private BigDecimal heightCm;

    @Column(name = "weight_kg", nullable = false)
    private BigDecimal weightKg;

    @Column(name = "activity_factor", nullable = false)
    private BigDecimal activityFactor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Goal goal;

    @Column(name = "daily_target_kcal")
    private Integer dailyTargetKcal;

    @Enumerated(EnumType.STRING)
    @Column(name = "bmr_method", nullable = false, length = 10)
    private BmrMethod bmrMethod = BmrMethod.FORMULA;

    /** 단백질 목표(제지방 1kg당 g). 없으면 목표 표시 안 함. */
    @Column(name = "protein_g_per_kg_lean")
    private BigDecimal proteinGPerKgLean;

    protected Profile() {
    }

    public final void updateCalculation(BmrMethod bmrMethod, BigDecimal proteinGPerKgLean) {
        this.bmrMethod = bmrMethod == null ? BmrMethod.FORMULA : bmrMethod;
        this.proteinGPerKgLean = proteinGPerKgLean;
    }

    public BmrMethod getBmrMethod() {
        return bmrMethod;
    }

    public BigDecimal getProteinGPerKgLean() {
        return proteinGPerKgLean;
    }

    public Profile(Long userId, int age, SexForFormula sexForFormula, BigDecimal heightCm, BigDecimal weightKg,
                   BigDecimal activityFactor, Goal goal, Integer dailyTargetKcal) {
        this.userId = userId;
        update(age, sexForFormula, heightCm, weightKg, activityFactor, goal, dailyTargetKcal);
    }

    public final void update(int age, SexForFormula sexForFormula, BigDecimal heightCm, BigDecimal weightKg,
                             BigDecimal activityFactor, Goal goal, Integer dailyTargetKcal) {
        this.age = age;
        this.sexForFormula = sexForFormula;
        this.heightCm = heightCm;
        this.weightKg = weightKg;
        this.activityFactor = activityFactor;
        this.goal = goal;
        this.dailyTargetKcal = dailyTargetKcal;
    }

    public int getAge() {
        return age;
    }

    public SexForFormula getSexForFormula() {
        return sexForFormula;
    }

    public BigDecimal getHeightCm() {
        return heightCm;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public BigDecimal getActivityFactor() {
        return activityFactor;
    }

    public Goal getGoal() {
        return goal;
    }

    public Integer getDailyTargetKcal() {
        return dailyTargetKcal;
    }
}
