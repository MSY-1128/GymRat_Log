package com.fitlog.workout;

import com.fitlog.common.ApiException;
import com.fitlog.exercise.Exercise;
import com.fitlog.exercise.ExerciseKind;
import com.fitlog.exercise.ExerciseService;
import com.fitlog.exercise.Intensity;
import com.fitlog.common.Calculator;
import java.math.BigDecimal;
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
     * 운동 종류에 맞는 기록 방식인지, 방식에 필요한 값이 있는지 확인하고 적용할 MET를 정한다.
     * 헬스 종목은 SETS만, 그 밖의 운동은 TIME(시간 + 강도). 강도는 체감 강도·거리·속도 중 하나이며
     * 거리·속도는 속도 곡선이 있는 운동(걷기·달리기·자전거·수영·로잉)만 쓸 수 있다.
     * 이전 형식의 DISTANCE 요청은 시간이 있으면 TIME + 거리로 저장한다.
     */
    static WorkoutDetail detail(Exercise exercise, WorkoutRequest r) {
        WorkoutMode mode = r.mode() == null ? WorkoutMode.TIME : r.mode();
        if (mode == WorkoutMode.DISTANCE) {
            mode = WorkoutMode.TIME;
        }
        Map<String, String> errors = new LinkedHashMap<>();
        boolean strength = exercise.getKind() == ExerciseKind.STRENGTH;
        if (strength && mode != WorkoutMode.SETS) {
            errors.put("mode", "헬스 종목은 세트·횟수·무게로 기록해 주세요.");
        } else if (!strength && mode == WorkoutMode.SETS) {
            errors.put("mode", "이 운동은 시간과 강도로 기록해 주세요.");
        }
        if (mode == WorkoutMode.SETS) {
            require(errors, "sets", r.sets());
            require(errors, "reps", r.reps());
            require(errors, "liftedKg", r.liftedKg());
            fail(errors);
            return WorkoutDetail.sets(r.sets(), r.reps(), r.liftedKg());
        }

        require(errors, "minutes", r.minutes());
        int given = (r.intensity() != null ? 1 : 0) + (r.distanceKm() != null ? 1 : 0) + (r.speedKmh() != null ? 1 : 0);
        if (given > 1) {
            errors.put("intensity", "강도는 체감 강도·거리·속도 중 하나로만 입력해 주세요.");
        } else if ((r.distanceKm() != null || r.speedKmh() != null) && !exercise.speedCapable()) {
            errors.put(r.distanceKm() != null ? "distanceKm" : "speedKmh",
                    "이 운동은 거리·속도로 강도를 정할 수 없어요. 체감 강도로 기록해 주세요.");
        }
        fail(errors);
        int minutes = r.minutes();

        if (r.distanceKm() == null && r.speedKmh() == null) {
            Intensity level = r.intensity() == null ? Intensity.MODERATE : r.intensity();
            return WorkoutDetail.level(minutes, level, exercise.metFor(level));
        }
        IntensityBasis basis = r.distanceKm() != null ? IntensityBasis.DISTANCE : IntensityBasis.SPEED;
        BigDecimal speed = basis == IntensityBasis.DISTANCE
                ? Calculator.speedKmh(r.distanceKm(), minutes) : r.speedKmh();
        BigDecimal km = basis == IntensityBasis.DISTANCE
                ? r.distanceKm() : Calculator.distanceKm(r.speedKmh(), minutes);
        if (speed.compareTo(MIN_SPEED) < 0 || speed.compareTo(MAX_SPEED) > 0) {
            errors.put(basis == IntensityBasis.DISTANCE ? "distanceKm" : "speedKmh",
                    "시간에 비해 거리가 맞지 않아요. 평균 속도가 시속 " + speed.stripTrailingZeros().toPlainString()
                            + "km예요(0.5~80km 범위).");
        } else if (km.signum() <= 0 || km.compareTo(MAX_KM) > 0) {
            errors.put("speedKmh", "거리로 환산하면 0.01~300km 범위를 벗어나요.");
        }
        fail(errors);
        return WorkoutDetail.paced(minutes, basis, km, speed,
                Calculator.metForSpeed(exercise.getSpeedMetCurve(), speed));
    }

    private static final BigDecimal MIN_SPEED = new BigDecimal("0.5");
    private static final BigDecimal MAX_SPEED = new BigDecimal("80");
    private static final BigDecimal MAX_KM = new BigDecimal("300");

    private static void fail(Map<String, String> errors) {
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR", "입력값을 확인해 주세요.", errors);
        }
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
