package com.fitlog.auth;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/** 로그인/가입 요청·응답 DTO. */
public final class AuthRequests {

    private AuthRequests() {
    }

    public record SignupRequest(
            @NotBlank(message = "아이디를 입력해 주세요.")
            @Pattern(regexp = "^[A-Za-z0-9_.-]{3,30}$", message = "영문·숫자·_ . - 로 3~30자 입력해 주세요.")
            String username,

            @NotBlank(message = "비밀번호를 입력해 주세요.")
            @Size(min = 8, max = 64, message = "8~64자로 입력해 주세요.")
            String password
    ) {
    }

    public record LoginRequest(
            @NotBlank(message = "아이디를 입력해 주세요.")
            @Size(max = 30, message = "30자 이하로 입력해 주세요.")
            String username,

            @NotBlank(message = "비밀번호를 입력해 주세요.")
            @Size(max = 64, message = "64자 이하로 입력해 주세요.")
            String password
    ) {
    }

    public record UserResponse(Long id, String username) {

        static UserResponse from(AuthUser u) {
            return new UserResponse(u.id(), u.getUsername());
        }
    }
}
