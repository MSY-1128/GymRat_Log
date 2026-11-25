package com.fitlog.seed;

import static org.assertj.core.api.Assertions.assertThat;

import com.fitlog.TestcontainersConfiguration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("demo")
@Import(TestcontainersConfiguration.class)
class DemoSeederIntegrationTest {

    @Autowired
    DemoSeeder seeder;

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void seedsOnceWithDemoSourceAndSampleIdMappingAndNeverRestoresDeletedRows() throws Exception {
        List<Map<String, Object>> foods = jdbc.queryForList(
                "SELECT id, name, source, sample_id FROM food ORDER BY sample_id");
        assertThat(foods).hasSize(3);
        assertThat(foods).allSatisfy(f -> assertThat(f.get("source")).isEqualTo("DEMO"));
        assertThat(foods).extracting(f -> ((Number) f.get("sample_id")).longValue()).containsExactly(1L, 2L, 3L);
        // 샘플 운동(걷기·달리기·자전거)은 마이그레이션 카탈로그에 이미 있어 새로 만들지 않는다
        assertThat(jdbc.queryForObject("SELECT count(*) FROM exercise WHERE source = 'DEMO'", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM exercise WHERE name IN ('걷기', '달리기', '자전거')",
                Integer.class)).isEqualTo(3);
        int catalog = jdbc.queryForObject("SELECT count(*) FROM exercise", Integer.class);
        // profileExample은 사용자 프로필로 저장하지 않는다
        assertThat(jdbc.queryForObject("SELECT count(*) FROM profile", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT status FROM seed_history WHERE seed_key = ?", String.class,
                DemoSeeder.SEED_KEY)).isEqualTo("APPLIED");

        // 사용자가 seed 음식 하나를 삭제한 뒤 재시작(=seeder 재실행)해도 복원되지 않아야 한다
        jdbc.update("DELETE FROM food WHERE sample_id = 2");
        seeder.run(new DefaultApplicationArguments());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM food", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM exercise", Integer.class)).isEqualTo(catalog);
    }
}
