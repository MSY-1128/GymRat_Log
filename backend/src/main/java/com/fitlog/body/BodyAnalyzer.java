package com.fitlog.body;

import com.fitlog.body.BodyAnalysisResponse.Context;
import com.fitlog.body.BodyAnalysisResponse.Group;
import com.fitlog.body.BodyAnalysisResponse.Metric;
import com.fitlog.common.SexForFormula;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/** 측정값 + 프로필(성별·나이·키) → 결과지 형태의 정형화된 분석. */
final class BodyAnalyzer {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private BodyAnalyzer() {
    }

    static BodyAnalysisResponse analyze(BodyComposition b, SexForFormula sex, Integer age, BigDecimal heightCm) {
        List<String> missing = new ArrayList<>();
        if (heightCm == null) {
            missing.add("프로필에 키가 없어 BMI·체지방량지수·사지근육지수를 계산하지 않았어요.");
        }
        if (sex == null) {
            missing.add("프로필에 성별이 없어 체지방률·복부지방률·사지근육지수는 판정하지 않았어요.");
        }
        if (age != null && age < 18) {
            missing.add("체지방률 기준은 성인(18세 이상)용이라 판정하지 않았어요.");
        }
        Context context = new Context(sex, age, heightCm, BodyStandards.standardWeight(heightCm), missing);

        BigDecimal w = b.getWeightKg();
        BigDecimal fat = b.getBodyFatMassKg();
        BigDecimal lean = b.getLeanMassKg();
        List<Group> groups = new ArrayList<>();

        add(groups, "COMPOSITION", "체성분분석", List.of(
                share("bodyWater", "체수분", "L", b.getBodyWaterL(), w),
                share("protein", "단백질", "kg", b.getProteinKg(), w),
                share("mineral", "무기질", "kg", b.getMineralKg(), w),
                share("fatMass", "체지방량", "kg", fat, w),
                share("leanMass", "제지방량", "kg", lean, w)));

        add(groups, "MUSCLE_FAT", "골격근·지방분석", List.of(
                Metric.of("weight", "체중", "kg", w),
                share("skeletalMuscle", "골격근량", "kg", b.getSkeletalMuscleKg(), w),
                share("fatMass", "체지방량", "kg", fat, w)));

        BigDecimal bmi = BodyStandards.perHeightSquared(w, heightCm);
        BigDecimal fmi = BodyStandards.perHeightSquared(fat, heightCm);
        add(groups, "OBESITY", "비만분석", List.of(
                judged("bmi", "BMI", "kg/m²", bmi, BodyStandards.bmi(bmi)),
                judged("bodyFatPct", "체지방률", "%", b.getBodyFatPct(), BodyStandards.bodyFatPct(sex, age,
                        b.getBodyFatPct())),
                judged("fatMassIndex", "체지방량지수(FMI)", "kg/m²", fmi, BodyStandards.fatMassIndex(sex, fmi)),
                judged("waistHipRatio", "복부지방률", "", b.getWaistHipRatio(), BodyStandards.waistHipRatio(sex,
                        b.getWaistHipRatio())),
                judged("visceralFatLevel", "내장지방 레벨", "", toDecimal(b.getVisceralFatLevel()),
                        BodyStandards.visceralFatLevel(b.getVisceralFatLevel()))));

        BigDecimal asm = b.getSegmentalLean().appendicular();
        BigDecimal asmi = BodyStandards.perHeightSquared(asm, heightCm);
        add(groups, "MUSCLE", "근육 지표", List.of(
                Metric.of("fatFreeMassIndex", "제지방량지수(FFMI)", "kg/m²", BodyStandards.perHeightSquared(lean,
                        heightCm)),
                Metric.of("appendicularLean", "사지 근육량", "kg", asm),
                judged("appendicularMuscleIndex", "사지근육지수(ASMI)", "kg/m²", asmi,
                        BodyStandards.appendicularMuscleIndex(sex, asmi))));

        Segments.Lean sl = b.getSegmentalLean();
        add(groups, "SEGMENT_LEAN", "부위별 근육", List.of(
                Metric.of("rightArm", "오른팔", "kg", sl.rightArm()),
                Metric.of("leftArm", "왼팔", "kg", sl.leftArm()),
                Metric.of("trunk", "몸통", "kg", sl.trunk()),
                Metric.of("rightLeg", "오른다리", "kg", sl.rightLeg()),
                Metric.of("leftLeg", "왼다리", "kg", sl.leftLeg()),
                Metric.note("armBalance", "팔 좌우 차이", "%", balance(sl.rightArm(), sl.leftArm()),
                        "큰 쪽 대비 차이. 정해진 국제 기준은 없어요"),
                Metric.note("legBalance", "다리 좌우 차이", "%", balance(sl.rightLeg(), sl.leftLeg()),
                        "큰 쪽 대비 차이. 정해진 국제 기준은 없어요")));

        Segments.Fat sf = b.getSegmentalFat();
        add(groups, "SEGMENT_FAT", "부위별 체지방", List.of(
                Metric.of("rightArm", "오른팔", "kg", sf.rightArm()),
                Metric.of("leftArm", "왼팔", "kg", sf.leftArm()),
                Metric.of("trunk", "몸통", "kg", sf.trunk()),
                Metric.of("rightLeg", "오른다리", "kg", sf.rightLeg()),
                Metric.of("leftLeg", "왼다리", "kg", sf.leftLeg())));

        add(groups, "RESEARCH", "연구항목", List.of(
                Metric.of("measuredBmr", "기초대사량(측정)", "kcal", toDecimal(b.getMeasuredBmrKcal())),
                Metric.note("leanBmr", "기초대사량(제지방 공식)", "kcal",
                        lean == null ? null : BigDecimal.valueOf(370).add(new BigDecimal("21.6").multiply(lean))
                                .setScale(0, RoundingMode.HALF_UP),
                        "Katch-McArdle: 370 + 21.6 × 제지방량"),
                judged("ecwRatio", "세포외수분비", "", b.getEcwRatio(), BodyStandards.ecwRatio(b.getEcwRatio())),
                Metric.of("inbodyScore", "인바디 점수", "점", toDecimal(b.getInbodyScore()))));

        return new BodyAnalysisResponse(b.getId(), b.getMeasuredOn(), context, groups);
    }

    private static Metric share(String key, String label, String unit, BigDecimal value, BigDecimal weight) {
        return Metric.share(key, label, unit, value,
                value == null ? null : value.multiply(HUNDRED).divide(weight, 1, RoundingMode.HALF_UP));
    }

    private static Metric judged(String key, String label, String unit, BigDecimal value,
                                 BodyStandards.Judgement j) {
        return Metric.judged(key, label, unit, value, j);
    }

    /** |오른쪽 − 왼쪽| ÷ 큰 쪽 × 100. 둘 다 있어야 계산. */
    static BigDecimal balance(BigDecimal right, BigDecimal left) {
        if (right == null || left == null) {
            return null;
        }
        BigDecimal max = right.max(left);
        return max.signum() == 0 ? BigDecimal.ZERO
                : right.subtract(left).abs().multiply(HUNDRED).divide(max, 1, RoundingMode.HALF_UP);
    }

    private static BigDecimal toDecimal(Integer v) {
        return v == null ? null : BigDecimal.valueOf(v);
    }

    /** 값이 있는 항목만 남기고, 남은 항목이 없으면 묶음을 뺀다. */
    private static void add(List<Group> groups, String key, String title, List<Metric> items) {
        List<Metric> present = items.stream().filter(m -> m.value() != null).toList();
        if (!present.isEmpty()) {
            groups.add(new Group(key, title, present));
        }
    }
}
