package com.fitlog.food;

import com.fitlog.common.ApiException;
import com.fitlog.common.PageResponse;
import com.fitlog.common.Source;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FoodService {

    private final FoodRepository repository;
    private final HiddenFoodRepository hidden;

    public FoodService(FoodRepository repository, HiddenFoodRepository hidden) {
        this.repository = repository;
        this.hidden = hidden;
    }

    /**
     * 내 음식 목록에서 지운다. 내가 직접 등록했고 식단 기록에 쓰이지 않은 음식은 행을 지우고,
     * 식약처에서 가져온 공유 음식이나 지난 기록이 쓰는 음식은 이 사용자에게만 숨긴다(기록은 그대로).
     * 샘플(DEMO) 음식은 지울 수 없다.
     */
    @Transactional
    public void delete(Long userId, Long id) {
        Food food = getVisible(userId, id);
        if (food.getSource() == Source.DEMO) {
            throw new ApiException(HttpStatus.CONFLICT, "DEMO_FOOD", "기본 샘플 음식은 지울 수 없어요.");
        }
        if (food.getSource() == Source.USER && !repository.isUsedByMeals(id)) {
            repository.delete(food);
        } else {
            hidden.hide(userId, id);
        }
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
        if (r.sugarsG() != null && r.sugarsG().compareTo(r.carbsG()) > 0) {
            throw ApiException.validation("sugarsG", "당류는 탄수화물보다 많을 수 없어요.");
        }
        if (r.saturatedFatG() != null && r.saturatedFatG().compareTo(r.fatG()) > 0) {
            throw ApiException.validation("saturatedFatG", "포화지방은 지방보다 많을 수 없어요.");
        }
        Food food = Food.userFood(userId, r.name().strip(), r.kcal(), r.carbsG(), r.proteinG(), r.fatG(),
                r.servingGrams()).withLimits(r.limits());
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
