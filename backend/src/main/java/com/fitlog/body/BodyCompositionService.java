package com.fitlog.body;

import com.fitlog.common.ApiException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import com.fitlog.profile.Profile;
import com.fitlog.profile.ProfileRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BodyCompositionService {

    /** 한 번에 조회할 수 있는 최대 기간(약 5년). */
    static final int MAX_DAYS = 1830;

    private final BodyCompositionRepository repository;
    private final ProfileRepository profiles;

    public BodyCompositionService(BodyCompositionRepository repository, ProfileRepository profiles) {
        this.repository = repository;
        this.profiles = profiles;
    }

    /** 측정 1건을 결과지 형태로 정형화하고 국제 기준으로 판정한다. 성별·나이·키는 프로필에서 가져온다. */
    @Transactional(readOnly = true)
    public BodyAnalysisResponse analysis(Long userId, Long id) {
        BodyComposition b = find(userId, id);
        Optional<Profile> p = profiles.findByUserId(userId);
        return BodyAnalyzer.analyze(b, p.map(Profile::getSexForFormula).orElse(null),
                p.map(Profile::getAge).orElse(null), p.map(Profile::getHeightCm).orElse(null));
    }

    @Transactional(readOnly = true)
    public List<BodyCompositionResponse> list(Long userId, LocalDate from, LocalDate to) {
        if (from.isAfter(to)) {
            throw ApiException.validation("from", "시작일은 종료일보다 늦을 수 없습니다.");
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DAYS) {
            throw ApiException.validation("to", "조회 기간은 최대 " + MAX_DAYS + "일입니다.");
        }
        return repository.findByUserIdAndMeasuredOnBetweenOrderByMeasuredOnAsc(userId, from, to).stream()
                .map(BodyCompositionResponse::from).toList();
    }

    @Transactional
    public BodyCompositionResponse create(Long userId, BodyCompositionRequest request) {
        BodyCompositionRequest r = normalize(request);
        if (repository.findByUserIdAndMeasuredOn(userId, r.measuredOn()).isPresent()) {
            throw duplicateDate();
        }
        return BodyCompositionResponse.from(repository.saveAndFlush(new BodyComposition(userId, r)));
    }

    @Transactional
    public BodyCompositionResponse update(Long userId, Long id, BodyCompositionRequest request) {
        BodyCompositionRequest r = normalize(request);
        BodyComposition entry = find(userId, id);
        repository.findByUserIdAndMeasuredOn(userId, r.measuredOn())
                .filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw duplicateDate();
                });
        entry.update(r);
        return BodyCompositionResponse.from(repository.saveAndFlush(entry));
    }

    @Transactional
    public void delete(Long userId, Long id) {
        repository.delete(find(userId, id));
    }

    private BodyComposition find(Long userId, Long id) {
        return repository.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("체성분 기록"));
    }

    /** 체지방률과 체지방량이 이 차이(kg)까지는 결과지 반올림 오차로 본다. */
    static final BigDecimal FAT_TOLERANCE_KG = new BigDecimal("1.0");
    /** 체수분 + 단백질 + 무기질 + 체지방량 = 체중(인바디 4성분 모델). 반올림 오차 허용 범위(kg). */
    static final BigDecimal COMPONENT_TOLERANCE_KG = new BigDecimal("1.5");
    /** 부위별 합계가 전체를 이만큼(kg) 넘으면 잘못 입력한 것으로 본다. */
    static final BigDecimal SEGMENT_TOLERANCE_KG = new BigDecimal("1.0");
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    /**
     * 결과지 값을 하나의 형태로 맞춘다.
     * <ol>
     *   <li>체지방률·체지방량 중 하나만 있으면 다른 하나를 계산해 함께 저장(소수 첫째 자리)</li>
     *   <li>둘 다 있으면 체중 × 체지방률과 체지방량이 맞는지 검사</li>
     *   <li>체수분 + 단백질 + 무기질 + 체지방량 ≈ 체중(넷 다 있을 때)</li>
     *   <li>골격근량 &lt; 제지방량, 부위별 합계 ≤ 전체</li>
     * </ol>
     * 맞지 않는 항목은 모두 모아 400(fieldErrors)으로 알려 준다.
     */
    static BodyCompositionRequest normalize(BodyCompositionRequest r) {
        Map<String, String> errors = new LinkedHashMap<>();
        BigDecimal weight = r.weightKg();
        BigDecimal pct = r.bodyFatPct();
        BigDecimal mass = r.bodyFatMassKg();

        if (mass != null && mass.compareTo(weight) >= 0) {
            errors.put("bodyFatMassKg", "체지방량은 체중보다 작아야 해요.");
        } else if (pct != null && mass != null) {
            BigDecimal expected = weight.multiply(pct).divide(HUNDRED, 1, RoundingMode.HALF_UP);
            if (expected.subtract(mass).abs().compareTo(FAT_TOLERANCE_KG) > 0) {
                errors.put("bodyFatMassKg", "체지방량과 체지방률이 맞지 않아요. 체중 × 체지방률 = " + expected.toPlainString()
                        + "kg이에요.");
            }
        } else if (pct != null) {
            mass = weight.multiply(pct).divide(HUNDRED, 1, RoundingMode.HALF_UP);
        } else if (mass != null) {
            pct = mass.multiply(HUNDRED).divide(weight, 1, RoundingMode.HALF_UP);
            if (pct.compareTo(BigDecimal.valueOf(3)) < 0 || pct.compareTo(BigDecimal.valueOf(70)) > 0) {
                errors.put("bodyFatMassKg", "체지방률로 바꾸면 " + pct.toPlainString() + "%라 3~70% 범위를 벗어나요.");
            }
        }

        if (r.bodyWaterL() != null && r.proteinKg() != null && r.mineralKg() != null && mass != null) {
            BigDecimal sum = r.bodyWaterL().add(r.proteinKg()).add(r.mineralKg()).add(mass);
            if (sum.subtract(weight).abs().compareTo(COMPONENT_TOLERANCE_KG) > 0) {
                errors.put("bodyWaterL", "체수분 + 단백질 + 무기질 + 체지방량(" + sum.setScale(1, RoundingMode.HALF_UP)
                        .toPlainString() + "kg)이 체중과 맞지 않아요. 결과지 값을 다시 확인해 주세요.");
            }
        }

        BigDecimal lean = mass == null ? null : weight.subtract(mass);
        BigDecimal muscleLimit = lean != null ? lean : weight;
        if (r.skeletalMuscleKg() != null && r.skeletalMuscleKg().compareTo(muscleLimit) >= 0) {
            errors.put("skeletalMuscleKg", lean != null ? "골격근량은 제지방량(" + lean.toPlainString() + "kg)보다 작아야 해요."
                    : "골격근량은 체중보다 작아야 해요.");
        }
        BigDecimal leanSum = r.segmentalLean().sum();
        if (leanSum != null && leanSum.compareTo(muscleLimit.add(SEGMENT_TOLERANCE_KG)) > 0) {
            errors.put("segmentalLean", "부위별 근육량 합계(" + leanSum.toPlainString() + "kg)가 "
                    + (lean != null ? "제지방량" : "체중") + "보다 커요.");
        }
        BigDecimal fatSum = r.segmentalFat().sum();
        BigDecimal fatLimit = mass != null ? mass : weight;
        if (fatSum != null && fatSum.compareTo(fatLimit.add(SEGMENT_TOLERANCE_KG)) > 0) {
            errors.put("segmentalFat", "부위별 체지방량 합계(" + fatSum.toPlainString() + "kg)가 "
                    + (mass != null ? "체지방량" : "체중") + "보다 커요.");
        }

        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "입력값을 확인해 주세요.", errors);
        }
        return r.withFat(pct, mass);
    }

    private static ApiException duplicateDate() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_DATE",
                "이 날짜에는 이미 기록이 있어요. 기존 기록을 수정해 주세요.",
                Map.of("measuredOn", "이 날짜에는 이미 기록이 있어요."));
    }
}
