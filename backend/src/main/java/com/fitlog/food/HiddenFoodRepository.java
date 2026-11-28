package com.fitlog.food;

import java.util.Collection;
import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HiddenFoodRepository extends JpaRepository<HiddenFood, HiddenFood.Key> {

    @Modifying
    @Query(value = "INSERT INTO hidden_food (user_id, food_id) VALUES (:userId, :foodId) ON CONFLICT DO NOTHING",
            nativeQuery = true)
    void hide(@Param("userId") Long userId, @Param("foodId") Long foodId);

    @Query("select h.foodId from HiddenFood h where h.userId = :userId and h.foodId in :foodIds")
    Set<Long> findHiddenFoodIds(@Param("userId") Long userId, @Param("foodIds") Collection<Long> foodIds);

    @Modifying
    @Query(value = "DELETE FROM hidden_food WHERE user_id = :userId AND food_id = :foodId", nativeQuery = true)
    void unhide(@Param("userId") Long userId, @Param("foodId") Long foodId);
}
