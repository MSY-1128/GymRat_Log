package com.fitlog.meal;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 모든 조회는 소유자(userId)로 한정한다. 다른 사람의 기록 ID로 접근하면 없는 것(404)으로 처리된다. */
public interface MealEntryRepository extends JpaRepository<MealEntry, Long> {

    List<MealEntry> findByUserIdAndDateOrderByIdAsc(Long userId, LocalDate date);

    List<MealEntry> findByUserIdAndDateBetweenOrderByDateAscIdAsc(Long userId, LocalDate from, LocalDate to);

    Optional<MealEntry> findByIdAndUserId(Long id, Long userId);
}
