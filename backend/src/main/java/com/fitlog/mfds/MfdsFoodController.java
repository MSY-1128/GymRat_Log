package com.fitlog.mfds;

import com.fitlog.auth.AuthUser;
import com.fitlog.food.FoodResponse;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** 식약처 식품영양성분DB 검색·가져오기. 서비스키는 서버에만 있다. */
@Validated
@RestController
@RequestMapping("/api/v1/foods")
public class MfdsFoodController {

    private final MfdsFoodService service;

    public MfdsFoodController(MfdsFoodService service) {
        this.service = service;
    }

    @GetMapping("/external")
    public ExternalFoodPage search(
            @RequestParam(defaultValue = "") @Size(max = 50, message = "검색어는 50자 이하로 입력해 주세요.") String q,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "0 이상이어야 합니다.")
            @Max(value = 999, message = "999 이하여야 합니다.") int page,
            @RequestParam(defaultValue = "GENERIC") MfdsKind kind,
            @RequestParam(defaultValue = "") @Size(max = 30, message = "브랜드는 30자 이하로 입력해 주세요.") String maker) {
        return service.search(q, page, kind, maker);
    }

    /** 바코드(EAN-8/13, UPC-A, GTIN-14 등 숫자 8~14자리) → 영양성분 후보. */
    @GetMapping("/barcode/{code}")
    public BarcodeLookupResponse barcode(
            @PathVariable @Pattern(regexp = "\\d{8,14}", message = "바코드는 숫자 8~14자리로 입력해 주세요.") String code) {
        return service.lookupBarcode(code);
    }

    @PostMapping("/import")
    public FoodResponse importFood(@AuthenticationPrincipal AuthUser user,
                                   @Valid @RequestBody ImportFoodRequest request) {
        return service.importFood(user.id(), request.externalCode());
    }
}
