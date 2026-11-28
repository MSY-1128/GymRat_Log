package com.fitlog.food;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import java.io.Serializable;

/** 사용자가 내 음식 목록에서 지운(숨긴) 음식. 검색 목록에서만 빠지고 지난 식단 기록은 그대로다. */
@Entity
@Table(name = "hidden_food")
@IdClass(HiddenFood.Key.class)
public class HiddenFood {

    @Id
    @Column(name = "user_id")
    private Long userId;

    @Id
    @Column(name = "food_id")
    private Long foodId;

    protected HiddenFood() {
    }

    public record Key(Long userId, Long foodId) implements Serializable {
        public Key() {
            this(null, null);
        }
    }
}
