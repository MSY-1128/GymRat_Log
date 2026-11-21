package com.fitlog.mfds;

import com.fitlog.foodsafety.BarcodeProduct;
import java.util.List;

/**
 * 바코드 조회 결과.
 *
 * @param product 식품안전나라에서 찾은 제품(없으면 null)
 * @param match   REPORT_NO: 품목제조보고번호로 정확히 연결 / NAME: 제품명으로 찾은 후보(확인 필요) /
 *                NO_NUTRITION: 제품은 있으나 영양성분DB에 없음 / NOT_FOUND: 바코드 제품 없음
 * @param items   가져올 수 있는 영양성분 후보(100g 기준)
 */
public record BarcodeLookupResponse(String barcode, BarcodeProduct product, Match match,
                                    List<ExternalFoodResponse> items) {

    public enum Match {
        REPORT_NO, NAME, NO_NUTRITION, NOT_FOUND
    }
}
