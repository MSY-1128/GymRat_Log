package com.fitlog.mfds;

import com.fitlog.common.ApiException;
import com.fitlog.food.Food;
import com.fitlog.food.FoodRepository;
import com.fitlog.food.FoodResponse;
import com.fitlog.food.HiddenFoodRepository;
import com.fitlog.foodsafety.BarcodeProduct;
import com.fitlog.foodsafety.FoodSafetyClient;
import com.fitlog.mfds.BarcodeLookupResponse.Match;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MfdsFoodService {

    static final int PAGE_SIZE = 20;
    static final int BARCODE_CANDIDATES = 10;
    static final int MAX_REPORT_TRIES = 3;
    /** 보고번호 검색은 부분 일치라 다른 제품이 섞여 오므로 넉넉히 받아 정확히 같은 것만 고른다. */
    static final int REPORT_ROWS = 30;
    /** 제품명 끝의 중량·수량 표기(예: "황태포5미370g", "콜라 1.5L", "(2입)")는 이름 검색에 방해가 된다. */
    private static final Pattern NAME_NOISE = Pattern.compile(
            "\\([^)]*\\)|\\[[^\\]]*\\]|\\s*\\d+(?:\\.\\d+)?\\s*(?:kg|g|ml|l|개|입|미|봉|팩|매)(?:\\s*[x×*]\\s*\\d+)?\\s*$",
            Pattern.CASE_INSENSITIVE);

    private final MfdsClient client;
    private final MfdsCandidateCache cache;
    private final FoodRepository foods;
    private final FoodSafetyClient foodSafety;
    private final HiddenFoodRepository hidden;

    public MfdsFoodService(MfdsClient client, MfdsCandidateCache cache, FoodRepository foods,
                           FoodSafetyClient foodSafety, HiddenFoodRepository hidden) {
        this.hidden = hidden;
        this.client = client;
        this.cache = cache;
        this.foods = foods;
        this.foodSafety = foodSafety;
    }

    /**
     * 외부 API를 호출하므로 DB 트랜잭션 밖에서 실행한다(이미 가져온 음식 조회만 짧게 수행).
     *
     * @param maker 업체·브랜드명(선택). 외식 프랜차이즈(맥도날드 등)나 제조사로 좁힐 때 쓴다.
     */
    public ExternalFoodPage search(Long userId, String q, int page, MfdsKind kind, String maker) {
        String keyword = q == null ? "" : q.strip();
        String makerName = maker == null ? "" : maker.strip();
        if (keyword.isEmpty() && makerName.isEmpty()) {
            throw ApiException.validation("q", "검색어나 브랜드를 입력해 주세요.");
        }
        MfdsSearchResult raw = client.search(MfdsQuery.byName(keyword, kind.dbClassName(), makerName), page + 1,
                PAGE_SIZE);
        MfdsFoodMapper.Result mapped = MfdsFoodMapper.mapAll(raw.items());
        List<MfdsFoodCandidate> ranked = keyword.isEmpty() ? mapped.candidates()
                : MfdsFoodMapper.rank(keyword, mapped.candidates());
        return new ExternalFoodPage(toResponses(userId, ranked), page, PAGE_SIZE, raw.totalCount(), mapped.excluded());
    }

    /**
     * 바코드 → 식품안전나라 제품(품목제조보고번호) → 식약처 영양성분DB.
     * 보고번호로 연결되지 않으면 제품명으로 상용제품을 찾아 후보로만 보여 준다(사용자가 확인 후 선택).
     */
    public BarcodeLookupResponse lookupBarcode(Long userId, String barcode) {
        Optional<BarcodeProduct> found = foodSafety.findByBarcode(barcode);
        if (found.isEmpty()) {
            return new BarcodeLookupResponse(barcode, null, Match.NOT_FOUND, List.of());
        }
        BarcodeProduct product = found.get();

        // 한 바코드에 공장별 보고번호가 여러 개일 수 있어 차례로 시도한다(외부 호출 상한 MAX_REPORT_TRIES)
        for (String reportNo : product.reportNos().stream().limit(MAX_REPORT_TRIES).toList()) {
            List<MfdsFoodCandidate> exact = MfdsFoodMapper.mapAll(
                    client.search(MfdsQuery.byReportNo(reportNo), 1, REPORT_ROWS).items())
                    .candidates().stream()
                    .filter(c -> hasReportNo(c, reportNo))
                    .toList();
            if (!exact.isEmpty()) {
                return new BarcodeLookupResponse(barcode, product, Match.REPORT_NO, toResponses(userId, exact));
            }
        }

        String name = searchableName(product.productName());
        if (name != null) {
            List<MfdsFoodCandidate> byName = MfdsFoodMapper.rank(name, MfdsFoodMapper.mapAll(
                    client.search(MfdsQuery.byName(name, MfdsKind.BRAND.dbClassName(), null), 1, BARCODE_CANDIDATES)
                            .items()).candidates());
            if (!byName.isEmpty()) {
                return new BarcodeLookupResponse(barcode, product, Match.NAME, toResponses(userId, byName));
            }
        }
        return new BarcodeLookupResponse(barcode, product, Match.NO_NUTRITION, List.of());
    }

    /**
     * 검색 결과를 가져오기용으로 보관하고, 이 사용자가 가져온 음식 ID를 붙인다.
     * 내 음식에서 지운(숨긴) 식품은 가져오지 않은 것으로 보여 다시 '가져와서 선택'할 수 있다.
     */
    private List<ExternalFoodResponse> toResponses(Long userId, List<MfdsFoodCandidate> candidates) {
        cache.putAll(candidates);
        List<Food> found = candidates.isEmpty() ? List.of()
                : foods.findByExternalCodeIn(candidates.stream().map(MfdsFoodCandidate::externalCode).toList());
        Set<Long> hiddenIds = found.isEmpty() ? Set.of()
                : hidden.findHiddenFoodIds(userId, found.stream().map(Food::getId).toList());
        Map<String, Long> imported = found.stream()
                .filter(f -> !hiddenIds.contains(f.getId()))
                .collect(Collectors.toMap(Food::getExternalCode, Food::getId));
        return candidates.stream()
                .map(c -> ExternalFoodResponse.of(c, imported.get(c.externalCode())))
                .toList();
    }

    /**
     * 원본 ITEM_REPORT_NO 검색은 부분 일치이고, 값에 여러 번호가 "a/b/c"로 들어 있다.
     * 그래서 나눠서 정확히 같은 번호가 있을 때만 같은 제품으로 본다.
     */
    static boolean hasReportNo(MfdsFoodCandidate c, String reportNo) {
        if (c.itemReportNo() == null) {
            return false;
        }
        for (String part : c.itemReportNo().split("[/,\\s]+")) {
            if (part.equals(reportNo)) {
                return true;
            }
        }
        return false;
    }

    static String searchableName(String productName) {
        if (productName == null) {
            return null;
        }
        String s = productName;
        for (int i = 0; i < 3; i++) {
            String next = NAME_NOISE.matcher(s).replaceAll("").strip();
            if (next.equals(s)) {
                break;
            }
            s = next;
        }
        if (s.length() > 50) {
            s = s.substring(0, 50).strip();
        }
        return s.length() < 2 ? null : s;
    }

    /**
     * 이미 가져온 식품이면 기존 음식을 돌려준다(중복 저장 없음).
     * 당류·나트륨·포화지방이 비어 있던 예전 음식은 검색 결과가 남아 있으면 그 값으로 채운다.
     */
    @Transactional
    public FoodResponse importFood(Long userId, String externalCode) {
        String code = externalCode.strip();
        return foods.findByExternalCode(code)
                .map(existing -> {
                    if (!existing.getLimits().complete()) {
                        cache.get(code).ifPresent(c -> existing.withLimits(existing.getLimits().orElse(c.limits())));
                    }
                    // 내 목록에서 지웠던 음식을 다시 고르면 되살린다
                    hidden.unhide(userId, existing.getId());
                    return FoodResponse.from(existing);
                })
                .orElseGet(() -> {
                    MfdsFoodCandidate c = cache.get(code).orElseThrow(() -> new ApiException(HttpStatus.CONFLICT,
                            "MFDS_SEARCH_EXPIRED", "검색 결과가 만료되었어요. 식약처 DB에서 다시 검색해 주세요."));
                    Food food = Food.fromMfds(c.name(), c.kcal(), c.carbsG(), c.proteinG(), c.fatG(),
                            c.servingGrams(), c.externalCode(), c.volumeBased()).withLimits(c.limits());
                    return FoodResponse.from(foods.save(food));
                });
    }
}
