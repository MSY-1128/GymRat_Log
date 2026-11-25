package com.fitlog.body;

import com.fitlog.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

/** 체성분 측정 기록(인바디 결과지를 직접 입력). 사용자별, 날짜당 하나. */
@Entity
@Table(name = "body_composition")
public class BodyComposition extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "measured_on", nullable = false)
    private LocalDate measuredOn;

    @Column(name = "weight_kg", nullable = false)
    private BigDecimal weightKg;

    @Column(name = "body_fat_pct")
    private BigDecimal bodyFatPct;

    @Column(name = "skeletal_muscle_kg")
    private BigDecimal skeletalMuscleKg;

    @Column(name = "measured_bmr_kcal")
    private Integer measuredBmrKcal;

    @Column(name = "visceral_fat_level")
    private Integer visceralFatLevel;

    protected BodyComposition() {
    }

    public BodyComposition(Long userId, BodyCompositionRequest r) {
        this.userId = userId;
        update(r);
    }

    public final void update(BodyCompositionRequest r) {
        this.measuredOn = r.measuredOn();
        this.weightKg = r.weightKg();
        this.bodyFatPct = r.bodyFatPct();
        this.skeletalMuscleKg = r.skeletalMuscleKg();
        this.measuredBmrKcal = r.measuredBmrKcal();
        this.visceralFatLevel = r.visceralFatLevel();
    }

    public Long getUserId() {
        return userId;
    }

    public LocalDate getMeasuredOn() {
        return measuredOn;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public BigDecimal getBodyFatPct() {
        return bodyFatPct;
    }

    public BigDecimal getSkeletalMuscleKg() {
        return skeletalMuscleKg;
    }

    public Integer getMeasuredBmrKcal() {
        return measuredBmrKcal;
    }

    public Integer getVisceralFatLevel() {
        return visceralFatLevel;
    }
}
