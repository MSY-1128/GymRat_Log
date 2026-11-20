package com.fitlog.common;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** 클라이언트에 안전하게 노출할 수 있는 코드/메시지만 담는 예외. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final Map<String, String> fieldErrors;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, Map.of());
    }

    public ApiException(HttpStatus status, String code, String message, Map<String, String> fieldErrors) {
        super(message);
        this.status = status;
        this.code = code;
        this.fieldErrors = fieldErrors;
    }

    public static ApiException notFound(String what) {
        return new ApiException(HttpStatus.NOT_FOUND, "NOT_FOUND", what + "을(를) 찾을 수 없습니다.");
    }

    public static ApiException profileRequired() {
        return new ApiException(HttpStatus.CONFLICT, "PROFILE_REQUIRED",
                "운동 기록 전에 설정에서 프로필(체중)을 저장해 주세요.");
    }

    public static ApiException validation(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "입력값을 확인해 주세요.",
                Map.of(field, message));
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public Map<String, String> getFieldErrors() {
        return fieldErrors;
    }
}
