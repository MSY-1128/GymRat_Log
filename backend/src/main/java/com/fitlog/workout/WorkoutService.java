package com.fitlog.workout;

import com.fitlog.common.ApiException;
import com.fitlog.exercise.Exercise;
import com.fitlog.exercise.ExerciseKind;
import com.fitlog.exercise.ExerciseService;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;
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
    public List<WorkoutResponse> list(Long userId, LocalDate date) {
        return repository.findByUserIdAndDateOrderByIdAsc(userId, date).stream().map(WorkoutResponse::from).toList();
    }

    /** 생성 시 본인 프로필 체중을 snapshot으로 저장. 프로필이 없으면 409 PROFILE_REQUIRED. */
    @Transactional
    public WorkoutResponse create(Long userId, WorkoutRequest r) {
        Profile profile = profileService.current(userId).orElseThrow(ApiException::profileRequired);
        Exercise exercise = exerciseService.getEntity(r.exerciseId());
        ExerciseEntry entry = repository.save(
                new ExerciseEntry(userId, r.date(), exercise, detail(exercise, r), profile.getWeightKg()));
        return WorkoutResponse.from(entry);
    }

    @Transactional
    public WorkoutResponse update(Long userId, Long id, WorkoutRequest r) {
        ExerciseEntry entry = find(userId, id);
        Exercise exercise = exerciseService.getEntity(r.exerciseId());
        entry.update(r.date(), exercise, detail(exercise, r));
        return WorkoutResponse.from(repository.saveAndFlush(entry));
    }

    /**
     * 운동 종류에 맞는 기록 방식인지, 방식에 필요한 값이 있는지 확인한다.
     * 헬스 종목은 SETS만, 그 밖의 운동은 TIME 또는 (거리 계수가 있으면) DISTANCE.
     */
    static WorkoutDetail detail(Exercise exercise, WorkoutRequest r) {
        WorkoutMode mode = r.mode() == null ? WorkoutMode.TIME : r.mode();
        Map<String, String> errors = new LinkedHashMap<>();
        boolean strength = exercise.getKind() == ExerciseKind.STRENGTH;
        if (strength && mode != WorkoutMode.SETS) {
            errors.put("mode", "헬스 종목은 세트·횟수·무게로 기록해 주세요.");
        } else if (!strength && mode == WorkoutMode.SETS) {
            errors.put("mode", "이 운동은 시간이나 거리로 기록해 주세요.");
        } else if (mode == WorkoutMode.DISTANCE && !exercise.distanceCapable()) {
            errors.put("distanceKm", "이 운동은 거리로 기록할 수 없어요. 시간으로 기록해 주세요.");
        }
        switch (mode) {
            case TIME -> require(errors, "minutes", r.minutes());
            case DISTANCE -> require(errors, "distanceKm", r.distanceKm());
            case SETS -> {
                require(errors, "sets", r.sets());
                require(errors, "reps", r.reps());
                require(errors, "liftedKg", r.liftedKg());
            }
        }
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "입력값을 확인해 주세요.", errors);
        }
        return switch (mode) {
            case TIME -> WorkoutDetail.time(r.minutes());
            case DISTANCE -> WorkoutDetail.distance(r.distanceKm(), r.minutes());
            case SETS -> WorkoutDetail.sets(r.sets(), r.reps(), r.liftedKg());
        };
    }

    private static void require(Map<String, String> errors, String field, Object value) {
        if (value == null) {
            errors.putIfAbsent(field, "필수 값입니다.");
        }
    }

    @Transactional
    public void delete(Long userId, Long id) {
        repository.delete(find(userId, id));
    }

    private ExerciseEntry find(Long userId, Long id) {
        return repository.findByIdAndUserId(id, userId).orElseThrow(() -> ApiException.notFound("운동 기록"));
    }
}
