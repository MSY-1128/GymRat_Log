package com.fitlog.exercise;

import com.fitlog.common.BaseEntity;
import com.fitlog.common.Source;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;

@Entity
@Table(name = "exercise")
public class Exercise extends BaseEntity {

    @Column(nullable = false, length = 100)
    private String name;

    @Column(nullable = false)
    private BigDecimal met;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Source source;

    @Column(name = "sample_id")
    private Long sampleId;

    protected Exercise() {
    }

    public Exercise(String name, BigDecimal met, Source source, Long sampleId) {
        this.name = name;
        this.met = met;
        this.source = source;
        this.sampleId = sampleId;
    }

    public String getName() {
        return name;
    }

    public BigDecimal getMet() {
        return met;
    }

    public Source getSource() {
        return source;
    }

    public Long getSampleId() {
        return sampleId;
    }
}
