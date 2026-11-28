package com.fitlog.body;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * 인바디 결과지 입력. 체중만 필수이고 나머지는 결과지에 있는 값만 넣는다. 범위는 입력 검증용이며 건강 기준이 아니다.
 *
 * <p>순서는 결과지와 같다: 체성분분석(체수분·단백질·무기질·체지방량) → 골격근·지방분석 → 비만분석(체지방률) →
 * 부위별 근육·체지방 → 연구항목(기초대사량·내장지방 레벨·세포외수분비·복부지방률·인바디 점수).
 */
public record BodyCompositionRequest(
        @NotNull(message = "필수 값입니다.")
        LocalDate measuredOn,

        @NotNull(message = "필수 값입니다.")
        @DecimalMin(value = "30", message = "30 이상이어야 합니다.")
        @DecimalMax(value = "350", message = "350 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal weightKg,

        @DecimalMin(value = "10", message = "10 이상이어야 합니다.")
        @DecimalMax(value = "150", message = "150 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal bodyWaterL,

        @DecimalMin(value = "1", message = "1 이상이어야 합니다.")
        @DecimalMax(value = "40", message = "40 이하여야 합니다.")
        @Digits(integer = 2, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal proteinKg,

        @DecimalMin(value = "0.5", message = "0.5 이상이어야 합니다.")
        @DecimalMax(value = "15", message = "15 이하여야 합니다.")
        @Digits(integer = 2, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal mineralKg,

        /* 체지방량과 체지방률은 둘 중 하나만 넣어도 된다(서버가 나머지를 계산). */
        @DecimalMin(value = "1", message = "1 이상이어야 합니다.")
        @DecimalMax(value = "250", message = "250 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal bodyFatMassKg,

        @DecimalMin(value = "5", message = "5 이상이어야 합니다.")
        @DecimalMax(value = "100", message = "100 이하여야 합니다.")
        @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal skeletalMuscleKg,

        @DecimalMin(value = "3", message = "3 이상이어야 합니다.")
        @DecimalMax(value = "70", message = "70 이하여야 합니다.")
        @Digits(integer = 2, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
        BigDecimal bodyFatPct,

        @Valid
        Segments.Lean segmentalLean,

        @Valid
        Segments.Fat segmentalFat,

        @Min(value = 500, message = "500 이상이어야 합니다.")
        @Max(value = 5000, message = "5000 이하여야 합니다.")
        Integer measuredBmrKcal,

        @Min(value = 1, message = "1 이상이어야 합니다.")
        @Max(value = 30, message = "30 이하여야 합니다.")
        Integer visceralFatLevel,

        /* 세포외수분비(ECW/TBW) */
        @DecimalMin(value = "0.300", message = "0.300 이상이어야 합니다.")
        @DecimalMax(value = "0.500", message = "0.500 이하여야 합니다.")
        @Digits(integer = 1, fraction = 3, message = "소수 셋째 자리까지 입력해 주세요.")
        BigDecimal ecwRatio,

        /* 복부지방률(허리-엉덩이 둘레비) */
        @DecimalMin(value = "0.50", message = "0.50 이상이어야 합니다.")
        @DecimalMax(value = "1.50", message = "1.50 이하여야 합니다.")
        @Digits(integer = 1, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
        BigDecimal waistHipRatio,

        @Min(value = 0, message = "0 이상이어야 합니다.")
        @Max(value = 100, message = "100 이하여야 합니다.")
        Integer inbodyScore
) {

    public BodyCompositionRequest {
        segmentalLean = segmentalLean == null ? Segments.Lean.EMPTY : segmentalLean;
        segmentalFat = segmentalFat == null ? Segments.Fat.EMPTY : segmentalFat;
    }

    /** 체중·체지방률 등 기본 항목만 있는 요청. */
    public static BodyCompositionRequest basic(LocalDate measuredOn, BigDecimal weightKg, BigDecimal bodyFatPct,
                                               BigDecimal skeletalMuscleKg, Integer measuredBmrKcal,
                                               Integer visceralFatLevel) {
        return new BodyCompositionRequest(measuredOn, weightKg, null, null, null, null, skeletalMuscleKg, bodyFatPct,
                null, null, measuredBmrKcal, visceralFatLevel, null, null, null);
    }

    /** 정형화한 체지방률·체지방량으로 바꾼 요청. */
    BodyCompositionRequest withFat(BigDecimal pct, BigDecimal massKg) {
        return new BodyCompositionRequest(measuredOn, weightKg, bodyWaterL, proteinKg, mineralKg, massKg,
                skeletalMuscleKg, pct, segmentalLean, segmentalFat, measuredBmrKcal, visceralFatLevel, ecwRatio,
                waistHipRatio, inbodyScore);
    }
}
