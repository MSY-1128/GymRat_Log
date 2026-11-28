package com.fitlog.body;

import com.fitlog.body.BodyStandards.Judgement;
import com.fitlog.body.BodyStandards.Level;
import com.fitlog.common.SexForFormula;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 측정 1건을 인바디 결과지처럼 묶어 정형화한 분석. 값이 없는 항목은 빠진다.
 *
 * @param groups COMPOSITION(체성분분석) · MUSCLE_FAT(골격근·지방분석) · OBESITY(비만분석) · MUSCLE(근육 지표) ·
 *               SEGMENT_LEAN(부위별 근육) · SEGMENT_FAT(부위별 체지방) · RESEARCH(연구항목)
 */
public record BodyAnalysisResponse(Long id, LocalDate measuredOn, Context context, List<Group> groups) {

    /**
     * @param standardWeightKg BMI 22 기준 표준체중
     * @param missing          판정에 필요한데 프로필에 없는 정보 안내
     */
    public record Context(SexForFormula sex, Integer age, BigDecimal heightCm, BigDecimal standardWeightKg,
                          List<String> missing) {
    }

    public record Group(String key, String title, List<Metric> items) {
    }

    /**
     * @param sharePct   체중에서 차지하는 비율(%). 체성분 항목만
     * @param level      판정(기준이 없거나 정보가 부족하면 null)
     * @param normalLow  정상 범위 아래 끝 · normalHigh 위 끝(없으면 null)
     * @param basis      판정 기준 출처
     */
    public record Metric(String key, String label, String unit, BigDecimal value, BigDecimal sharePct, Level level,
                         String levelLabel, BigDecimal normalLow, BigDecimal normalHigh, String basis) {

        static Metric of(String key, String label, String unit, BigDecimal value) {
            return new Metric(key, label, unit, value, null, null, null, null, null, null);
        }

        static Metric share(String key, String label, String unit, BigDecimal value, BigDecimal sharePct) {
            return new Metric(key, label, unit, value, sharePct, null, null, null, null, null);
        }

        static Metric judged(String key, String label, String unit, BigDecimal value, Judgement j) {
            return j == null ? of(key, label, unit, value)
                    : new Metric(key, label, unit, value, null, j.level(), j.label(), j.normalLow(), j.normalHigh(),
                            j.basis());
        }

        static Metric note(String key, String label, String unit, BigDecimal value, String basis) {
            return new Metric(key, label, unit, value, null, null, null, null, null, basis);
        }
    }
}
