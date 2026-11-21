package com.fitlog.profile;

import java.math.BigDecimal;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProfileService {

    private final ProfileRepository repository;

    public ProfileService(ProfileRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Optional<ProfileResponse> get(Long userId) {
        return repository.findByUserId(userId).map(ProfileResponse::from);
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
        return ProfileResponse.from(repository.saveAndFlush(profile));
    }
}
