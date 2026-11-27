-- 헬스 종목 확장(부위별 20개 안팎)과 종목별 도구·주 근육·보조 근육
--
-- 근육 코드(쉼표 구분): CHEST, FRONT_DELT, SIDE_DELT, REAR_DELT, TRAPS, LATS, MID_BACK, LOWER_BACK,
--   BICEPS, TRICEPS, FOREARMS, ABS, OBLIQUES, GLUTES, QUADS, HAMSTRINGS, ADDUCTORS, CALVES
-- MET는 V5와 같은 기준(다관절 5~6, 단관절·머신 3.5, 맨몸 3.8, 점프·스윙 8.0)의 추정치다.

ALTER TABLE exercise ADD COLUMN equipment VARCHAR(12)
    CHECK (equipment IN ('BARBELL', 'DUMBBELL', 'MACHINE', 'CABLE', 'BODYWEIGHT', 'KETTLEBELL'));
ALTER TABLE exercise ADD COLUMN primary_muscles VARCHAR(200);
ALTER TABLE exercise ADD COLUMN secondary_muscles VARCHAR(200);

CREATE TEMPORARY TABLE strength_catalog (
    name VARCHAR(100), body_part VARCHAR(10), equipment VARCHAR(12), met NUMERIC(4, 1),
    primary_muscles VARCHAR(200), secondary_muscles VARCHAR(200), sort_order INTEGER
) ON COMMIT DROP;

INSERT INTO strength_catalog VALUES
    -- 가슴
    ('벤치프레스',                'CHEST', 'BARBELL',    5.0, 'CHEST', 'FRONT_DELT,TRICEPS', 1010),
    ('인클라인 벤치프레스',       'CHEST', 'BARBELL',    5.0, 'CHEST', 'FRONT_DELT,TRICEPS', 1011),
    ('디클라인 벤치프레스',       'CHEST', 'BARBELL',    5.0, 'CHEST', 'TRICEPS,FRONT_DELT', 1012),
    ('덤벨 벤치프레스',           'CHEST', 'DUMBBELL',   5.0, 'CHEST', 'FRONT_DELT,TRICEPS', 1013),
    ('인클라인 덤벨 프레스',      'CHEST', 'DUMBBELL',   5.0, 'CHEST', 'FRONT_DELT,TRICEPS', 1014),
    ('디클라인 덤벨 프레스',      'CHEST', 'DUMBBELL',   5.0, 'CHEST', 'TRICEPS,FRONT_DELT', 1015),
    ('덤벨 플라이',               'CHEST', 'DUMBBELL',   3.5, 'CHEST', 'FRONT_DELT', 1016),
    ('인클라인 덤벨 플라이',      'CHEST', 'DUMBBELL',   3.5, 'CHEST', 'FRONT_DELT', 1017),
    ('덤벨 풀오버',               'CHEST', 'DUMBBELL',   3.5, 'CHEST', 'LATS,TRICEPS', 1018),
    ('체스트 프레스 머신',        'CHEST', 'MACHINE',    3.5, 'CHEST', 'FRONT_DELT,TRICEPS', 1019),
    ('인클라인 체스트 프레스 머신', 'CHEST', 'MACHINE',  3.5, 'CHEST', 'FRONT_DELT,TRICEPS', 1020),
    ('펙덱 플라이',               'CHEST', 'MACHINE',    3.5, 'CHEST', 'FRONT_DELT', 1021),
    ('스미스머신 벤치프레스',     'CHEST', 'MACHINE',    5.0, 'CHEST', 'FRONT_DELT,TRICEPS', 1022),
    ('스미스머신 인클라인 프레스', 'CHEST', 'MACHINE',   5.0, 'CHEST', 'FRONT_DELT,TRICEPS', 1023),
    ('케이블 크로스오버',         'CHEST', 'CABLE',      3.5, 'CHEST', 'FRONT_DELT', 1024),
    ('로우 케이블 플라이',        'CHEST', 'CABLE',      3.5, 'CHEST', 'FRONT_DELT', 1025),
    ('하이 케이블 플라이',        'CHEST', 'CABLE',      3.5, 'CHEST', 'FRONT_DELT', 1026),
    ('딥스',                      'CHEST', 'BODYWEIGHT', 5.0, 'CHEST,TRICEPS', 'FRONT_DELT', 1027),
    ('푸시업',                    'CHEST', 'BODYWEIGHT', 3.8, 'CHEST', 'FRONT_DELT,TRICEPS,ABS', 1028),
    ('인클라인 푸시업',           'CHEST', 'BODYWEIGHT', 3.8, 'CHEST', 'FRONT_DELT,TRICEPS', 1029),
    ('디클라인 푸시업',           'CHEST', 'BODYWEIGHT', 3.8, 'CHEST', 'FRONT_DELT,TRICEPS', 1030),
    ('와이드 푸시업',             'CHEST', 'BODYWEIGHT', 3.8, 'CHEST', 'FRONT_DELT,TRICEPS', 1031),
    -- 등
    ('데드리프트',                'BACK', 'BARBELL',    6.0, 'LOWER_BACK,GLUTES,HAMSTRINGS', 'TRAPS,QUADS,FOREARMS,LATS', 1110),
    ('랙 풀',                     'BACK', 'BARBELL',    6.0, 'LOWER_BACK,TRAPS', 'GLUTES,HAMSTRINGS,FOREARMS', 1111),
    ('바벨 로우',                 'BACK', 'BARBELL',    5.0, 'LATS,MID_BACK', 'REAR_DELT,BICEPS,LOWER_BACK', 1112),
    ('펜들레이 로우',             'BACK', 'BARBELL',    5.0, 'LATS,MID_BACK', 'REAR_DELT,BICEPS,LOWER_BACK', 1113),
    ('티바 로우',                 'BACK', 'BARBELL',    5.0, 'MID_BACK,LATS', 'REAR_DELT,BICEPS', 1114),
    ('굿모닝',                    'BACK', 'BARBELL',    5.0, 'LOWER_BACK,HAMSTRINGS', 'GLUTES', 1115),
    ('바벨 슈러그',               'BACK', 'BARBELL',    3.5, 'TRAPS', 'FOREARMS', 1116),
    ('원암 덤벨 로우',            'BACK', 'DUMBBELL',   3.5, 'LATS,MID_BACK', 'BICEPS,REAR_DELT', 1117),
    ('체스트 서포티드 덤벨 로우', 'BACK', 'DUMBBELL',   3.5, 'MID_BACK,LATS', 'REAR_DELT,BICEPS', 1118),
    ('덤벨 슈러그',               'BACK', 'DUMBBELL',   3.5, 'TRAPS', 'FOREARMS', 1119),
    ('랫풀다운',                  'BACK', 'CABLE',      3.5, 'LATS', 'BICEPS,MID_BACK,REAR_DELT', 1120),
    ('클로즈그립 랫풀다운',       'BACK', 'CABLE',      3.5, 'LATS', 'BICEPS,MID_BACK', 1121),
    ('리버스그립 랫풀다운',       'BACK', 'CABLE',      3.5, 'LATS,BICEPS', 'MID_BACK', 1122),
    ('시티드 케이블 로우',        'BACK', 'CABLE',      3.5, 'MID_BACK,LATS', 'BICEPS,REAR_DELT', 1123),
    ('스트레이트 암 풀다운',      'BACK', 'CABLE',      3.5, 'LATS', 'TRICEPS,ABS', 1124),
    ('시티드 로우 머신',          'BACK', 'MACHINE',    3.5, 'MID_BACK,LATS', 'BICEPS,REAR_DELT', 1125),
    ('하이 로우 머신',            'BACK', 'MACHINE',    3.5, 'LATS,MID_BACK', 'BICEPS', 1126),
    ('어시스티드 풀업 머신',      'BACK', 'MACHINE',    3.5, 'LATS', 'BICEPS,MID_BACK', 1127),
    ('풀업',                      'BACK', 'BODYWEIGHT', 5.0, 'LATS', 'BICEPS,MID_BACK,FOREARMS', 1128),
    ('친업',                      'BACK', 'BODYWEIGHT', 5.0, 'LATS,BICEPS', 'MID_BACK,FOREARMS', 1129),
    ('인버티드 로우',             'BACK', 'BODYWEIGHT', 3.8, 'MID_BACK,LATS', 'BICEPS,REAR_DELT', 1130),
    ('백 익스텐션',               'BACK', 'BODYWEIGHT', 3.8, 'LOWER_BACK', 'GLUTES,HAMSTRINGS', 1131),
    -- 어깨
    ('오버헤드 프레스',           'SHOULDER', 'BARBELL',    5.0, 'FRONT_DELT,SIDE_DELT', 'TRICEPS,TRAPS,ABS', 1210),
    ('비하인드 넥 프레스',        'SHOULDER', 'BARBELL',    5.0, 'SIDE_DELT,FRONT_DELT', 'TRICEPS,TRAPS', 1211),
    ('푸시 프레스',               'SHOULDER', 'BARBELL',    6.0, 'FRONT_DELT,SIDE_DELT', 'TRICEPS,QUADS,GLUTES', 1212),
    ('업라이트 로우',             'SHOULDER', 'BARBELL',    3.5, 'SIDE_DELT,TRAPS', 'BICEPS,FOREARMS', 1213),
    ('랜드마인 프레스',           'SHOULDER', 'BARBELL',    5.0, 'FRONT_DELT', 'CHEST,TRICEPS', 1214),
    ('덤벨 숄더 프레스',          'SHOULDER', 'DUMBBELL',   5.0, 'FRONT_DELT,SIDE_DELT', 'TRICEPS,TRAPS', 1215),
    ('아놀드 프레스',             'SHOULDER', 'DUMBBELL',   5.0, 'FRONT_DELT,SIDE_DELT', 'TRICEPS', 1216),
    ('사이드 레터럴 레이즈',      'SHOULDER', 'DUMBBELL',   3.5, 'SIDE_DELT', 'TRAPS,FRONT_DELT', 1217),
    ('프론트 레이즈',             'SHOULDER', 'DUMBBELL',   3.5, 'FRONT_DELT', 'SIDE_DELT,CHEST', 1218),
    ('리어 델트 플라이',          'SHOULDER', 'DUMBBELL',   3.5, 'REAR_DELT', 'MID_BACK,TRAPS', 1219),
    ('숄더 프레스 머신',          'SHOULDER', 'MACHINE',    3.5, 'FRONT_DELT,SIDE_DELT', 'TRICEPS', 1220),
    ('스미스머신 숄더 프레스',    'SHOULDER', 'MACHINE',    5.0, 'FRONT_DELT,SIDE_DELT', 'TRICEPS', 1221),
    ('머신 레터럴 레이즈',        'SHOULDER', 'MACHINE',    3.5, 'SIDE_DELT', 'TRAPS', 1222),
    ('리버스 펙덱',               'SHOULDER', 'MACHINE',    3.5, 'REAR_DELT', 'MID_BACK,TRAPS', 1223),
    ('케이블 레터럴 레이즈',      'SHOULDER', 'CABLE',      3.5, 'SIDE_DELT', 'TRAPS', 1224),
    ('케이블 프론트 레이즈',      'SHOULDER', 'CABLE',      3.5, 'FRONT_DELT', 'SIDE_DELT', 1225),
    ('케이블 리어 델트 플라이',   'SHOULDER', 'CABLE',      3.5, 'REAR_DELT', 'MID_BACK', 1226),
    ('페이스 풀',                 'SHOULDER', 'CABLE',      3.5, 'REAR_DELT', 'MID_BACK,TRAPS,SIDE_DELT', 1227),
    ('파이크 푸시업',             'SHOULDER', 'BODYWEIGHT', 3.8, 'FRONT_DELT,SIDE_DELT', 'TRICEPS,CHEST', 1228),
    ('핸드스탠드 푸시업',         'SHOULDER', 'BODYWEIGHT', 5.0, 'FRONT_DELT,SIDE_DELT', 'TRICEPS,TRAPS', 1229),
    -- 하체
    ('스쿼트',                    'LEGS', 'BARBELL',    6.0, 'QUADS,GLUTES', 'ADDUCTORS,HAMSTRINGS,LOWER_BACK', 1310),
    ('프론트 스쿼트',             'LEGS', 'BARBELL',    6.0, 'QUADS', 'GLUTES,ABS,ADDUCTORS', 1311),
    ('루마니안 데드리프트',       'LEGS', 'BARBELL',    5.0, 'HAMSTRINGS,GLUTES', 'LOWER_BACK,FOREARMS', 1312),
    ('스티프 레그 데드리프트',    'LEGS', 'BARBELL',    5.0, 'HAMSTRINGS', 'GLUTES,LOWER_BACK', 1313),
    ('스모 데드리프트',           'LEGS', 'BARBELL',    6.0, 'GLUTES,ADDUCTORS,QUADS', 'HAMSTRINGS,LOWER_BACK,TRAPS', 1314),
    ('힙 쓰러스트',               'LEGS', 'BARBELL',    3.5, 'GLUTES', 'HAMSTRINGS,QUADS', 1315),
    ('고블릿 스쿼트',             'LEGS', 'DUMBBELL',   5.0, 'QUADS,GLUTES', 'ADDUCTORS,ABS', 1316),
    ('불가리안 스플릿 스쿼트',    'LEGS', 'DUMBBELL',   5.0, 'QUADS,GLUTES', 'HAMSTRINGS,ADDUCTORS', 1317),
    ('런지',                      'LEGS', 'DUMBBELL',   5.0, 'QUADS,GLUTES', 'HAMSTRINGS,ADDUCTORS', 1318),
    ('워킹 런지',                 'LEGS', 'DUMBBELL',   5.0, 'QUADS,GLUTES', 'HAMSTRINGS,CALVES', 1319),
    ('스텝업',                    'LEGS', 'DUMBBELL',   5.0, 'QUADS,GLUTES', 'HAMSTRINGS,CALVES', 1320),
    ('덤벨 루마니안 데드리프트',  'LEGS', 'DUMBBELL',   5.0, 'HAMSTRINGS,GLUTES', 'LOWER_BACK', 1321),
    ('케틀벨 스윙',               'LEGS', 'KETTLEBELL', 8.0, 'GLUTES,HAMSTRINGS', 'LOWER_BACK,FRONT_DELT,ABS', 1322),
    ('레그 프레스',               'LEGS', 'MACHINE',    5.0, 'QUADS,GLUTES', 'HAMSTRINGS,ADDUCTORS', 1323),
    ('핵 스쿼트',                 'LEGS', 'MACHINE',    5.0, 'QUADS', 'GLUTES,ADDUCTORS', 1324),
    ('스미스머신 스쿼트',         'LEGS', 'MACHINE',    5.0, 'QUADS,GLUTES', 'HAMSTRINGS', 1325),
    ('레그 익스텐션',             'LEGS', 'MACHINE',    3.5, 'QUADS', NULL, 1326),
    ('레그 컬',                   'LEGS', 'MACHINE',    3.5, 'HAMSTRINGS', 'CALVES', 1327),
    ('시티드 레그 컬',            'LEGS', 'MACHINE',    3.5, 'HAMSTRINGS', NULL, 1328),
    ('힙 어브덕션 머신',          'LEGS', 'MACHINE',    3.5, 'GLUTES', NULL, 1329),
    ('힙 어덕션 머신',            'LEGS', 'MACHINE',    3.5, 'ADDUCTORS', NULL, 1330),
    ('카프 레이즈',               'LEGS', 'MACHINE',    3.5, 'CALVES', NULL, 1331),
    ('시티드 카프 레이즈',        'LEGS', 'MACHINE',    3.5, 'CALVES', NULL, 1332),
    ('케이블 킥백',               'LEGS', 'CABLE',      3.5, 'GLUTES', 'HAMSTRINGS', 1333),
    ('에어 스쿼트',               'LEGS', 'BODYWEIGHT', 3.8, 'QUADS,GLUTES', 'HAMSTRINGS,ADDUCTORS', 1334),
    ('점프 스쿼트',               'LEGS', 'BODYWEIGHT', 8.0, 'QUADS,GLUTES', 'CALVES,HAMSTRINGS', 1335),
    ('글루트 브릿지',             'LEGS', 'BODYWEIGHT', 3.8, 'GLUTES', 'HAMSTRINGS', 1336),
    ('노르딕 햄스트링 컬',        'LEGS', 'BODYWEIGHT', 3.8, 'HAMSTRINGS', 'GLUTES,CALVES', 1337),
    -- 팔
    ('바벨 컬',                   'ARMS', 'BARBELL',    3.5, 'BICEPS', 'FOREARMS', 1410),
    ('EZ바 컬',                   'ARMS', 'BARBELL',    3.5, 'BICEPS', 'FOREARMS', 1411),
    ('프리처 컬',                 'ARMS', 'BARBELL',    3.5, 'BICEPS', 'FOREARMS', 1412),
    ('리버스 컬',                 'ARMS', 'BARBELL',    3.5, 'FOREARMS,BICEPS', NULL, 1413),
    ('리스트 컬',                 'ARMS', 'BARBELL',    3.5, 'FOREARMS', NULL, 1414),
    ('리버스 리스트 컬',          'ARMS', 'BARBELL',    3.5, 'FOREARMS', NULL, 1415),
    ('클로즈그립 벤치프레스',     'ARMS', 'BARBELL',    5.0, 'TRICEPS', 'CHEST,FRONT_DELT', 1416),
    ('라잉 트라이셉스 익스텐션',  'ARMS', 'BARBELL',    3.5, 'TRICEPS', NULL, 1417),
    ('덤벨 컬',                   'ARMS', 'DUMBBELL',   3.5, 'BICEPS', 'FOREARMS', 1418),
    ('해머 컬',                   'ARMS', 'DUMBBELL',   3.5, 'BICEPS,FOREARMS', NULL, 1419),
    ('인클라인 덤벨 컬',          'ARMS', 'DUMBBELL',   3.5, 'BICEPS', 'FOREARMS', 1420),
    ('컨센트레이션 컬',           'ARMS', 'DUMBBELL',   3.5, 'BICEPS', NULL, 1421),
    ('스파이더 컬',               'ARMS', 'DUMBBELL',   3.5, 'BICEPS', NULL, 1422),
    ('덤벨 오버헤드 익스텐션',    'ARMS', 'DUMBBELL',   3.5, 'TRICEPS', NULL, 1423),
    ('덤벨 킥백',                 'ARMS', 'DUMBBELL',   3.5, 'TRICEPS', 'REAR_DELT', 1424),
    ('파머스 워크',               'ARMS', 'DUMBBELL',   5.0, 'FOREARMS,TRAPS', 'ABS,QUADS,GLUTES', 1425),
    ('케이블 컬',                 'ARMS', 'CABLE',      3.5, 'BICEPS', 'FOREARMS', 1426),
    ('트라이셉스 푸시다운',       'ARMS', 'CABLE',      3.5, 'TRICEPS', NULL, 1427),
    ('로프 푸시다운',             'ARMS', 'CABLE',      3.5, 'TRICEPS', NULL, 1428),
    ('오버헤드 케이블 익스텐션',  'ARMS', 'CABLE',      3.5, 'TRICEPS', NULL, 1429),
    ('벤치 딥스',                 'ARMS', 'BODYWEIGHT', 3.8, 'TRICEPS', 'FRONT_DELT,CHEST', 1430),
    ('다이아몬드 푸시업',         'ARMS', 'BODYWEIGHT', 3.8, 'TRICEPS', 'CHEST,FRONT_DELT', 1431),
    -- 복근
    ('크런치',                    'CORE', 'BODYWEIGHT', 3.8, 'ABS', NULL, 1510),
    ('싯업',                      'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'OBLIQUES', 1511),
    ('디클라인 싯업',             'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'OBLIQUES', 1512),
    ('리버스 크런치',             'CORE', 'BODYWEIGHT', 3.8, 'ABS', NULL, 1513),
    ('바이시클 크런치',           'CORE', 'BODYWEIGHT', 3.8, 'ABS,OBLIQUES', NULL, 1514),
    ('레그 레이즈',               'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'OBLIQUES', 1515),
    ('행잉 레그 레이즈',          'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'OBLIQUES,FOREARMS', 1516),
    ('행잉 니 레이즈',            'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'FOREARMS', 1517),
    ('토즈 투 바',                'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'LATS,FOREARMS,OBLIQUES', 1518),
    ('V업',                       'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'OBLIQUES', 1519),
    ('러시안 트위스트',           'CORE', 'BODYWEIGHT', 3.8, 'OBLIQUES', 'ABS', 1520),
    ('플랭크',                    'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'OBLIQUES,FRONT_DELT', 1521),
    ('사이드 플랭크',             'CORE', 'BODYWEIGHT', 3.8, 'OBLIQUES', 'ABS', 1522),
    ('AB 롤아웃',                 'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'LATS,OBLIQUES', 1523),
    ('마운틴 클라이머',           'CORE', 'BODYWEIGHT', 8.0, 'ABS', 'QUADS,FRONT_DELT,OBLIQUES', 1524),
    ('데드버그',                  'CORE', 'BODYWEIGHT', 3.8, 'ABS', 'OBLIQUES', 1525),
    ('덤벨 사이드 벤드',          'CORE', 'DUMBBELL',   3.5, 'OBLIQUES', NULL, 1526),
    ('케이블 크런치',             'CORE', 'CABLE',      3.5, 'ABS', 'OBLIQUES', 1527),
    ('케이블 우드찹',             'CORE', 'CABLE',      3.5, 'OBLIQUES', 'ABS,FRONT_DELT', 1528),
    ('크런치 머신',               'CORE', 'MACHINE',    3.5, 'ABS', NULL, 1529);

-- 이미 있는 카탈로그 종목은 도구·근육·순서만 채운다(MET는 V5 값 유지)
UPDATE exercise e
SET equipment = c.equipment, primary_muscles = c.primary_muscles, secondary_muscles = c.secondary_muscles,
    sort_order = c.sort_order, updated_at = now()
FROM strength_catalog c
WHERE e.source = 'CATALOG' AND e.name = c.name AND e.kind = 'STRENGTH';

INSERT INTO exercise (name, met, source, kind, body_part, equipment, primary_muscles, secondary_muscles,
                      sort_order, created_at, updated_at)
SELECT c.name, c.met, 'CATALOG', 'STRENGTH', c.body_part, c.equipment, c.primary_muscles, c.secondary_muscles,
       c.sort_order, now(), now()
FROM strength_catalog c
WHERE NOT EXISTS (SELECT 1 FROM exercise e WHERE e.name = c.name AND e.source = 'CATALOG');

-- 카탈로그 헬스 종목에는 도구와 주 근육이 반드시 있다
ALTER TABLE exercise ADD CONSTRAINT exercise_catalog_strength_detail_check
    CHECK (source <> 'CATALOG' OR kind = 'TIME' OR (equipment IS NOT NULL AND primary_muscles IS NOT NULL));
