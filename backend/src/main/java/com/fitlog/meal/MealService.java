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
    public List<MealResponse> list(LocalDate date) {
        return repository.findByDateOrderByIdAsc(date).stream().map(MealResponse::from).toList();
    }

    @Transactional
    public MealResponse create(MealRequest r) {
        Food food = foodService.getEntity(r.foodId());
        MealEntry entry = repository.save(new MealEntry(r.date(), r.mealType(), food, r.grams()));
        return MealResponse.from(entry);
    }

    @Transactional
    public MealResponse update(Long id, MealRequest r) {
        MealEntry entry = repository.findById(id).orElseThrow(() -> ApiException.notFound("식단 기록"));
        Food food = foodService.getEntity(r.foodId());
        entry.update(r.date(), r.mealType(), food, r.grams());
        return MealResponse.from(repository.saveAndFlush(entry));
    }

    @Transactional
    public void delete(Long id) {
        MealEntry entry = repository.findById(id).orElseThrow(() -> ApiException.notFound("식단 기록"));
        repository.delete(entry);
    }
}
