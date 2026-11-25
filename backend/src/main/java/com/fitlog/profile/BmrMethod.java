package com.fitlog.profile;

/**
 * 기초대사량(BMR) 계산 방식.
 *
 * <ul>
 *   <li>FORMULA: Mifflin-St Jeor(키·체중·나이·계산식용 성별)</li>
 *   <li>BODY_FAT: Katch-McArdle(최근 체지방률로 구한 제지방량)</li>
 *   <li>MEASURED: 최근 체성분 측정기의 기초대사량 값</li>
 * </ul>
 * 고른 방식에 필요한 측정값이 없으면 FORMULA로 계산한다.
 */
public enum BmrMethod {
    FORMULA,
    BODY_FAT,
    MEASURED
}
