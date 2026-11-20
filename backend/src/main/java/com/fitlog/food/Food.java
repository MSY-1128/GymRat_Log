package com.fitlog.food;

import com.fitlog.common.BaseEntity;
import com.fitlog.common.Source;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;

/** 음식. 영양값은 모두 100g 기준. */
@Entity
@Table(name = "food")
public class Food extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private BigDecimal kcal;

    @Column(name = "carbs_g", nullable = false)
    private BigDecimal carbsG;

    @Column(name = "protein_g", nullable = false)
    private BigDecimal proteinG;

    @Column(name = "fat_g", nullable = false)
    private BigDecimal fatG;

    @Column(name = "serving_grams")
    private BigDecimal servingGrams;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Source source;

    /** data.json 샘플 ID 매핑(DEMO만). DB ID와는 별개. */
    @Column(name = "sample_id")
    private Long sampleId;

    protected Food() {
    }

    public Food(String name, BigDecimal kcal, BigDecimal carbsG, BigDecimal proteinG, BigDecimal fatG,
                BigDecimal servingGrams, Source source, Long sampleId) {
        this.name = name;
        this.kcal = kcal;
        this.carbsG = carbsG;
        this.proteinG = proteinG;
        this.fatG = fatG;
        this.servingGrams = servingGrams;
        this.source = source;
        this.sampleId = sampleId;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getKcal() {
        return kcal;
    }

    public BigDecimal getCarbsG() {
        return carbsG;
    }

    public BigDecimal getProteinG() {
        return proteinG;
    }

    public BigDecimal getFatG() {
        return fatG;
    }

    public BigDecimal getServingGrams() {
        return servingGrams;
    }

    public Source getSource() {
        return source;
    }

    public Long getSampleId() {
        return sampleId;
    }
}
