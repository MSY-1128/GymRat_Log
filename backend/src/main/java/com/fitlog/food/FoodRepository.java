package com.fitlog.food;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FoodRepository extends JpaRepository<Food, Long> {

    /** Spring Data가 LIKE 와일드카드(%, _)를 이스케이프한다. */
    Page<Food> findByNameContainingIgnoreCase(String name, Pageable pageable);

    Optional<Food> findByExternalCode(String externalCode);

    List<Food> findByExternalCodeIn(Collection<String> externalCodes);
}
