package com.fitlog.exercise;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ExerciseRepository extends JpaRepository<Exercise, Long> {

    /** 카탈로그 순서(종목 → 헬스 부위별) 다음 이름순. */
    List<Exercise> findAllByOrderBySortOrderAscNameAscIdAsc();

    Optional<Exercise> findFirstByNameOrderByIdAsc(String name);
}
