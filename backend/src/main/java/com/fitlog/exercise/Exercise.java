package com.fitlog.exercise;

import com.fitlog.common.BaseEntity;
import com.fitlog.common.Source;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.List;

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

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private ExerciseKind kind = ExerciseKind.TIME;

    @Enumerated(EnumType.STRING)
    @Column(name = "body_part", length = 10)
    private BodyPart bodyPart;

    @Column(name = "kcal_per_kg_km")
    private BigDecimal kcalPerKgKm;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder = 1000;

    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private Equipment equipment;

    @Convert(converter = MuscleListConverter.class)
    @Column(name = "primary_muscles", length = 200)
    private List<Muscle> primaryMuscles = List.of();

    @Convert(converter = MuscleListConverter.class)
    @Column(name = "secondary_muscles", length = 200)
    private List<Muscle> secondaryMuscles = List.of();

    @Enumerated(EnumType.STRING)
    @Column(name = "energy_system", nullable = false, length = 10)
    private EnergySystem energySystem = EnergySystem.ANAEROBIC;

    @Column(name = "met_light")
    private BigDecimal metLight;

    @Column(name = "met_vigorous")
    private BigDecimal metVigorous;

    /** 속도(km/h)별 MET 곡선("6.4:6.0,8.0:8.3"). 거리·속도로 강도를 정할 수 있는 운동만 값이 있다. */
    @Column(name = "speed_met_curve", length = 200)
    private String speedMetCurve;

    /** 동작 애니메이션 키(패턴[:변형]). 화면에서 그림을 고르는 데만 쓴다. */
    @Column(length = 40)
    private String motion;

    protected Exercise() {
    }

    public EnergySystem getEnergySystem() {
        return energySystem;
    }

    public BigDecimal getMetLight() {
        return metLight;
    }

    public BigDecimal getMetVigorous() {
        return metVigorous;
    }

    public String getSpeedMetCurve() {
        return speedMetCurve;
    }

    public String getMotion() {
        return motion;
    }

    /** 속도·거리로 강도를 정할 수 있는지. */
    public boolean speedCapable() {
        return speedMetCurve != null && !speedMetCurve.isBlank();
    }

    /** 체감 강도별 MET. 강도 값이 없으면 보통(met) 기준으로 0.75배·1.3배. */
    public BigDecimal metFor(Intensity intensity) {
        return switch (intensity) {
            case LIGHT -> metLight != null ? metLight
                    : met.multiply(new BigDecimal("0.75")).setScale(2, java.math.RoundingMode.HALF_UP);
            case MODERATE -> met;
            case VIGOROUS -> metVigorous != null ? metVigorous
                    : met.multiply(new BigDecimal("1.3")).setScale(2, java.math.RoundingMode.HALF_UP);
        };
    }

    public Equipment getEquipment() {
        return equipment;
    }

    public List<Muscle> getPrimaryMuscles() {
        return primaryMuscles == null ? List.of() : primaryMuscles;
    }

    public List<Muscle> getSecondaryMuscles() {
        return secondaryMuscles == null ? List.of() : secondaryMuscles;
    }

    public ExerciseKind getKind() {
        return kind;
    }

    public BodyPart getBodyPart() {
        return bodyPart;
    }

    public BigDecimal getKcalPerKgKm() {
        return kcalPerKgKm;
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
