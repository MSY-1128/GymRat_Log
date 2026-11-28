package com.fitlog.workout;

import com.fitlog.common.BaseEntity;
import com.fitlog.common.Calculator;
import com.fitlog.exercise.BodyPart;
import com.fitlog.exercise.Exercise;
import com.fitlog.exercise.Intensity;
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
 * 운동 기록. 생성 시점의 프로필 체중과 적용 MET(시간 운동은 강도에 따른 MET)를 snapshot으로 보관한다.
 * 수정 시 체중은 유지하고, 운동 종류나 강도 입력이 바뀐 경우에만 새 MET를 적용한다.
 *
 * <ul>
 *   <li>TIME: MET × 3.5 × 체중 / 200 × 분. MET는 체감 강도 또는 속도(거리 ÷ 시간)로 정한다</li>
 *   <li>DISTANCE(이전 기록만): 거리 계수 × 체중 × km</li>
 *   <li>SETS: MET × 3.5 × 체중 / 200 × (세트 × 2.5분). 무게·횟수는 볼륨 기록용</li>
 * </ul>
 */
@Entity
@Table(name = "exercise_entry")
public class ExerciseEntry extends BaseEntity {

    /** 소유자(app_user.id). 로그인 도입 전 데이터는 null일 수 있다. */
    @Column(name = "user_id")
    private Long userId;

    @Column(name = "entry_date", nullable = false)
    private LocalDate date;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exercise_id", nullable = false)
    private Exercise exercise;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private WorkoutMode mode = WorkoutMode.TIME;

    private Integer minutes;

    @Column(name = "distance_km")
    private BigDecimal distanceKm;

    private Integer sets;

    private Integer reps;

    @Column(name = "lifted_kg")
    private BigDecimal liftedKg;

    @Column(name = "name_snapshot", nullable = false, length = 100)
    private String nameSnapshot;

    @Column(name = "weight_kg_snapshot", nullable = false)
    private BigDecimal weightKgSnapshot;

    @Column(name = "met_snapshot", nullable = false)
    private BigDecimal metSnapshot;

    @Column(name = "kcal_per_kg_km_snapshot")
    private BigDecimal kcalPerKgKmSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(name = "intensity_basis", length = 10)
    private IntensityBasis intensityBasis;

    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Intensity intensity;

    @Column(name = "speed_kmh")
    private BigDecimal speedKmh;

    protected ExerciseEntry() {
    }

    /** 시간 기록(seed 등). */
    public ExerciseEntry(Long userId, LocalDate date, Exercise exercise, int minutes, BigDecimal weightKg) {
        this(userId, date, exercise, WorkoutDetail.time(minutes), weightKg);
    }

    public ExerciseEntry(Long userId, LocalDate date, Exercise exercise, WorkoutDetail detail, BigDecimal weightKg) {
        this.userId = userId;
        this.weightKgSnapshot = weightKg;
        takeSnapshot(exercise, detail);
        apply(date, detail);
    }

    /**
     * 수정. 운동 종류가 바뀌었거나 강도 입력(기준·체감 강도·속도)이 바뀌었을 때만 새 MET를 적용하고,
     * 그대로면 기록 당시 MET를 유지한다.
     */
    public void update(LocalDate date, Exercise exercise, WorkoutDetail detail) {
        if (!this.exercise.getId().equals(exercise.getId())) {
            takeSnapshot(exercise, detail);
        } else if (!detail.sameIntensityAs(intensityBasis, intensity, speedKmh)) {
            this.metSnapshot = detail.met() != null ? detail.met() : exercise.getMet();
        }
        apply(date, detail);
    }

    private void apply(LocalDate date, WorkoutDetail d) {
        this.date = date;
        this.mode = d.mode();
        this.minutes = d.minutes();
        this.distanceKm = d.distanceKm();
        this.sets = d.sets();
        this.reps = d.reps();
        this.liftedKg = d.liftedKg();
        this.intensityBasis = d.basis();
        this.intensity = d.intensity();
        this.speedKmh = d.speedKmh();
        if (d.mode() != WorkoutMode.DISTANCE) {
            // 이전 거리 기록을 다른 방식으로 바꾸면 km당 계수는 더 쓰지 않는다
            this.kcalPerKgKmSnapshot = null;
        }
    }

    private void takeSnapshot(Exercise exercise, WorkoutDetail detail) {
        this.exercise = exercise;
        this.nameSnapshot = exercise.getName();
        this.metSnapshot = detail.met() != null ? detail.met() : exercise.getMet();
    }

    public BigDecimal calculatedKcal() {
        return switch (mode) {
            case TIME -> Calculator.exerciseKcal(metSnapshot, weightKgSnapshot, minutes);
            case DISTANCE -> Calculator.distanceKcal(kcalPerKgKmSnapshot, weightKgSnapshot, distanceKm);
            case SETS -> Calculator.exerciseKcal(metSnapshot, weightKgSnapshot, Calculator.strengthMinutes(sets));
        };
    }

    /** 운동 시간(분). 헬스는 세트 수로 추정, 거리 기록은 시간을 입력하지 않았으면 0. */
    public BigDecimal durationMinutes() {
        return switch (mode) {
            case TIME -> BigDecimal.valueOf(minutes);
            case DISTANCE -> minutes == null ? BigDecimal.ZERO : BigDecimal.valueOf(minutes);
            case SETS -> Calculator.strengthMinutes(sets);
        };
    }

    /** 헬스 볼륨(세트 × 횟수 × 무게). 헬스가 아니면 null. */
    public BigDecimal volumeKg() {
        return mode == WorkoutMode.SETS ? Calculator.volume(sets, reps, liftedKg) : null;
    }

    public LocalDate getDate() {
        return date;
    }

    public Long getExerciseId() {
        return exercise.getId();
    }

    public BodyPart getBodyPart() {
        return exercise.getBodyPart();
    }

    public WorkoutMode getMode() {
        return mode;
    }

    public Integer getMinutes() {
        return minutes;
    }

    public BigDecimal getDistanceKm() {
        return distanceKm;
    }

    public Integer getSets() {
        return sets;
    }

    public Integer getReps() {
        return reps;
    }

    public BigDecimal getLiftedKg() {
        return liftedKg;
    }

    public String getNameSnapshot() {
        return nameSnapshot;
    }

    public BigDecimal getWeightKgSnapshot() {
        return weightKgSnapshot;
    }

    public BigDecimal getMetSnapshot() {
        return metSnapshot;
    }

    public BigDecimal getKcalPerKgKmSnapshot() {
        return kcalPerKgKmSnapshot;
    }

    public IntensityBasis getIntensityBasis() {
        return intensityBasis;
    }

    public Intensity getIntensity() {
        return intensity;
    }

    public BigDecimal getSpeedKmh() {
        return speedKmh;
    }

    public com.fitlog.exercise.EnergySystem getEnergySystem() {
        return exercise.getEnergySystem();
    }
}
