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
    public PageResponse<FoodResponse> search(String q, int page, int size) {
        String keyword = q == null ? "" : q.strip();
        PageRequest pageable = PageRequest.of(page, size, Sort.by("name").ascending().and(Sort.by("id")));
        return PageResponse.of(repository.findByNameContainingIgnoreCase(keyword, pageable), FoodResponse::from);
    }

    @Transactional
    public FoodResponse create(FoodRequest r) {
        Food food = new Food(r.name().strip(), r.kcal(), r.carbsG(), r.proteinG(), r.fatG(), r.servingGrams(),
                Source.USER, null);
        return FoodResponse.from(repository.save(food));
    }

    @Transactional(readOnly = true)
    public Food getEntity(Long id) {
        return repository.findById(id).orElseThrow(() -> ApiException.notFound("음식"));
    }
}
