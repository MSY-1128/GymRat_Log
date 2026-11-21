package com.fitlog.food;

import com.fitlog.common.ApiException;
import com.fitlog.common.PageResponse;
import com.fitlog.common.Source;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FoodService {

    private final FoodRepository repository;

    public FoodService(FoodRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public PageResponse<FoodResponse> search(Long userId, String q, int page, int size) {
        String keyword = q == null ? "" : q.strip();
        PageRequest pageable = PageRequest.of(page, size, Sort.by("name").ascending().and(Sort.by("id")));
        return PageResponse.of(repository.searchVisible(escapeLike(keyword), userId, Source.USER, pageable),
                FoodResponse::from);
    }

    @Transactional
    public FoodResponse create(Long userId, FoodRequest r) {
        Food food = Food.userFood(userId, r.name().strip(), r.kcal(), r.carbsG(), r.proteinG(), r.fatG(),
                r.servingGrams());
        return FoodResponse.from(repository.save(food));
    }

    /** 이 사용자가 쓸 수 있는 음식. 다른 사람이 직접 등록한 음식은 없는 것(404)으로 처리한다. */
    @Transactional(readOnly = true)
    public Food getVisible(Long userId, Long id) {
        return repository.findVisible(id, userId, Source.USER).orElseThrow(() -> ApiException.notFound("음식"));
    }

    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
