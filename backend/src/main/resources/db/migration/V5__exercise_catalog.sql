-- 운동 종목 카탈로그(헬스 부위별 종목 + 시간·거리 운동)와 세트·거리 기록
--
-- MET 값은 Compendium of Physical Activities(성인 참고치)를 바탕으로 한 추정치다.
-- 헬스 종목: 다관절(스쿼트·데드리프트 등) 5~6, 단관절 3.5, 맨몸 3.8.
-- 거리 계수(kcal/kg/km): 달리기 1.0, 걷기 0.5, 자전거 0.4(시속 15~20km), 수영 2.6(자유형 보통 속도).

-- ---------- 운동 종류 ----------
ALTER TABLE exercise DROP CONSTRAINT exercise_source_check;
ALTER TABLE exercise ADD CONSTRAINT exercise_source_check CHECK (source IN ('DEMO', 'USER', 'CATALOG'));

-- STRENGTH: 헬스(세트×횟수×무게), TIME: 시간(일부는 거리도 가능)
ALTER TABLE exercise ADD COLUMN kind VARCHAR(10) NOT NULL DEFAULT 'TIME'
    CHECK (kind IN ('STRENGTH', 'TIME'));
ALTER TABLE exercise ADD COLUMN body_part VARCHAR(10)
    CHECK (body_part IN ('CHEST', 'BACK', 'SHOULDER', 'LEGS', 'ARMS', 'CORE'));
-- 거리로 기록할 수 있는 운동만 값이 있다
ALTER TABLE exercise ADD COLUMN kcal_per_kg_km NUMERIC(4, 2) CHECK (kcal_per_kg_km > 0);
ALTER TABLE exercise ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 1000;
ALTER TABLE exercise ADD CONSTRAINT exercise_kind_body_part_check
    CHECK ((kind = 'STRENGTH') = (body_part IS NOT NULL));
ALTER TABLE exercise ADD CONSTRAINT exercise_strength_no_distance_check
    CHECK (kind = 'TIME' OR kcal_per_kg_km IS NULL);

-- 기존 샘플 운동(걷기·달리기·자전거)은 카탈로그로 편입하고 거리 계수를 붙인다(과거 기록은 snapshot이라 그대로)
UPDATE exercise SET source = 'CATALOG', sample_id = NULL, kcal_per_kg_km = 0.5, sort_order = 10
    WHERE source = 'DEMO' AND name = '걷기';
UPDATE exercise SET source = 'CATALOG', sample_id = NULL, kcal_per_kg_km = 1.0, sort_order = 20
    WHERE source = 'DEMO' AND name = '달리기';
UPDATE exercise SET source = 'CATALOG', sample_id = NULL, kcal_per_kg_km = 0.4, sort_order = 30
    WHERE source = 'DEMO' AND name = '자전거';

INSERT INTO exercise (name, met, source, kind, body_part, kcal_per_kg_km, sort_order, created_at, updated_at)
SELECT v.name, v.met, 'CATALOG', v.kind, v.body_part, v.per_km, v.sort_order, now(), now()
FROM (VALUES
    -- 시간·거리 운동
    ('걷기',            3.5, 'TIME', NULL, 0.50, 10),
    ('달리기',          8.0, 'TIME', NULL, 1.00, 20),
    ('자전거',          6.0, 'TIME', NULL, 0.40, 30),
    ('수영',            6.0, 'TIME', NULL, 2.60, 40),
    ('테니스',          7.3, 'TIME', NULL, NULL, 50),
    ('클라이밍',        7.5, 'TIME', NULL, NULL, 60),
    ('복싱',            7.8, 'TIME', NULL, NULL, 70),
    ('줄넘기',         11.8, 'TIME', NULL, NULL, 80),
    ('배드민턴',        5.5, 'TIME', NULL, NULL, 90),
    ('탁구',            4.0, 'TIME', NULL, NULL, 100),
    ('축구',            7.0, 'TIME', NULL, NULL, 110),
    ('농구',            6.5, 'TIME', NULL, NULL, 120),
    ('골프',            4.8, 'TIME', NULL, NULL, 130),
    ('등산',            6.0, 'TIME', NULL, NULL, 140),
    ('요가',            2.5, 'TIME', NULL, NULL, 150),
    ('필라테스',        3.0, 'TIME', NULL, NULL, 160),
    -- 헬스: 가슴
    ('벤치프레스',              5.0, 'STRENGTH', 'CHEST', NULL, 1010),
    ('인클라인 덤벨 프레스',    5.0, 'STRENGTH', 'CHEST', NULL, 1020),
    ('체스트 프레스 머신',      3.5, 'STRENGTH', 'CHEST', NULL, 1030),
    ('펙덱 플라이',             3.5, 'STRENGTH', 'CHEST', NULL, 1040),
    ('딥스',                    5.0, 'STRENGTH', 'CHEST', NULL, 1050),
    ('푸시업',                  3.8, 'STRENGTH', 'CHEST', NULL, 1060),
    -- 등
    ('데드리프트',              6.0, 'STRENGTH', 'BACK', NULL, 1110),
    ('바벨 로우',               5.0, 'STRENGTH', 'BACK', NULL, 1120),
    ('랫풀다운',                3.5, 'STRENGTH', 'BACK', NULL, 1130),
    ('시티드 케이블 로우',      3.5, 'STRENGTH', 'BACK', NULL, 1140),
    ('풀업',                    5.0, 'STRENGTH', 'BACK', NULL, 1150),
    -- 어깨
    ('오버헤드 프레스',         5.0, 'STRENGTH', 'SHOULDER', NULL, 1210),
    ('사이드 레터럴 레이즈',    3.5, 'STRENGTH', 'SHOULDER', NULL, 1220),
    ('리어 델트 플라이',        3.5, 'STRENGTH', 'SHOULDER', NULL, 1230),
    ('프론트 레이즈',           3.5, 'STRENGTH', 'SHOULDER', NULL, 1240),
    -- 하체
    ('스쿼트',                  6.0, 'STRENGTH', 'LEGS', NULL, 1310),
    ('레그 프레스',             5.0, 'STRENGTH', 'LEGS', NULL, 1320),
    ('런지',                    5.0, 'STRENGTH', 'LEGS', NULL, 1330),
    ('레그 익스텐션',           3.5, 'STRENGTH', 'LEGS', NULL, 1340),
    ('레그 컬',                 3.5, 'STRENGTH', 'LEGS', NULL, 1350),
    ('카프 레이즈',             3.5, 'STRENGTH', 'LEGS', NULL, 1360),
    -- 팔
    ('바벨 컬',                 3.5, 'STRENGTH', 'ARMS', NULL, 1410),
    ('해머 컬',                 3.5, 'STRENGTH', 'ARMS', NULL, 1420),
    ('트라이셉스 푸시다운',     3.5, 'STRENGTH', 'ARMS', NULL, 1430),
    ('라잉 트라이셉스 익스텐션', 3.5, 'STRENGTH', 'ARMS', NULL, 1440),
    -- 복근
    ('크런치',                  3.8, 'STRENGTH', 'CORE', NULL, 1510),
    ('레그 레이즈',             3.8, 'STRENGTH', 'CORE', NULL, 1520),
    ('케이블 크런치',           3.5, 'STRENGTH', 'CORE', NULL, 1530)
) AS v(name, met, kind, body_part, per_km, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM exercise e WHERE e.name = v.name AND e.source = 'CATALOG');

-- ---------- 운동 기록 ----------
-- TIME: 분 / DISTANCE: km(시간은 선택) / SETS: 세트·횟수·무게
ALTER TABLE exercise_entry ADD COLUMN mode VARCHAR(10) NOT NULL DEFAULT 'TIME'
    CHECK (mode IN ('TIME', 'DISTANCE', 'SETS'));
ALTER TABLE exercise_entry ALTER COLUMN minutes DROP NOT NULL;
ALTER TABLE exercise_entry ADD COLUMN distance_km NUMERIC(5, 2) CHECK (distance_km > 0 AND distance_km <= 300);
ALTER TABLE exercise_entry ADD COLUMN sets INTEGER CHECK (sets BETWEEN 1 AND 50);
ALTER TABLE exercise_entry ADD COLUMN reps INTEGER CHECK (reps BETWEEN 1 AND 100);
-- 맨몸 운동은 0kg
ALTER TABLE exercise_entry ADD COLUMN lifted_kg NUMERIC(5, 1) CHECK (lifted_kg >= 0 AND lifted_kg <= 500);
ALTER TABLE exercise_entry ADD COLUMN kcal_per_kg_km_snapshot NUMERIC(4, 2);
ALTER TABLE exercise_entry ADD CONSTRAINT exercise_entry_mode_fields_check CHECK (
    (mode = 'TIME' AND minutes IS NOT NULL AND distance_km IS NULL AND sets IS NULL)
    OR (mode = 'DISTANCE' AND distance_km IS NOT NULL AND kcal_per_kg_km_snapshot IS NOT NULL AND sets IS NULL)
    OR (mode = 'SETS' AND sets IS NOT NULL AND reps IS NOT NULL AND lifted_kg IS NOT NULL
        AND minutes IS NULL AND distance_km IS NULL)
);
