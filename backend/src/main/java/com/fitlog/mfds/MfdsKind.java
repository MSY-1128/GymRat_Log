package com.fitlog.mfds;

/** 검색 범위. 식약처 API의 DB_CLASS_NM 값에 대응한다. */
public enum MfdsKind {
    /** 전체 */
    ALL(null),
    /** 일반 식품·음식(품목대표) */
    GENERIC("품목대표"),
    /** 브랜드 상품(상용제품) */
    BRAND("상용제품");

    private final String dbClassName;

    MfdsKind(String dbClassName) {
        this.dbClassName = dbClassName;
    }

    public String dbClassName() {
        return dbClassName;
    }
}
