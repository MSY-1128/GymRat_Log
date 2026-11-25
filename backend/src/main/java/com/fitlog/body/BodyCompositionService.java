package com.fitlog.body;

import com.fitlog.common.ApiException;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BodyCompositionService {

    /** 한 번에 조회할 수 있는 최대 기간(약 5년). */
    static final int MAX_DAYS = 1830;

    private final BodyCompositionRepository repository;

    public BodyCompositionService(BodyCompositionRepository repository) {
        this.repository = repository;
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
    public BodyCompositionResponse create(Long userId, BodyCompositionRequest r) {
        validate(r);
        if (repository.findByUserIdAndMeasuredOn(userId, r.measuredOn()).isPresent()) {
            throw duplicateDate();
        }
        return BodyCompositionResponse.from(repository.saveAndFlush(new BodyComposition(userId, r)));
    }

    @Transactional
    public BodyCompositionResponse update(Long userId, Long id, BodyCompositionRequest r) {
        validate(r);
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

    private static void validate(BodyCompositionRequest r) {
        if (r.skeletalMuscleKg() != null && r.weightKg() != null
                && r.skeletalMuscleKg().compareTo(r.weightKg()) >= 0) {
            throw ApiException.validation("skeletalMuscleKg", "골격근량은 체중보다 작아야 합니다.");
        }
    }

    private static ApiException duplicateDate() {
        return new ApiException(HttpStatus.CONFLICT, "DUPLICATE_DATE",
                "이 날짜에는 이미 기록이 있어요. 기존 기록을 수정해 주세요.",
                Map.of("measuredOn", "이 날짜에는 이미 기록이 있어요."));
    }
}
