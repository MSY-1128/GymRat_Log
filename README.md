# FitLog

한국어 운동·식단 칼로리 관리 앱(로컬 PC 단일 사용자 MVP).
오늘 / 식단 / 운동 / 기록 / 설정 화면, 프로필 저장, 음식 검색·직접 등록, 식단·운동 CRUD, 날짜 이동, 최근 7일 차트를 제공합니다.
모든 계산은 서버(BigDecimal)가 기준이며, 화면은 kcal 정수·영양소 소수 1자리로 반올림해 표시만 합니다.

> ⚠️ 로그인·사용자 격리가 없습니다. 서버와 개발 서버는 기본 `127.0.0.1`에만 바인딩됩니다. **외부에 공개 배포하지 마세요.**
> GitHub에 소스를 올리는 것과 서비스를 배포하는 것은 별개입니다.

> 📝 원래 시작 자료(CLAUDE_PROMPT.md)는 MySQL 8.4 기준이었지만, 이 구현은 **PostgreSQL 17**로 변경했습니다
> (Flyway 마이그레이션, JDBC 드라이버, Compose, Testcontainers 모두 PostgreSQL).

## 구조

```
backend/    Spring Boot API (Java 21, Maven Wrapper)
frontend/   React + TypeScript + Vite
compose.yaml           로컬 PostgreSQL
scripts/run-backend.*  .env를 명시적으로 주입해 백엔드 실행
.github/workflows/ci.yml
SPEC.md / API.md / data.json / preview.html  원본 명세·샘플·시안
```

## 선택 버전 (2026-11 확인, 모두 고정)

| 영역 | 버전 |
|---|---|
| Java | 21 (Temurin) |
| Spring Boot | 4.1.2 (Spring Framework 7.0.10, Hibernate 7.4.13, Jackson 3.1.7) |
| Flyway | 12.4.0 (Spring Boot 관리 버전) + flyway-database-postgresql |
| PostgreSQL | 17 (Docker `postgres:17-alpine`), JDBC 42.7.14 |
| Maven | 3.9.16 (Maven Wrapper 3.3.4) |
| Testcontainers | 2.0.5 · JUnit 6.0.3 |
| Node.js | 22 LTS (Vite 요구사항: ^20.19 또는 >=22.12) |
| React / React DOM | 19.3.1 |
| React Router | 8.5.2 |
| TanStack Query | 5.108.1 |
| Recharts | 3.11.0 |
| Vite / @vitejs/plugin-react | 8.3.8 / 6.3.0 |
| TypeScript | 7.0.2 |
| Vitest / jsdom / Testing Library | 5.1.1 / 31.0.1 / React 16.3.3 |

정확한 의존성은 `backend/pom.xml`, `frontend/package-lock.json`에 고정되어 있습니다.

## 준비물

- **JDK 21**, **Node.js 22.12+**, **Docker Desktop**, Git
- Windows 예시: `winget install EclipseAdoptium.Temurin.21.JDK` / `winget install OpenJS.NodeJS.LTS`
  (설치 후 새 터미널에서 `java -version`이 21인지 확인. JDK 17이 먼저 잡히면 `JAVA_HOME`을 21로 지정)

## 1. 환경변수(.env)

```powershell
Copy-Item .env.example .env   # bash: cp .env.example .env
```

`.env`의 `POSTGRES_PASSWORD`와 `SPRING_DATASOURCE_PASSWORD`를 같은 값으로 바꾸세요. `.env`는 `.gitignore` 대상입니다.

| 변수 | 용도 | 기본 |
|---|---|---|
| `POSTGRES_DB` / `POSTGRES_USER` / `POSTGRES_PASSWORD` | DB 컨테이너 초기화 (Compose `env_file`) | fitlog / fitlog / — |
| `POSTGRES_PORT` | 호스트 공개 포트(127.0.0.1 전용) | 5433 |
| `SPRING_DATASOURCE_URL` / `_USERNAME` / `_PASSWORD` | 백엔드 DB 접속 | `jdbc:postgresql://127.0.0.1:5433/fitlog` |
| `SPRING_PROFILES_ACTIVE` | `demo`면 빈 DB에 data.json 샘플 1회 seed | demo |
| `SERVER_PORT` | 백엔드 포트 | 8080 |

**.env는 자동으로 로딩되지 않습니다.** DB는 Compose의 `env_file`로, 백엔드는 `scripts/run-backend.*`가 `.env`를 읽어 명시적으로 주입합니다.
(직접 실행하려면 위 변수를 셸 환경변수로 설정한 뒤 `./mvnw spring-boot:run`)

## 2. DB 실행

```powershell
docker compose up -d --wait     # PostgreSQL 17, 127.0.0.1:5433
docker compose down             # 중지 (데이터 유지)
docker compose down -v          # 중지 + 데이터 삭제
```

스키마는 백엔드 시작 시 Flyway(`backend/src/main/resources/db/migration`)가 만들고, JPA는 `ddl-auto=validate`로 검증만 합니다.

## 3. 백엔드 실행 (http://127.0.0.1:8080)

```powershell
.\scripts\run-backend.ps1        # Windows PowerShell
./scripts/run-backend.sh         # macOS/Linux/Git Bash
```

8080이 이미 사용 중이면 `.env`에서 `SERVER_PORT=18080`처럼 바꾸고, 프런트 실행 시 `BACKEND_URL`도 같이 맞추세요.

## 4. 프런트엔드 실행 (http://127.0.0.1:5173)

```powershell
cd frontend
npm ci
npm run dev
# 백엔드 포트를 바꿨다면:  $env:BACKEND_URL="http://127.0.0.1:18080"; npm run dev
```

Vite가 `/api`를 백엔드로 프록시하므로 브라우저는 상대경로 `/api/v1`만 호출합니다(CORS 설정 없음).

## 5. 테스트

```powershell
# 백엔드: 단위(계산식·입력 검증·snapshot) + Spring Boot/PostgreSQL 통합 테스트 (Docker 필요: Testcontainers)
cd backend; .\mvnw.cmd test        # bash: ./mvnw test

# 프런트엔드
cd frontend
npm run typecheck
npm test
npm run build
```

CI(`.github/workflows/ci.yml`)는 push/PR마다 `backend: mvnw verify`, `frontend: npm ci → typecheck → test → build`를 실행합니다.

### JDK 21/Node가 없는 PC에서 Docker로만 실행하기

```bash
# 백엔드 테스트 (Git Bash 기준; Testcontainers가 호스트 Docker를 사용)
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/backend:/w" -v fitlog-m2:/root/.m2 \
  -v /var/run/docker.sock:/var/run/docker.sock -e TESTCONTAINERS_HOST_OVERRIDE=host.docker.internal \
  -w /w eclipse-temurin:21-jdk ./mvnw -B test

# 프런트 테스트
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd -W)/frontend:/w" -v fitlog-node-modules:/w/node_modules \
  -w /w node:22-alpine sh -c "npm ci && npm run typecheck && npm test && npm run build"
```

## 데이터와 계산 규칙 요약

- **demo seed**: `demo` 프로필에서만, 음식·운동·기록이 모두 비어 있을 때 `data.json`을 한 번만 넣습니다. `seed_history` 테이블로 적용 여부를 기록하므로 seed 데이터를 지워도 재시작 시 복원되지 않습니다. ID는 DB가 생성하고 샘플 ID는 `sample_id` 컬럼에 매핑합니다. `source=DEMO`가 유지되고 화면에 DEMO/샘플로 표시됩니다. `profileExample`은 사용자 프로필로 저장하지 않습니다.
- **BMR**(Mifflin-St Jeor) = 10×kg + 6.25×cm − 5×나이 + (MALE +5 / FEMALE −161), 성별 미선택 시 BMR/TDEE는 null. **TDEE** = BMR × 활동계수(1.2/1.375/1.55/1.725/1.9).
- **음식** = 100g 기준값 × g / 100 (0 < g ≤ 5000). 인분 단위는 `servingGrams`가 있는 음식만 지원(화면에서 g로 환산해 전송).
- **운동** = MET × 3.5 × 체중kg / 200 × 분 (1~1440분). 생성 시 프로필 체중을 snapshot 저장(프로필 없으면 409 `PROFILE_REQUIRED`). 수정 시 체중 유지, 운동 종류가 바뀔 때만 새 MET 적용.
- **남은 칼로리** = 목표 − 섭취(음수 그대로, 목표 미설정이면 null). 운동량은 목표에 자동 가산하지 않습니다.
- 식단 기록은 음식명·100g 기준 영양값을 snapshot으로 보관해 음식이 바뀌어도 과거 계산값이 변하지 않습니다.
- 날짜는 브라우저 로컬 `YYYY-MM-DD` ↔ 서버 `LocalDate`(UTC 변환 없음). 선택 날짜는 URL `?date=`로 유지됩니다.
- 최근 7일 통계는 빈 날짜를 0으로 채우고, `/stats`는 최대 366일입니다.

모든 수치는 참고용 추정치이며 의료적 조언이 아닙니다. 샘플 음식/운동 값은 검증된 영양정보가 아닙니다.

## 남은 한계 / 후속 작업

- 로그인·사용자별 데이터 격리 없음(공개 배포 전 필수). 프로필은 DB의 첫 번째 행 하나만 사용.
- 음식/운동 마스터의 수정·삭제 API와 사용자 운동 등록 기능 없음(명세 범위 밖).
- 실제 영양 DB/API 연동, 즐겨찾기, 내보내기/가져오기, 월간 분석은 미구현.
- 라이트 테마만 제공. E2E 브라우저 자동화 테스트(Playwright 등)는 아직 없음.

## GitHub 업로드

```powershell
git init
git branch -M main
git add .
git status            # .env, 개인 기록이 포함되지 않았는지 확인
git diff --cached
git commit -m "Initial FitLog application"
git remote add origin https://github.com/YOUR_NAME/fitlog.git
git push -u origin main
```

토큰은 코드에 저장하지 말고 Git Credential Manager 등을 사용하세요.
