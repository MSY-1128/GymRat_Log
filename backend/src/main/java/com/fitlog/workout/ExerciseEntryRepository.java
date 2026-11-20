package com.fitlog.workout;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExerciseEntryRepository extends JpaRepository<ExerciseEntry, Long> {

    List<ExerciseEntry> findByDateOrderByIdAsc(LocalDate date);

    List<ExerciseEntry> findByDateBetweenOrderByDateAscIdAsc(LocalDate from, LocalDate to);
}
