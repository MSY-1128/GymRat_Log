package com.fitlog.meal;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MealEntryRepository extends JpaRepository<MealEntry, Long> {

    List<MealEntry> findByDateOrderByIdAsc(LocalDate date);

    List<MealEntry> findByDateBetweenOrderByDateAscIdAsc(LocalDate from, LocalDate to);
}
