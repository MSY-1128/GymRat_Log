package com.fitlog.body;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import java.math.BigDecimal;
import java.util.Arrays;
import java.util.Objects;

/** 인바디 부위별 분석(오른팔·왼팔·몸통·오른다리·왼다리, kg). 결과지에 있는 값만 넣는다. */
public final class Segments {

    private Segments() {
    }

    /** 부위별 근육량(제지방량). */
    public record Lean(
            @DecimalMin(value = "0.1", message = "0.1 이상이어야 합니다.")
            @DecimalMax(value = "30", message = "30 이하여야 합니다.")
            @Digits(integer = 2, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
            BigDecimal rightArm,
            @DecimalMin(value = "0.1", message = "0.1 이상이어야 합니다.")
            @DecimalMax(value = "30", message = "30 이하여야 합니다.")
            @Digits(integer = 2, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
            BigDecimal leftArm,
            @DecimalMin(value = "1", message = "1 이상이어야 합니다.")
            @DecimalMax(value = "120", message = "120 이하여야 합니다.")
            @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
            BigDecimal trunk,
            @DecimalMin(value = "0.5", message = "0.5 이상이어야 합니다.")
            @DecimalMax(value = "50", message = "50 이하여야 합니다.")
            @Digits(integer = 2, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
            BigDecimal rightLeg,
            @DecimalMin(value = "0.5", message = "0.5 이상이어야 합니다.")
            @DecimalMax(value = "50", message = "50 이하여야 합니다.")
            @Digits(integer = 2, fraction = 2, message = "소수 둘째 자리까지 입력해 주세요.")
            BigDecimal leftLeg
    ) {
        public static final Lean EMPTY = new Lean(null, null, null, null, null);

        public BigDecimal sum() {
            return Segments.sum(rightArm, leftArm, trunk, rightLeg, leftLeg);
        }

        /** 사지 근육량(팔·다리 4곳 합). 넷 다 있어야 계산한다. */
        public BigDecimal appendicular() {
            if (rightArm == null || leftArm == null || rightLeg == null || leftLeg == null) {
                return null;
            }
            return rightArm.add(leftArm).add(rightLeg).add(leftLeg);
        }
    }

    /** 부위별 체지방량. */
    public record Fat(
            @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
            @DecimalMax(value = "40", message = "40 이하여야 합니다.")
            @Digits(integer = 2, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
            BigDecimal rightArm,
            @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
            @DecimalMax(value = "40", message = "40 이하여야 합니다.")
            @Digits(integer = 2, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
            BigDecimal leftArm,
            @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
            @DecimalMax(value = "150", message = "150 이하여야 합니다.")
            @Digits(integer = 3, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
            BigDecimal trunk,
            @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
            @DecimalMax(value = "60", message = "60 이하여야 합니다.")
            @Digits(integer = 2, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
            BigDecimal rightLeg,
            @DecimalMin(value = "0", message = "0 이상이어야 합니다.")
            @DecimalMax(value = "60", message = "60 이하여야 합니다.")
            @Digits(integer = 2, fraction = 1, message = "소수 첫째 자리까지 입력해 주세요.")
            BigDecimal leftLeg
    ) {
        public static final Fat EMPTY = new Fat(null, null, null, null, null);

        public BigDecimal sum() {
            return Segments.sum(rightArm, leftArm, trunk, rightLeg, leftLeg);
        }
    }

    /** 값이 있는 부위만 더한다. 하나도 없으면 null. */
    static BigDecimal sum(BigDecimal... values) {
        return Arrays.stream(values).filter(Objects::nonNull).reduce(BigDecimal::add).orElse(null);
    }
}
