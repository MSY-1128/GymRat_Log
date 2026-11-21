package com.fitlog.foodsafety;

import java.util.List;

/**
 * 바코드로 찾은 제품. 영양성분은 없고, 품목제조보고번호로 식약처 영양성분DB와 연결한다.
 *
 * @param reportNo  대표 품목제조보고번호(첫 번째). 없으면 null
 * @param reportNos 같은 바코드에 등록된 보고번호 전체(공장별로 여러 개일 수 있음, 중복 제거·원본 순서)
 * @param source    찾은 서비스(C005: 바코드연계제품정보, I2570: 유통바코드)
 */
public record BarcodeProduct(
        String barcode,
        String productName,
        String makerName,
        String category,
        String reportNo,
        List<String> reportNos,
        String source
) {

    public BarcodeProduct {
        reportNos = reportNos == null ? List.of() : List.copyOf(reportNos);
    }
}
