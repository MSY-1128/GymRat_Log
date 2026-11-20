package com.fitlog.food;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FoodRepository extends JpaRepository<Food, Long> {

    /** Spring Data가 LIKE 와일드카드(%, _)를 이스케이프한다. */
    Page<Food> findByNameContainingIgnoreCase(String name, Pageable pageable);
}
