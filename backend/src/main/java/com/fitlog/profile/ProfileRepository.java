package com.fitlog.profile;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProfileRepository extends JpaRepository<Profile, Long> {

    /** 단일 사용자 MVP: 가장 먼저 저장된 프로필 한 건만 사용한다. */
    Optional<Profile> findFirstByOrderByIdAsc();
}
