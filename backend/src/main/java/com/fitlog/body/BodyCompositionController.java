package com.fitlog.body;

import com.fitlog.auth.AuthUser;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/body-compositions")
public class BodyCompositionController {

    private final BodyCompositionService service;

    public BodyCompositionController(BodyCompositionService service) {
        this.service = service;
    }

    /** from~to(포함) 측정 기록, 날짜 오름차순. */
    @GetMapping
    public List<BodyCompositionResponse> list(
            @AuthenticationPrincipal AuthUser user,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return service.list(user.id(), from, to);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public BodyCompositionResponse create(@AuthenticationPrincipal AuthUser user,
                                          @Valid @RequestBody BodyCompositionRequest request) {
        return service.create(user.id(), request);
    }

    @PutMapping("/{id}")
    public BodyCompositionResponse update(@AuthenticationPrincipal AuthUser user, @PathVariable Long id,
                                          @Valid @RequestBody BodyCompositionRequest request) {
        return service.update(user.id(), id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@AuthenticationPrincipal AuthUser user, @PathVariable Long id) {
        service.delete(user.id(), id);
    }
}
