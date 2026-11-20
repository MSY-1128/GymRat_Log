package com.fitlog.workout;

import com.fitlog.common.ApiException;
import com.fitlog.exercise.Exercise;
import com.fitlog.exercise.ExerciseService;
import com.fitlog.profile.Profile;
import com.fitlog.profile.ProfileService;
import java.time.LocalDate;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkoutService {

    private final ExerciseEntryRepository repository;
    private final ExerciseService exerciseService;
    private final ProfileService profileService;

    public WorkoutService(ExerciseEntryRepository repository, ExerciseService exerciseService,
                          ProfileService profileService) {
        this.repository = repository;
        this.exerciseService = exerciseService;
        this.profileService = profileService;
    }

    @Transactional(readOnly = true)
    public List<WorkoutResponse> list(LocalDate date) {
        return repository.findByDateOrderByIdAsc(date).stream().map(WorkoutResponse::from).toList();
    }

    /** 생성 시 현재 프로필 체중을 snapshot으로 저장. 프로필이 없으면 409 PROFILE_REQUIRED. */
    @Transactional
    public WorkoutResponse create(WorkoutRequest r) {
        Profile profile = profileService.current().orElseThrow(ApiException::profileRequired);
        Exercise exercise = exerciseService.getEntity(r.exerciseId());
        ExerciseEntry entry = repository.save(
                new ExerciseEntry(r.date(), exercise, r.minutes(), profile.getWeightKg()));
        return WorkoutResponse.from(entry);
    }

    @Transactional
    public WorkoutResponse update(Long id, WorkoutRequest r) {
        ExerciseEntry entry = repository.findById(id).orElseThrow(() -> ApiException.notFound("운동 기록"));
        Exercise exercise = exerciseService.getEntity(r.exerciseId());
        entry.update(r.date(), exercise, r.minutes());
        return WorkoutResponse.from(repository.saveAndFlush(entry));
    }

    @Transactional
    public void delete(Long id) {
        ExerciseEntry entry = repository.findById(id).orElseThrow(() -> ApiException.notFound("운동 기록"));
        repository.delete(entry);
    }
}
