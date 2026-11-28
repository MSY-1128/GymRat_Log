package com.fitlog.food;

import com.fitlog.auth.AuthUser;
import com.fitlog.common.PageResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/foods")
public class FoodController {

    private final FoodService service;

    public FoodController(FoodService service) {
        this.service = service;
    }

    @GetMapping
    public PageResponse<FoodResponse> search(
            @AuthenticationPrincipal AuthUser user,
            @RequestParam(defaultValue = "") @Size(max = 50, message = "검색어는 50자 이하로 입력해 주세요.") String q,
            @RequestParam(defaultValue = "0") @Min(value = 0, message = "0 이상이어야 합니다.")
            @Max(value = 10000, message = "10000 이하여야 합니다.") int page,
            @RequestParam(defaultValue = "20") @Min(value = 1, message = "1 이상이어야 합니다.")
            @Max(value = 50, message = "50 이하여야 합니다.") int size) {
        return service.search(user.id(), q, page, size);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public FoodResponse create(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody FoodRequest request) {
        return service.create(user.id(), request);
    }

    /** 내 음식 목록에서 지운다(지난 식단 기록은 그대로). */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        service.delete(user.id(), id);
    }
}
