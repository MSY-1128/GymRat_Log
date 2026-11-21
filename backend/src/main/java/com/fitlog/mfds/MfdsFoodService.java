package com.fitlog.mfds;

import com.fitlog.common.ApiException;
import com.fitlog.food.Food;
import com.fitlog.food.FoodRepository;
import com.fitlog.food.FoodResponse;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MfdsFoodService {

    static final int PAGE_SIZE = 20;

    private final MfdsClient client;
    private final MfdsCandidateCache cache;
    private final FoodRepository foods;

    public MfdsFoodService(MfdsClient client, MfdsCandidateCache cache, FoodRepository foods) {
        this.client = client;
        this.cache = cache;
        this.foods = foods;
    }

    /** 외부 API를 호출하므로 DB 트랜잭션 밖에서 실행한다(이미 가져온 음식 조회만 짧게 수행). */
    public ExternalFoodPage search(String q, int page, MfdsKind kind) {
        String keyword = q == null ? "" : q.strip();
        if (keyword.isEmpty()) {
            throw ApiException.validation("q", "검색어를 입력해 주세요.");
        }
        MfdsSearchResult raw = client.search(keyword, kind.dbClassName(), page + 1, PAGE_SIZE);
        MfdsFoodMapper.Result mapped = MfdsFoodMapper.mapAll(raw.items());
        List<MfdsFoodCandidate> ranked = MfdsFoodMapper.rank(keyword, mapped.candidates());
        cache.putAll(ranked);

        Map<String, Long> imported = ranked.isEmpty() ? Map.of()
                : foods.findByExternalCodeIn(ranked.stream().map(MfdsFoodCandidate::externalCode).toList())
                        .stream().collect(Collectors.toMap(Food::getExternalCode, Food::getId));
        List<ExternalFoodResponse> items = ranked.stream()
                .map(c -> ExternalFoodResponse.of(c, imported.get(c.externalCode())))
                .toList();
        return new ExternalFoodPage(items, page, PAGE_SIZE, raw.totalCount(), mapped.excluded());
    }

    /** 이미 가져온 식품이면 기존 음식을 돌려준다(중복 저장 없음). */
    @Transactional
    public FoodResponse importFood(String externalCode) {
        String code = externalCode.strip();
        return foods.findByExternalCode(code)
                .map(FoodResponse::from)
                .orElseGet(() -> {
                    MfdsFoodCandidate c = cache.get(code).orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                            "MFDS_SEARCH_EXPIRED", "검색 결과가 만료되었어요. 식약처 DB에서 다시 검색해 주세요."));
                    Food food = Food.fromMfds(c.name(), c.kcal(), c.carbsG(), c.proteinG(), c.fatG(),
                            c.servingGrams(), c.externalCode(), c.volumeBased());
                    return FoodResponse.from(foods.save(food));
                });
    }
}
