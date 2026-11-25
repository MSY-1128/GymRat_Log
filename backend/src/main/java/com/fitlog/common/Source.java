package com.fitlog.common;

/**
 * 데이터 출처. DEMO는 data.json 샘플, USER는 사용자가 직접 등록한 값, MFDS는 식약처 식품영양성분DB에서 가져온 값,
 * CATALOG는 앱에 기본 포함된 운동 종목(MET는 Compendium of Physical Activities 기반 추정치).
 */
public enum Source {
    DEMO,
    USER,
    MFDS,
    CATALOG
}
