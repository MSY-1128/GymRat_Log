package com.fitlog.meal;

import com.fitlog.common.ApiException;
import com.fitlog.food.Food;
import com.fitlog.food.FoodService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MealService {

    private final MealEntryRepository repository;
    private final FoodService foodService;

    public MealService(MealEntryRepository repository, FoodService foodService) {
        this.repository = repository;
        this.foodService = foodService;
    }

    @Transactional(readOnly = true)
    public List<MealResponse> list(Long userId, LocalDate date) {
        return repository.findByUserIdAndDateOrderByIdAsc(userId, date).stream().map(MealResponse::from).toList();
    }

    @Transactional
    public MealResponse create(Long userId, MealRequest r) {
        Food food = foodService.getVisible(userId, r.foodId());
        MealEntry entry = repository.save(new MealEntry(userId, r.date(), r.mealType(), food, r.grams()));
        return MealResponse.from(entry);
    }

    @Transactional
    public MealResponse update(Long userId, Long id, MealRequest r) {
        MealEntry entry = find(userId, id);
        Food food = foodService.getVisible(userId, r.foodId());
        entry.update(r.date(), r.mealType(), food, r.grams());
        return MealResponse.from(repository.saveAndFlush(entry));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        repository.delete(find(userId, id));
    }

    private MealEntry find(Long userId, Long id) {
        return repository.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("식단 기록"));
    }
}
