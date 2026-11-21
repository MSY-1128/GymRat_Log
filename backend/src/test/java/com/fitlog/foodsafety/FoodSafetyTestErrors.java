package com.fitlog.foodsafety;

import com.fitlog.common.ApiException;

/** 다른 패키지 테스트에서 클라이언트와 같은 오류를 만들기 위한 도우미. */
public final class FoodSafetyTestErrors {

    private FoodSafetyTestErrors() {
    }

    public static ApiException unavailable() {
        return FoodSafetyClient.unavailable();
    }
}
