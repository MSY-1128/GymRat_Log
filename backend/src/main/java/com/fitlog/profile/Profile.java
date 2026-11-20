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

    protected Profile() {
    }

    public Profile(int age, SexForFormula sexForFormula, BigDecimal heightCm, BigDecimal weightKg,
                   BigDecimal activityFactor, Goal goal, Integer dailyTargetKcal) {
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
