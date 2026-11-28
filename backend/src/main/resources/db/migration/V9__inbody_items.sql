-- 인바디 결과지 항목(체성분분석·부위별 분석·연구항목). 모두 선택 입력.
ALTER TABLE body_composition
    ADD COLUMN body_fat_mass_kg  NUMERIC(5, 1) CHECK (body_fat_mass_kg BETWEEN 1 AND 250),
    ADD COLUMN body_water_l      NUMERIC(5, 1) CHECK (body_water_l BETWEEN 10 AND 150),
    ADD COLUMN protein_kg        NUMERIC(4, 1) CHECK (protein_kg BETWEEN 1 AND 40),
    ADD COLUMN mineral_kg        NUMERIC(4, 2) CHECK (mineral_kg BETWEEN 0.5 AND 15),
    ADD COLUMN ecw_ratio         NUMERIC(4, 3) CHECK (ecw_ratio BETWEEN 0.300 AND 0.500),
    ADD COLUMN waist_hip_ratio   NUMERIC(3, 2) CHECK (waist_hip_ratio BETWEEN 0.50 AND 1.50),
    ADD COLUMN inbody_score      INTEGER       CHECK (inbody_score BETWEEN 0 AND 100),
    -- 부위별 근육량(제지방량, kg)
    ADD COLUMN lean_right_arm_kg NUMERIC(4, 2) CHECK (lean_right_arm_kg BETWEEN 0.1 AND 30),
    ADD COLUMN lean_left_arm_kg  NUMERIC(4, 2) CHECK (lean_left_arm_kg BETWEEN 0.1 AND 30),
    ADD COLUMN lean_trunk_kg     NUMERIC(5, 1) CHECK (lean_trunk_kg BETWEEN 1 AND 120),
    ADD COLUMN lean_right_leg_kg NUMERIC(4, 2) CHECK (lean_right_leg_kg BETWEEN 0.5 AND 50),
    ADD COLUMN lean_left_leg_kg  NUMERIC(4, 2) CHECK (lean_left_leg_kg BETWEEN 0.5 AND 50),
    -- 부위별 체지방량(kg)
    ADD COLUMN fat_right_arm_kg  NUMERIC(4, 1) CHECK (fat_right_arm_kg BETWEEN 0 AND 40),
    ADD COLUMN fat_left_arm_kg   NUMERIC(4, 1) CHECK (fat_left_arm_kg BETWEEN 0 AND 40),
    ADD COLUMN fat_trunk_kg      NUMERIC(5, 1) CHECK (fat_trunk_kg BETWEEN 0 AND 150),
    ADD COLUMN fat_right_leg_kg  NUMERIC(4, 1) CHECK (fat_right_leg_kg BETWEEN 0 AND 60),
    ADD COLUMN fat_left_leg_kg   NUMERIC(4, 1) CHECK (fat_left_leg_kg BETWEEN 0 AND 60);

-- 기존 기록은 체지방률로 체지방량을 채운다(이후 둘 중 하나만 넣어도 서버가 나머지를 계산해 함께 저장)
UPDATE body_composition SET body_fat_mass_kg = round(weight_kg * body_fat_pct / 100, 1)
WHERE body_fat_pct IS NOT NULL AND body_fat_mass_kg IS NULL;

ALTER TABLE body_composition ADD CONSTRAINT body_composition_fat_mass_check
    CHECK (body_fat_mass_kg IS NULL OR body_fat_mass_kg < weight_kg);
