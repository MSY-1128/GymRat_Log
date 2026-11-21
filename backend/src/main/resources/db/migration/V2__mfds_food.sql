-- 식약처 식품영양성분DB(data.go.kr)에서 가져온 음식 지원

ALTER TABLE food DROP CONSTRAINT food_source_check;
ALTER TABLE food ADD CONSTRAINT food_source_check CHECK (source IN ('DEMO', 'USER', 'MFDS'));

-- 식약처 식품코드(FOOD_CD). 같은 식품을 두 번 가져오지 않도록 unique.
ALTER TABLE food ADD COLUMN external_code VARCHAR(50);
ALTER TABLE food ADD CONSTRAINT uq_food_external_code UNIQUE (external_code);
ALTER TABLE food ADD CONSTRAINT food_external_code_check CHECK ((source = 'MFDS') = (external_code IS NOT NULL));

-- 원본이 100mL 기준인 식품. 1mL ≈ 1g으로 근사해 100g 기준값으로 저장했음을 표시한다.
ALTER TABLE food ADD COLUMN volume_based BOOLEAN NOT NULL DEFAULT FALSE;
