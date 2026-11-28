package com.fitlog.body;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

/** 모든 조회는 소유자(userId)로 한정한다. */
public interface BodyCompositionRepository extends JpaRepository<BodyComposition, Long> {

    List<BodyComposition> findByUserIdAndMeasuredOnBetweenOrderByMeasuredOnAsc(Long userId, LocalDate from,
                                                                               LocalDate to);

    Optional<BodyComposition> findByIdAndUserId(Long id, Long userId);

    Optional<BodyComposition> findByUserIdAndMeasuredOn(Long userId, LocalDate measuredOn);

    /** 가장 최근 측정(식단표 기준). */
    Optional<BodyComposition> findFirstByUserIdOrderByMeasuredOnDesc(Long userId);

    /** 체지방률이 있는 가장 최근 측정(제지방량 계산용). */
    Optional<BodyComposition> findFirstByUserIdAndBodyFatPctNotNullOrderByMeasuredOnDesc(Long userId);

    /** 측정 기초대사량이 있는 가장 최근 측정. */
    Optional<BodyComposition> findFirstByUserIdAndMeasuredBmrKcalNotNullOrderByMeasuredOnDesc(Long userId);
}
