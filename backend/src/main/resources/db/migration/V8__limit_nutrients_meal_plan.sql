-- 당류·나트륨·포화지방(100g 기준). 값을 모르면 NULL(0과 구분한다).
ALTER TABLE food ADD COLUMN sugars_g        NUMERIC(7, 2) CHECK (sugars_g BETWEEN 0 AND 100);
ALTER TABLE food ADD COLUMN sodium_mg       NUMERIC(8, 2) CHECK (sodium_mg BETWEEN 0 AND 40000);
ALTER TABLE food ADD COLUMN saturated_fat_g NUMERIC(7, 2) CHECK (saturated_fat_g BETWEEN 0 AND 100);

ALTER TABLE meal_entry ADD COLUMN sugars_per100_snapshot        NUMERIC(7, 2);
ALTER TABLE meal_entry ADD COLUMN sodium_per100_snapshot        NUMERIC(8, 2);
ALTER TABLE meal_entry ADD COLUMN saturated_fat_per100_snapshot NUMERIC(7, 2);

-- 식단표 기본 식품: 식약처 식품영양성분DB 원본값(2026-11-28 조회, 100g 기준).
-- 이미 가져온 식품이면 비어 있던 당류·나트륨·포화지방만 채운다.
CREATE TEMPORARY TABLE plan_seed (
    code VARCHAR(50), name VARCHAR(100), kcal NUMERIC, carbs NUMERIC, protein NUMERIC, fat NUMERIC,
    sugars NUMERIC, sodium NUMERIC, sat NUMERIC
) ON COMMIT DROP;

INSERT INTO plan_seed VALUES
    ('R101-008000349-0000', '멥쌀, 백미, 밥', 152, 32.86, 2.61, 0.38, 0.01, 1, 0.13),
    ('R101-013000500-0000', '멥쌀, 현미, 발아현미, 밥', 178, 37.02, 4.05, 1.38, 0.38, 0, 0.31),
    ('R101-049000100-0001', '귀리, 쌀귀리, 도정, 밥', 218, 36.53, 6.51, 5.36, 0.42, 1, 0.86),
    ('R101-001000000-0000', '귀리, 오트밀', 382, 64.90, 13.20, 8.20, NULL, 4, NULL),
    ('D107-128180000-0001', '고구마_찐고구마', 139, 32.47, 1.67, 0.24, 16.32, 10, 0.05),
    ('D107-307170000-0001', '감자_찐감자', 70, 15.01, 2.16, 0.16, 0.86, 3, 0.03),
    ('D302-100380000-0001', '식빵_통밀식빵', 279, 48.64, 9.33, 5.26, 4.49, 660, 2.67),
    ('R109-008000451-0000', '닭고기, 가슴, 구운것(팬)', 164, 0, 35.47, 1.48, 0, 61, 0.58),
    ('R109-014008751-0000', '돼지고기, 안심, 구운것(팬)', 172, 0, 30.23, 4.76, 0, 57, 1.74),
    ('R109-027066201-0000', '소고기, 한우(1등급), 우둔, 생것', 162, 0, 23.00, 6.92, 0, 50, 2.88),
    ('R211-021013901-0000', '고등어, 남해, 생것', 214, 0, 21.06, 13.34, 0, 25, 3.02),
    ('D308-388000000-0001', '연어구이', 234, 0.20, 24.78, 14.94, 0.55, 158, 2.17),
    ('R110-003000046-0000', '달걀, 삶은것', 145, 1.37, 13.49, 8.69, 0.13, 128, 2.78),
    ('R110-003005046-0000', '달걀, 난백, 삶은것', 51, 0.22, 11.63, 0.01, 0.12, 145, 0.01),
    ('R121-026061100-0000', '요구르트, 호상, 플레인', 86, 9.69, 4.53, 3.21, 8.51, 56, 1.99),
    ('R106-092000047-0000', '브로콜리, 데친것', 26, 4.45, 3.20, 0.24, 1.37, 4, 0.08),
    ('R106-115000047-0000', '시금치, 데친것', 34, 5.26, 4.02, 0.61, 0.16, 29, 0.10),
    ('R106-101143601-0000', '상추, 결구(양상추), 녹색, 생것', 14, 3.37, 0.72, 0.08, 1.77, 4, 0.01),
    ('R106-186000001-0000', '토마토, 생것', 19, 4.27, 0.77, 0.19, 2.68, 2, 0.03),
    ('R106-194008101-0000', '파프리카, 빨간색, 생것', 23, 5.54, 0.86, 0.15, 3.43, 0, 0.03),
    ('R108-037000001-0000', '바나나, 생것', 77, 20.00, 1.11, 0.20, 14.18, 0, 0.05),
    ('R108-090020001-0000', '키위, 그린, 생것', 61, 14.55, 0.91, 0.68, 6.74, 2, 0.05),
    ('R105-020000058-0000', '아몬드, 볶은것', 594, 20.49, 23.45, 51.29, 3.91, 2, 3.79),
    ('R105-035000002-0000', '호두, 말린것', 688, 7.92, 15.47, 71.99, 0, 3, 5.87),
    ('R108-064000001-0000', '아보카도, 생것', 160, 8.53, 2.00, 14.66, 0.66, 7, 2.13);

UPDATE food f
SET sugars_g        = COALESCE(f.sugars_g, s.sugars),
    sodium_mg       = COALESCE(f.sodium_mg, s.sodium),
    saturated_fat_g = COALESCE(f.saturated_fat_g, s.sat)
FROM plan_seed s
WHERE f.external_code = s.code;

INSERT INTO food (name, kcal, carbs_g, protein_g, fat_g, serving_grams, source, external_code, volume_based,
                  sugars_g, sodium_mg, saturated_fat_g, created_at, updated_at)
SELECT s.name, s.kcal, s.carbs, s.protein, s.fat, NULL, 'MFDS', s.code, FALSE, s.sugars, s.sodium, s.sat, now(), now()
FROM plan_seed s
WHERE NOT EXISTS (SELECT 1 FROM food f WHERE f.external_code = s.code);

-- 음식 영양값이 기록 당시와 같은(같은 버전인) 기록만 새 값으로 채운다.
UPDATE meal_entry m
SET sugars_per100_snapshot        = f.sugars_g,
    sodium_per100_snapshot        = f.sodium_mg,
    saturated_fat_per100_snapshot = f.saturated_fat_g
FROM food f
WHERE m.food_id = f.id
  AND m.kcal_per100_snapshot = f.kcal
  AND m.carbs_per100_snapshot = f.carbs_g
  AND m.protein_per100_snapshot = f.protein_g
  AND m.fat_per100_snapshot = f.fat_g;
