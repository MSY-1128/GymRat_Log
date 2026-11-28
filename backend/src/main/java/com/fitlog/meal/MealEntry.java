package com.fitlog.meal;

import com.fitlog.common.BaseEntity;
import com.fitlog.common.Calculator;
import com.fitlog.food.Food;
import com.fitlog.food.LimitNutrients;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 식단 기록. 음식명/100g 기준 영양값을 snapshot으로 보관해
 * 음식 정보가 바뀌어도 과거 기록의 계산값이 변하지 않게 한다.
 */
@Entity
@Table(name = "meal_entry")
public class MealEntry extends BaseEntity {

    /** 소유자(app_user.id). 로그인 도입 전 데이터는 null일 수 있다. */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "entry_date", nullable = false)
    private LocalDate date;

    @Enumerated(EnumType.STRING)
    @Column(name = "meal_type", nullable = false, length = 10)
    private MealType mealType;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "food_id", nullable = false)
    private Food food;

    @Column(nullable = false)
    private BigDecimal grams;

    @Column(name = "food_name_snapshot", nullable = false, length = 100)
    private String foodNameSnapshot;

    @Column(name = "kcal_per100_snapshot", nullable = false)
    private BigDecimal kcalPer100Snapshot;

    @Column(name = "carbs_per100_snapshot", nullable = false)
    private BigDecimal carbsPer100Snapshot;

    @Column(name = "protein_per100_snapshot", nullable = false)
    private BigDecimal proteinPer100Snapshot;

    @Column(name = "fat_per100_snapshot", nullable = false)
    private BigDecimal fatPer100Snapshot;

    /** 당류·나트륨·포화지방 snapshot. 음식에 정보가 없었으면 null. */
    @Column(name = "sugars_per100_snapshot")
    private BigDecimal sugarsPer100Snapshot;

    @Column(name = "sodium_per100_snapshot")
    private BigDecimal sodiumPer100Snapshot;

    @Column(name = "saturated_fat_per100_snapshot")
    private BigDecimal saturatedFatPer100Snapshot;

    protected MealEntry() {
    }

    public MealEntry(Long userId, LocalDate date, MealType mealType, Food food, BigDecimal grams) {
        this.userId = userId;
        this.date = date;
        this.mealType = mealType;
        this.grams = grams;
        takeSnapshot(food);
    }

    /** 같은 음식이면 기존 snapshot 유지, 음식이 바뀐 경우에만 새 snapshot을 적용한다. */
    public void update(LocalDate date, MealType mealType, Food food, BigDecimal grams) {
        this.date = date;
        this.mealType = mealType;
        this.grams = grams;
        if (!this.food.getId().equals(food.getId())) {
            takeSnapshot(food);
        }
    }

    private void takeSnapshot(Food food) {
        this.food = food;
        this.foodNameSnapshot = food.getName();
        this.kcalPer100Snapshot = food.getKcal();
        this.carbsPer100Snapshot = food.getCarbsG();
        this.proteinPer100Snapshot = food.getProteinG();
        this.fatPer100Snapshot = food.getFatG();
        LimitNutrients limits = food.getLimits();
        this.sugarsPer100Snapshot = limits.sugarsG();
        this.sodiumPer100Snapshot = limits.sodiumMg();
        this.saturatedFatPer100Snapshot = limits.saturatedFatG();
    }

    public BigDecimal calculatedKcal() {
        return Calculator.perGrams(kcalPer100Snapshot, grams);
    }

    public BigDecimal calculatedCarbsG() {
        return Calculator.perGrams(carbsPer100Snapshot, grams);
    }

    public BigDecimal calculatedProteinG() {
        return Calculator.perGrams(proteinPer100Snapshot, grams);
    }

    public BigDecimal calculatedFatG() {
        return Calculator.perGrams(fatPer100Snapshot, grams);
    }

    /** 섭취량 기준 당류(g)·나트륨(mg)·포화지방(g). 모르면 각각 null. */
    public LimitNutrients calculatedLimits() {
        return new LimitNutrients(perGramsOrNull(sugarsPer100Snapshot), perGramsOrNull(sodiumPer100Snapshot),
                perGramsOrNull(saturatedFatPer100Snapshot));
    }

    private BigDecimal perGramsOrNull(BigDecimal per100) {
        return per100 == null ? null : Calculator.perGrams(per100, grams);
    }

    public LocalDate getDate() {
        return date;
    }

    public MealType getMealType() {
        return mealType;
    }

    public Long getFoodId() {
        return food.getId();
    }

    public BigDecimal getGrams() {
        return grams;
    }

    public String getFoodNameSnapshot() {
        return foodNameSnapshot;
    }

    public BigDecimal getKcalPer100Snapshot() {
        return kcalPer100Snapshot;
    }

    public BigDecimal getCarbsPer100Snapshot() {
        return carbsPer100Snapshot;
    }

    public BigDecimal getProteinPer100Snapshot() {
        return proteinPer100Snapshot;
    }

    public BigDecimal getFatPer100Snapshot() {
        return fatPer100Snapshot;
    }
}
