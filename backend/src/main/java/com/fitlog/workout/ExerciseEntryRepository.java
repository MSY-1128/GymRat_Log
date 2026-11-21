package com.fitlog.workout;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 모든 조회는 소유자(userId)로 한정한다. 다른 사람의 기록 ID로 접근하면 없는 것(404)으로 처리된다. */
public interface ExerciseEntryRepository extends JpaRepository<ExerciseEntry, Long> {

    List<ExerciseEntry> findByUserIdAndDateOrderByIdAsc(Long userId, LocalDate date);

    List<ExerciseEntry> findByUserIdAndDateBetweenOrderByDateAscIdAsc(Long userId, LocalDate from, LocalDate to);

    Optional<ExerciseEntry> findByIdAndUserId(Long id, Long userId);
}
