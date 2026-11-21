package com.fitlog.profile;

import com.fitlog.auth.AuthUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/profile")
public class ProfileController {

    private final ProfileService service;

    public ProfileController(ProfileService service) {
        this.service = service;
    }

    /** 프로필이 없으면 204. */
    @GetMapping
    public ResponseEntity<ProfileResponse> get(@AuthenticationPrincipal AuthUser user) {
        return service.get(user.id()).map(ResponseEntity::ok).orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping
    public ProfileResponse put(@AuthenticationPrincipal AuthUser user, @Valid @RequestBody ProfileRequest request) {
        return service.save(user.id(), request);
    }
}
