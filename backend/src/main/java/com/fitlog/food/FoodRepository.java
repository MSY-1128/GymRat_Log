package com.fitlog.food;

import com.fitlog.common.Source;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** 사용자에게 보이는 음식 = 공유 음식(DEMO·MFDS) + 본인이 직접 등록한 음식(USER). */
public interface FoodRepository extends JpaRepository<Food, Long> {

    /** pattern은 LIKE 와일드카드(%, _, \)를 이스케이프한 검색어. */
    @Query("""
            select f from Food f
            where (f.source <> :userSource or f.ownerId = :userId)
              and lower(f.name) like lower(concat('%', :pattern, '%')) escape '\\'
            """)
    Page<Food> searchVisible(@Param("pattern") String pattern, @Param("userId") Long userId,
                             @Param("userSource") Source userSource, Pageable pageable);

    @Query("select f from Food f where f.id = :id and (f.source <> :userSource or f.ownerId = :userId)")
    Optional<Food> findVisible(@Param("id") Long id, @Param("userId") Long userId,
                               @Param("userSource") Source userSource);

    Optional<Food> findByExternalCode(String externalCode);

    List<Food> findByExternalCodeIn(Collection<String> externalCodes);
}
