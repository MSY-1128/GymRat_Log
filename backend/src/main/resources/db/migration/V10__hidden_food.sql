-- 내 음식 목록에서 지운 음식. 공유 음식(식약처)이나 식단 기록이 쓰는 음식은 행을 지우지 않고 사용자별로 숨긴다.
CREATE TABLE hidden_food (
    user_id    BIGINT      NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    food_id    BIGINT      NOT NULL REFERENCES food (id) ON DELETE CASCADE,
    hidden_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, food_id)
);
