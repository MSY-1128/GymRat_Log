package com.fitlog.workout;

import com.fitlog.common.BaseEntity;
import com.fitlog.common.Calculator;
import com.fitlog.exercise.Exercise;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 운동 기록. 생성 시점의 프로필 체중과 운동 MET를 snapshot으로 보관한다.
 * 수정 시 체중은 유지하고, 운동 종류가 바뀐 경우에만 새 MET/이름을 적용한다.
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

    @Column(nullable = false)
    private int minutes;

    @Column(name = "name_snapshot", nullable = false, length = 100)
    private String nameSnapshot;

    @Column(name = "weight_kg_snapshot", nullable = false)
    private BigDecimal weightKgSnapshot;

    @Column(name = "met_snapshot", nullable = false)
    private BigDecimal metSnapshot;

    protected ExerciseEntry() {
    }

    public ExerciseEntry(Long userId, LocalDate date, Exercise exercise, int minutes, BigDecimal weightKg) {
        this.userId = userId;
        this.date = date;
        this.minutes = minutes;
        this.weightKgSnapshot = weightKg;
        takeSnapshot(exercise);
    }

    public void update(LocalDate date, Exercise exercise, int minutes) {
        this.date = date;
        this.minutes = minutes;
        if (!this.exercise.getId().equals(exercise.getId())) {
            takeSnapshot(exercise);
        }
    }

    private void takeSnapshot(Exercise exercise) {
        this.exercise = exercise;
        this.nameSnapshot = exercise.getName();
        this.metSnapshot = exercise.getMet();
    }

    public BigDecimal calculatedKcal() {
        return Calculator.exerciseKcal(metSnapshot, weightKgSnapshot, minutes);
    }

    public LocalDate getDate() {
        return date;
    }

    public Long getExerciseId() {
        return exercise.getId();
    }

    public int getMinutes() {
        return minutes;
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
}
