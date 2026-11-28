-- 무산소·유산소 구분, 시간 운동의 강도별 MET·속도 곡선, 동작 애니메이션 키, 유산소 종목 추가
--
-- 강도 MET(가볍게/보통/힘들게)와 속도 곡선은 Compendium of Physical Activities(성인 참고치)를 바탕으로 한 추정치다.
-- 속도 곡선은 "속도km/h:MET" 점들이며 사이 값은 직선으로 잇는다.
--   걷기 3.2~8.0km/h, 달리기 6.4~19.3km/h, 자전거 12~32km/h, 수영 1.5~4.0km/h(100m 4분~1분30초),
--   로잉머신 9~15km/h(500m 3분20초~2분).

-- ---------- 운동 ----------
ALTER TABLE exercise ADD COLUMN energy_system VARCHAR(10) NOT NULL DEFAULT 'ANAEROBIC'
    CHECK (energy_system IN ('ANAEROBIC', 'AEROBIC', 'MIXED'));
ALTER TABLE exercise ADD COLUMN met_light NUMERIC(5, 2) CHECK (met_light > 0);
ALTER TABLE exercise ADD COLUMN met_vigorous NUMERIC(5, 2) CHECK (met_vigorous > 0);
ALTER TABLE exercise ADD COLUMN speed_met_curve VARCHAR(200);
ALTER TABLE exercise ADD COLUMN motion VARCHAR(40);
ALTER TABLE exercise ADD CONSTRAINT exercise_speed_curve_time_check
    CHECK (speed_met_curve IS NULL OR kind = 'TIME');

CREATE TEMPORARY TABLE time_catalog (
    name VARCHAR(100), energy VARCHAR(10), met_light NUMERIC(5, 2), met NUMERIC(5, 2), met_vigorous NUMERIC(5, 2),
    curve VARCHAR(200), motion VARCHAR(40), sort_order INTEGER
) ON COMMIT DROP;

INSERT INTO time_catalog VALUES
    -- 유산소
    ('걷기',            'AEROBIC',  2.8,  3.5,  5.0, '3.2:2.8,4.0:3.0,4.8:3.5,5.6:4.3,6.4:5.0,7.2:7.0,8.0:8.3', 'walk', 10),
    ('달리기',          'AEROBIC',  6.0,  8.3, 11.0, '6.4:6.0,8.0:8.3,9.7:9.8,11.3:11.0,12.9:11.8,14.5:12.8,16.1:14.5,17.7:16.0,19.3:19.0', 'run', 20),
    ('자전거',          'AEROBIC',  4.0,  6.8, 10.0, '12:4.0,17.5:6.8,20.5:8.0,24:10.0,28:12.0,32:15.8', 'cycle', 30),
    ('실내 사이클',     'AEROBIC',  5.5,  7.0, 10.0, NULL, 'cycle', 35),
    ('수영',            'AEROBIC',  5.8,  8.3,  9.8, '1.5:5.8,2.4:8.3,3.2:9.8,4.0:11.0', 'swim', 40),
    ('로잉머신',        'AEROBIC',  4.8,  7.0, 10.0, '9:4.8,12:7.0,13.3:8.5,15:12.0', 'rower', 45),
    ('천국의계단',      'AEROBIC',  5.0,  7.0,  9.0, NULL, 'stairs', 50),
    ('에어바이크',      'AEROBIC',  5.5,  8.8, 11.0, NULL, 'airbike', 55),
    ('일립티컬',        'AEROBIC',  4.0,  5.0,  7.0, NULL, 'elliptical', 60),
    ('줄넘기',          'AEROBIC',  8.8, 11.8, 12.3, NULL, 'jumpRope', 65),
    ('등산',            'AEROBIC',  5.0,  6.0,  7.8, NULL, 'hike', 70),
    ('계단 오르기',     'AEROBIC',  4.0,  6.0,  8.8, NULL, 'stairs', 75),
    ('인라인 스케이트', 'AEROBIC',  7.5,  9.8, 12.3, NULL, 'skate', 80),
    ('에어로빅',        'AEROBIC',  5.0,  7.3,  9.0, NULL, 'aerobics', 85),
    ('줌바',            'AEROBIC',  5.5,  6.5,  8.0, NULL, 'aerobics', 90),
    ('골프',            'AEROBIC',  3.5,  4.8,  5.5, NULL, 'golf', 95),
    -- 무산소+유산소
    ('테니스',          'MIXED',    5.0,  7.3,  8.0, NULL, 'racket', 110),
    ('스쿼시',          'MIXED',    7.3, 10.0, 12.0, NULL, 'racket', 115),
    ('배드민턴',        'MIXED',    4.5,  5.5,  7.0, NULL, 'racketOverhead', 120),
    ('탁구',            'MIXED',    3.0,  4.0,  5.5, NULL, 'racket', 125),
    ('축구',            'MIXED',    5.0,  7.0, 10.0, NULL, 'kick', 130),
    ('풋살',            'MIXED',    6.0,  8.0, 10.0, NULL, 'kick', 135),
    ('농구',            'MIXED',    4.5,  6.5,  8.0, NULL, 'shoot', 140),
    ('배구',            'MIXED',    3.0,  4.0,  6.0, NULL, 'shoot', 145),
    ('클라이밍',        'MIXED',    5.8,  7.5,  9.0, NULL, 'climb', 150),
    ('복싱',            'MIXED',    5.5,  7.8, 12.8, NULL, 'punch', 155),
    ('킥복싱',          'MIXED',    6.0,  7.3, 10.0, NULL, 'kickStrike', 160),
    ('태권도',          'MIXED',    5.3,  7.5, 10.3, NULL, 'kickStrike', 165),
    ('크로스핏',        'MIXED',    5.5,  8.0, 11.0, NULL, 'burpee', 170),
    ('서킷 트레이닝',   'MIXED',    4.3,  6.0,  8.0, NULL, 'burpee', 175),
    ('버피',            'MIXED',    6.0,  8.0, 10.0, NULL, 'burpee', 180),
    -- 무산소(근지구력·유연성)
    ('요가',            'ANAEROBIC', 2.3, 3.0,  4.0, NULL, 'yoga', 190),
    ('필라테스',        'ANAEROBIC', 2.5, 3.0,  4.0, NULL, 'pilates', 195);

-- 이미 있는 시간 운동은 갱신(과거 기록은 snapshot이라 그대로), 없는 운동은 추가
UPDATE exercise e
SET energy_system = c.energy, met_light = c.met_light, met = c.met, met_vigorous = c.met_vigorous,
    speed_met_curve = c.curve, motion = c.motion, sort_order = c.sort_order, updated_at = now()
FROM time_catalog c
WHERE e.source = 'CATALOG' AND e.kind = 'TIME' AND e.name = c.name;

INSERT INTO exercise (name, met, source, kind, energy_system, met_light, met_vigorous, speed_met_curve, motion,
                      sort_order, created_at, updated_at)
SELECT c.name, c.met, 'CATALOG', 'TIME', c.energy, c.met_light, c.met_vigorous, c.curve, c.motion, c.sort_order,
       now(), now()
FROM time_catalog c
WHERE NOT EXISTS (SELECT 1 FROM exercise e WHERE e.name = c.name AND e.source = 'CATALOG');

-- 사용자·샘플 시간 운동은 강도 MET를 보통 값 기준으로 둔다
UPDATE exercise SET met_light = round(met * 0.75, 2), met_vigorous = round(met * 1.3, 2)
WHERE kind = 'TIME' AND met_light IS NULL;

-- 헬스: 점프·스윙·클라이머·캐리는 무산소+유산소
UPDATE exercise SET energy_system = 'MIXED'
WHERE source = 'CATALOG' AND kind = 'STRENGTH' AND name IN ('점프 스쿼트', '케틀벨 스윙', '마운틴 클라이머', '파머스 워크');

-- 헬스 동작 애니메이션 키(패턴[:변형])
UPDATE exercise e SET motion = m.motion
FROM (VALUES
    ('벤치프레스', 'bench'), ('인클라인 벤치프레스', 'bench:incline'), ('디클라인 벤치프레스', 'bench:decline'),
    ('덤벨 벤치프레스', 'bench'), ('인클라인 덤벨 프레스', 'bench:incline'), ('디클라인 덤벨 프레스', 'bench:decline'),
    ('덤벨 플라이', 'fly'), ('인클라인 덤벨 플라이', 'fly:incline'), ('덤벨 풀오버', 'pullover'),
    ('체스트 프레스 머신', 'chestPress'), ('인클라인 체스트 프레스 머신', 'chestPress:incline'),
    ('펙덱 플라이', 'pecDeck'), ('스미스머신 벤치프레스', 'bench'), ('스미스머신 인클라인 프레스', 'bench:incline'),
    ('케이블 크로스오버', 'cableFly'), ('로우 케이블 플라이', 'cableFly:low'), ('하이 케이블 플라이', 'cableFly:high'),
    ('딥스', 'dip'), ('푸시업', 'pushup'), ('인클라인 푸시업', 'pushup:incline'),
    ('디클라인 푸시업', 'pushup:decline'), ('와이드 푸시업', 'pushup'),
    ('데드리프트', 'deadlift'), ('랙 풀', 'deadlift:rack'), ('바벨 로우', 'row'), ('펜들레이 로우', 'row:pendlay'),
    ('티바 로우', 'row'), ('굿모닝', 'goodMorning'), ('바벨 슈러그', 'shrug'), ('원암 덤벨 로우', 'oneArmRow'),
    ('체스트 서포티드 덤벨 로우', 'supportedRow'), ('덤벨 슈러그', 'shrug'), ('랫풀다운', 'pulldown'),
    ('클로즈그립 랫풀다운', 'pulldown:close'), ('리버스그립 랫풀다운', 'pulldown:close'),
    ('시티드 케이블 로우', 'seatedRow'), ('스트레이트 암 풀다운', 'straightArmPulldown'),
    ('시티드 로우 머신', 'seatedRow'), ('하이 로우 머신', 'seatedRow:high'), ('어시스티드 풀업 머신', 'pullup'),
    ('풀업', 'pullup'), ('친업', 'pullup:close'), ('인버티드 로우', 'invertedRow'), ('백 익스텐션', 'backExtension'),
    ('오버헤드 프레스', 'ohp'), ('비하인드 넥 프레스', 'ohp'), ('푸시 프레스', 'ohp:push'),
    ('업라이트 로우', 'uprightRow'), ('랜드마인 프레스', 'landminePress'), ('덤벨 숄더 프레스', 'ohp:seated'),
    ('아놀드 프레스', 'ohp:seated'), ('사이드 레터럴 레이즈', 'lateralRaise'), ('프론트 레이즈', 'frontRaise'),
    ('리어 델트 플라이', 'rearFly'), ('숄더 프레스 머신', 'ohp:seated'), ('스미스머신 숄더 프레스', 'ohp:seated'),
    ('머신 레터럴 레이즈', 'lateralRaise:seated'), ('리버스 펙덱', 'reversePecDeck'),
    ('케이블 레터럴 레이즈', 'lateralRaise'), ('케이블 프론트 레이즈', 'frontRaise'),
    ('케이블 리어 델트 플라이', 'reversePecDeck:standing'), ('페이스 풀', 'facePull'),
    ('파이크 푸시업', 'pikePushup'), ('핸드스탠드 푸시업', 'handstandPushup'),
    ('스쿼트', 'squat'), ('프론트 스쿼트', 'squat:front'), ('루마니안 데드리프트', 'rdl'),
    ('스티프 레그 데드리프트', 'rdl'), ('스모 데드리프트', 'deadlift:sumo'), ('힙 쓰러스트', 'hipThrust'),
    ('고블릿 스쿼트', 'squat:goblet'), ('불가리안 스플릿 스쿼트', 'splitSquat'), ('런지', 'lunge'),
    ('워킹 런지', 'lunge'), ('스텝업', 'stepUp'), ('덤벨 루마니안 데드리프트', 'rdl'), ('케틀벨 스윙', 'kbSwing'),
    ('레그 프레스', 'legPress'), ('핵 스쿼트', 'hackSquat'), ('스미스머신 스쿼트', 'squat'),
    ('레그 익스텐션', 'legExtension'), ('레그 컬', 'legCurl'), ('시티드 레그 컬', 'seatedLegCurl'),
    ('힙 어브덕션 머신', 'hipAbduction'), ('힙 어덕션 머신', 'hipAdduction'), ('카프 레이즈', 'calfRaise'),
    ('시티드 카프 레이즈', 'seatedCalfRaise'), ('케이블 킥백', 'glutKickback'), ('에어 스쿼트', 'squat:air'),
    ('점프 스쿼트', 'squat:jump'), ('글루트 브릿지', 'glutBridge'), ('노르딕 햄스트링 컬', 'nordic'),
    ('바벨 컬', 'curl'), ('EZ바 컬', 'curl'), ('프리처 컬', 'preacherCurl'), ('리버스 컬', 'curl'),
    ('리스트 컬', 'wristCurl'), ('리버스 리스트 컬', 'wristCurl'), ('클로즈그립 벤치프레스', 'bench'),
    ('라잉 트라이셉스 익스텐션', 'skullCrusher'), ('덤벨 컬', 'curl'), ('해머 컬', 'curl'),
    ('인클라인 덤벨 컬', 'inclineCurl'), ('컨센트레이션 컬', 'concentrationCurl'), ('스파이더 컬', 'preacherCurl'),
    ('덤벨 오버헤드 익스텐션', 'overheadExtension'), ('덤벨 킥백', 'tricepsKickback'), ('파머스 워크', 'farmerWalk'),
    ('케이블 컬', 'curl'), ('트라이셉스 푸시다운', 'pushdown'), ('로프 푸시다운', 'pushdown'),
    ('오버헤드 케이블 익스텐션', 'overheadExtension:cable'), ('벤치 딥스', 'benchDip'),
    ('다이아몬드 푸시업', 'pushup'),
    ('크런치', 'crunch'), ('싯업', 'situp'), ('디클라인 싯업', 'situp:decline'), ('리버스 크런치', 'reverseCrunch'),
    ('바이시클 크런치', 'bicycleCrunch'), ('레그 레이즈', 'legRaise'), ('행잉 레그 레이즈', 'hangingLegRaise'),
    ('행잉 니 레이즈', 'hangingLegRaise:knee'), ('토즈 투 바', 'hangingLegRaise:toes'), ('V업', 'vUp'),
    ('러시안 트위스트', 'russianTwist'), ('플랭크', 'plank'), ('사이드 플랭크', 'sidePlank'),
    ('AB 롤아웃', 'abRollout'), ('마운틴 클라이머', 'mountainClimber'), ('데드버그', 'deadBug'),
    ('덤벨 사이드 벤드', 'sideBend'), ('케이블 크런치', 'cableCrunch'), ('케이블 우드찹', 'woodchop'),
    ('크런치 머신', 'crunch:machine')
) AS m(name, motion)
WHERE e.source = 'CATALOG' AND e.kind = 'STRENGTH' AND e.name = m.name;

-- ---------- 운동 기록 ----------
-- 시간 운동은 강도를 체감 강도(LEVEL)·거리(DISTANCE)·속도(SPEED) 중 하나로 정하고, 정한 MET를 met_snapshot에 둔다.
-- 거리·속도 기록은 둘 다 저장한다(하나를 입력하면 시간으로 나머지를 계산). 이전 시간 기록은 기준이 없다(NULL = 보통).
ALTER TABLE exercise_entry ADD COLUMN intensity_basis VARCHAR(10)
    CHECK (intensity_basis IN ('LEVEL', 'DISTANCE', 'SPEED'));
ALTER TABLE exercise_entry ADD COLUMN intensity VARCHAR(10)
    CHECK (intensity IN ('LIGHT', 'MODERATE', 'VIGOROUS'));
ALTER TABLE exercise_entry ADD COLUMN speed_kmh NUMERIC(5, 2) CHECK (speed_kmh > 0 AND speed_kmh <= 80);

ALTER TABLE exercise_entry DROP CONSTRAINT exercise_entry_mode_fields_check;
ALTER TABLE exercise_entry ADD CONSTRAINT exercise_entry_mode_fields_check CHECK (
    (mode = 'TIME' AND minutes IS NOT NULL AND sets IS NULL AND (
        (intensity_basis IS NULL AND intensity IS NULL AND distance_km IS NULL AND speed_kmh IS NULL)
        OR (intensity_basis = 'LEVEL' AND intensity IS NOT NULL AND distance_km IS NULL AND speed_kmh IS NULL)
        OR (intensity_basis IN ('DISTANCE', 'SPEED') AND intensity IS NULL
            AND distance_km IS NOT NULL AND speed_kmh IS NOT NULL)))
    -- 이전 거리 기록(km당 계수). 새로 만들지는 않는다.
    OR (mode = 'DISTANCE' AND distance_km IS NOT NULL AND kcal_per_kg_km_snapshot IS NOT NULL AND sets IS NULL
        AND intensity_basis IS NULL)
    OR (mode = 'SETS' AND sets IS NOT NULL AND reps IS NOT NULL AND lifted_kg IS NOT NULL
        AND minutes IS NULL AND distance_km IS NULL AND intensity_basis IS NULL)
);
