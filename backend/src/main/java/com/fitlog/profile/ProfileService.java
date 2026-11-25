package com.fitlog.profile;

import com.fitlog.body.BodyCompositionRepository;
import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    private final ProfileRepository repository;
    private final BodyCompositionRepository bodyCompositions;

    public ProfileService(ProfileRepository repository, BodyCompositionRepository bodyCompositions) {
        this.repository = repository;
        this.bodyCompositions = bodyCompositions;
    }

    @Transactional(readOnly = true)
    public Optional<ProfileResponse> get(Long userId) {
        return repository.findByUserId(userId).map(p -> toResponse(userId, p));
    }

    @Transactional(readOnly = true)
    public Optional<Profile> current(Long userId) {
        return repository.findByUserId(userId);
    }

    @Transactional
    public ProfileResponse save(Long userId, ProfileRequest r) {
        BigDecimal factor = AllowedActivityFactor.VALUES.stream()
                .filter(v -> v.compareTo(r.activityFactor()) == 0).findFirst().orElseThrow();
        Profile profile = repository.findByUserId(userId)
                .map(p -> {
                    p.update(r.age(), r.sexForFormula(), r.heightCm(), r.weightKg(), factor, r.goal(),
                            r.dailyTargetKcal());
                    return p;
                })
                .orElseGet(() -> new Profile(userId, r.age(), r.sexForFormula(), r.heightCm(), r.weightKg(), factor,
                        r.goal(), r.dailyTargetKcal()));
        profile.updateCalculation(r.bmrMethod(), r.proteinGPerKgLean());
        return toResponse(userId, repository.saveAndFlush(profile));
    }

    /** BMR·단백질 목표는 최근 체성분 측정을 반영해 응답할 때마다 계산한다(저장하지 않음). */
    private ProfileResponse toResponse(Long userId, Profile p) {
        return ProfileResponse.from(p,
                bodyCompositions.findFirstByUserIdAndBodyFatPctNotNullOrderByMeasuredOnDesc(userId).orElse(null),
                bodyCompositions.findFirstByUserIdAndMeasuredBmrKcalNotNullOrderByMeasuredOnDesc(userId)
                        .orElse(null));
    }
}
