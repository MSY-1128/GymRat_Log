package com.fitlog.body;

import com.fitlog.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 체성분 측정 기록(인바디 결과지를 직접 입력). 사용자별, 날짜당 하나.
 * 저장 전에 {@link BodyCompositionService}가 값을 정형화한다(체지방률 ↔ 체지방량 채움, 앞뒤 검사).
 */
@Entity
@Table(name = "body_composition")
public class BodyComposition extends BaseEntity {

    @Column(name = "user_id", nullable = false, updatable = false)
    private Long userId;

    @Column(name = "measured_on", nullable = false)
    private LocalDate measuredOn;

    @Column(name = "weight_kg", nullable = false)
    private BigDecimal weightKg;

    @Column(name = "body_water_l")
    private BigDecimal bodyWaterL;

    @Column(name = "protein_kg")
    private BigDecimal proteinKg;

    @Column(name = "mineral_kg")
    private BigDecimal mineralKg;

    @Column(name = "body_fat_mass_kg")
    private BigDecimal bodyFatMassKg;

    @Column(name = "skeletal_muscle_kg")
    private BigDecimal skeletalMuscleKg;

    @Column(name = "body_fat_pct")
    private BigDecimal bodyFatPct;

    @Column(name = "lean_right_arm_kg")
    private BigDecimal leanRightArmKg;

    @Column(name = "lean_left_arm_kg")
    private BigDecimal leanLeftArmKg;

    @Column(name = "lean_trunk_kg")
    private BigDecimal leanTrunkKg;

    @Column(name = "lean_right_leg_kg")
    private BigDecimal leanRightLegKg;

    @Column(name = "lean_left_leg_kg")
    private BigDecimal leanLeftLegKg;

    @Column(name = "fat_right_arm_kg")
    private BigDecimal fatRightArmKg;

    @Column(name = "fat_left_arm_kg")
    private BigDecimal fatLeftArmKg;

    @Column(name = "fat_trunk_kg")
    private BigDecimal fatTrunkKg;

    @Column(name = "fat_right_leg_kg")
    private BigDecimal fatRightLegKg;

    @Column(name = "fat_left_leg_kg")
    private BigDecimal fatLeftLegKg;

    @Column(name = "measured_bmr_kcal")
    private Integer measuredBmrKcal;

    @Column(name = "visceral_fat_level")
    private Integer visceralFatLevel;

    @Column(name = "ecw_ratio")
    private BigDecimal ecwRatio;

    @Column(name = "waist_hip_ratio")
    private BigDecimal waistHipRatio;

    @Column(name = "inbody_score")
    private Integer inbodyScore;

    protected BodyComposition() {
    }

    public BodyComposition(Long userId, BodyCompositionRequest r) {
        this.userId = userId;
        update(r);
    }

    /** r은 정형화된 요청이어야 한다. */
    public final void update(BodyCompositionRequest r) {
        this.measuredOn = r.measuredOn();
        this.weightKg = r.weightKg();
        this.bodyWaterL = r.bodyWaterL();
        this.proteinKg = r.proteinKg();
        this.mineralKg = r.mineralKg();
        this.bodyFatMassKg = r.bodyFatMassKg();
        this.skeletalMuscleKg = r.skeletalMuscleKg();
        this.bodyFatPct = r.bodyFatPct();
        Segments.Lean l = r.segmentalLean();
        this.leanRightArmKg = l.rightArm();
        this.leanLeftArmKg = l.leftArm();
        this.leanTrunkKg = l.trunk();
        this.leanRightLegKg = l.rightLeg();
        this.leanLeftLegKg = l.leftLeg();
        Segments.Fat f = r.segmentalFat();
        this.fatRightArmKg = f.rightArm();
        this.fatLeftArmKg = f.leftArm();
        this.fatTrunkKg = f.trunk();
        this.fatRightLegKg = f.rightLeg();
        this.fatLeftLegKg = f.leftLeg();
        this.measuredBmrKcal = r.measuredBmrKcal();
        this.visceralFatLevel = r.visceralFatLevel();
        this.ecwRatio = r.ecwRatio();
        this.waistHipRatio = r.waistHipRatio();
        this.inbodyScore = r.inbodyScore();
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

    public BigDecimal getBodyWaterL() {
        return bodyWaterL;
    }

    public BigDecimal getProteinKg() {
        return proteinKg;
    }

    public BigDecimal getMineralKg() {
        return mineralKg;
    }

    public BigDecimal getBodyFatMassKg() {
        return bodyFatMassKg;
    }

    public BigDecimal getSkeletalMuscleKg() {
        return skeletalMuscleKg;
    }

    public BigDecimal getBodyFatPct() {
        return bodyFatPct;
    }

    /** 제지방량 = 체중 − 체지방량. 체지방 정보가 없으면 null. */
    public BigDecimal getLeanMassKg() {
        return bodyFatMassKg == null ? null : weightKg.subtract(bodyFatMassKg);
    }

    public Segments.Lean getSegmentalLean() {
        return new Segments.Lean(leanRightArmKg, leanLeftArmKg, leanTrunkKg, leanRightLegKg, leanLeftLegKg);
    }

    public Segments.Fat getSegmentalFat() {
        return new Segments.Fat(fatRightArmKg, fatLeftArmKg, fatTrunkKg, fatRightLegKg, fatLeftLegKg);
    }

    public Integer getMeasuredBmrKcal() {
        return measuredBmrKcal;
    }

    public Integer getVisceralFatLevel() {
        return visceralFatLevel;
    }

    public BigDecimal getEcwRatio() {
        return ecwRatio;
    }

    public BigDecimal getWaistHipRatio() {
        return waistHipRatio;
    }

    public Integer getInbodyScore() {
        return inbodyScore;
    }
}
