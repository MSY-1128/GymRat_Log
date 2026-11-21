package com.fitlog.profile;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileRepository extends JpaRepository<Profile, Long> {

    /** 사용자마다 프로필은 최대 하나(uq_profile_user). */
    Optional<Profile> findByUserId(Long userId);
}
