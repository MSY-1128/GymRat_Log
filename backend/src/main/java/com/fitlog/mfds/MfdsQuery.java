package com.fitlog.mfds;

/**
 * 식약처 식품영양성분DB 검색 조건. null인 조건은 요청에 넣지 않는다.
 *
 * <p>실제 API(2026-11 확인)가 걸러 주는 파라미터: FOOD_NM_KR(부분 일치), DB_CLASS_NM, MAKER_NM, ITEM_REPORT_NO.
 * DB_GRP_NM(음식/가공식품)은 무시되므로 조건으로 쓰지 않는다.
 *
 * @param foodName     식품명(부분 일치)
 * @param dbClassName  품목대표/상용제품
 * @param makerName    업체·브랜드명(예: 맥도날드)
 * @param itemReportNo 품목제조보고번호(바코드 조회 결과와 연결)
 */
public record MfdsQuery(String foodName, String dbClassName, String makerName, String itemReportNo) {

    public static MfdsQuery byName(String foodName, String dbClassName, String makerName) {
        return new MfdsQuery(blankToNull(foodName), dbClassName, blankToNull(makerName), null);
    }

    public static MfdsQuery byReportNo(String itemReportNo) {
        return new MfdsQuery(null, null, null, itemReportNo);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
