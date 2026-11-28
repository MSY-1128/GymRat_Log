# FitLog

한국어 운동·식단 칼로리 관리 앱(로컬 PC용 MVP, 계정별 기록 분리).
오늘 / 식단 / 운동 / 기록 / 설정 화면, 프로필 저장, 음식 검색·직접 등록, **식약처 식품영양성분DB 검색·가져오기**, 식단·운동 CRUD, 날짜 이동, 최근 7일 차트를 제공합니다.
모든 계산은 서버(BigDecimal)가 기준이며, 화면은 kcal 정수·영양소 소수 1자리로 반올림해 표시만 합니다.
변경 이력은 [CHANGELOG.md](CHANGELOG.md), API 계약은 [API.md](API.md)를 보세요.

> 아이디·비밀번호로 로그인하며, 프로필·식단·운동·직접 등록한 음식은 계정마다 분리됩니다.
> ⚠️ 서버와 개발 서버는 기본 `127.0.0.1`에만 바인딩됩니다. HTTPS·비밀번호 재설정·운영용 세션 저장소가 없으므로 **외부에 공개 배포하지 마세요.**
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
| Pretendard Variable (글꼴, OFL-1.1) | 1.3.9 |
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
| `MFDS_SERVICE_KEY` | data.go.kr 식약처 식품영양성분DB **Decoding** 키(선택). 비우면 식약처 검색만 비활성 | — |
| `FOODSAFETY_API_KEY` | 식품안전나라 오픈API 인증키(선택, 바코드 조회). 비우면 바코드 조회만 비활성 | — |

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

처음 접속하면 로그인 화면이 나옵니다. **계정 만들기**로 가입하면 바로 로그인됩니다.

## 로그인과 계정

- Spring Security 세션 방식. 세션 쿠키 `FITLOG_SESSION`(HttpOnly, SameSite=Lax, 7일)과 CSRF 토큰(`XSRF-TOKEN` 쿠키 → `X-XSRF-TOKEN` 헤더)을 씁니다. 화면의 API 클라이언트가 토큰을 자동으로 붙입니다.
- 아이디: 영문·숫자·`_ . -` 3~30자(대소문자 구분 없이 유일). 비밀번호: 8~64자, bcrypt 해시(`{bcrypt}…`)로만 저장.
- 같은 아이디로 5번 연속 로그인에 실패하면 5분 동안 막습니다(429 `TOO_MANY_ATTEMPTS`). 실패 메시지는 아이디 존재 여부를 드러내지 않습니다.
- **계정별 데이터**: 프로필, 식단 기록, 운동 기록, 직접 등록한 음식. 다른 사람의 기록 ID로 접근하면 404입니다.
- **공용 데이터**: DEMO 샘플 음식·운동, 식약처 DB에서 가져온 음식.
- **로그인 도입 전 기록**: 마이그레이션 `V3__users.sql`은 기존 기록을 지우지 않습니다. **처음 가입하는 계정**이 주인 없는 프로필·식단·운동·직접 등록 음식을 이어받고, 이후 계정은 빈 상태로 시작합니다.

| API | 설명 |
|---|---|
| `GET /api/v1/auth/csrf` | `XSRF-TOKEN` 쿠키 발급(204) |
| `POST /api/v1/auth/signup` `{username, password}` | 가입 + 로그인(201). 중복 아이디 409 `USERNAME_TAKEN` |
| `POST /api/v1/auth/login` `{username, password}` | 로그인(200). 실패 401 `INVALID_CREDENTIALS` |
| `POST /api/v1/auth/logout` | 로그아웃(204) |
| `GET /api/v1/auth/me` | 로그인 사용자 `{id, username}`. 미로그인 401 `UNAUTHORIZED` |

그 밖의 모든 `/api/**`는 로그인이 필요하며(미로그인 401 JSON), 변경 요청(POST/PUT/DELETE)은 CSRF 토큰이 없으면 403입니다.

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

## 식약처 식품영양성분DB 연동

[공공데이터포털 '식품의약품안전처_식품영양성분DB정보'](https://www.data.go.kr/data/15127578/openapi.do)
(`FoodNtrCpntDbInfo03/getFoodNtrCpntDbInq03`)를 백엔드에서만 호출합니다. 서비스키는 브라우저로 나가지 않고, 키가 들어 있는 요청 URL은 로그에 남기지 않습니다.

1. data.go.kr에서 활용신청 → 마이페이지의 **일반 인증키(Decoding)** 를 `.env`의 `MFDS_SERVICE_KEY`에 넣습니다.
2. 식단 화면 → "식약처 식품영양성분DB에서 찾기" → 검색 → **가져와서 선택**. 가져온 음식은 내 음식(`source=MFDS`, '식약처' 배지)으로 저장되어 다음부터 일반 검색에 나옵니다.

| API | 설명 |
|---|---|
| `GET /api/v1/foods/external?q=&maker=&page=0&kind=GENERIC\|BRAND\|ALL` | 식약처 DB 검색(20건/페이지). `GENERIC`=품목대표(일반 식품·음식, 기본), `BRAND`=상용제품(가공식품·외식 프랜차이즈). `maker`=업체·브랜드명(예: 맥도날드). `q`와 `maker` 중 하나는 필요 |
| `GET /api/v1/foods/barcode/{8~14자리 숫자}` | 바코드 → 제품 → 영양성분 후보(아래 '바코드 조회') |
| `POST /api/v1/foods/import` `{ "externalCode": "D101-..." }` | 최근 검색·바코드 결과에서 고른 식품을 내 음식으로 저장(이미 있으면 기존 음식 반환) |

**외식 메뉴**: 별도 API 없이 같은 DB에 들어 있습니다(식품군 `음식` + `상용제품`, 예: 맥도날드·롯데리아·버거킹 메뉴). 응답의 `restaurant=true`이면 화면에 '외식' 배지를 붙입니다. 원본 API는 식품군(`DB_GRP_NM`) 조건을 무시하므로 브랜드(`MAKER_NM`)로 좁힙니다.

### 바코드 조회 (식품안전나라)

바코드 API에는 영양성분이 없습니다. 그래서 두 단계로 연결합니다.

1. [식품안전나라 오픈API](https://www.foodsafetykorea.go.kr/api/openApiInfo.do?svc_no=C005) `C005` 바코드연계제품정보(`BAR_CD`) → 없으면 `I2570` 유통바코드(`BRCD_NO`)에서 제품명·**품목제조보고번호**를 얻습니다.
2. 식약처 영양성분DB를 `ITEM_REPORT_NO`(품목제조보고번호)로 조회합니다 → `match=REPORT_NO`. 연결되지 않으면 제품명(중량·수량·괄호 제거)으로 상용제품을 찾아 **후보로만** 보여 줍니다 → `match=NAME`(사용자가 확인 후 선택). 둘 다 없으면 `NO_NUTRITION`, 바코드 제품이 없으면 `NOT_FOUND`.

설정: 식품안전나라 > 오픈API에서 받은 인증키를 `.env`의 `FOODSAFETY_API_KEY`에 넣습니다(data.go.kr 키와 다름). 비어 있으면 바코드 조회만 503 `FOODSAFETY_NOT_CONFIGURED`, 외부 오류는 502 `FOODSAFETY_UNAVAILABLE`. 인증키는 URL 경로에 들어가므로 요청 URL은 로그에 남기지 않습니다.

정규화 규칙(`MfdsFoodMapper`):
- 영양값은 원본 기준량(`SERVING_SIZE`, 예: 100g/30g/100mL)에서 **100g 기준으로 환산**합니다. **mL 기준은 1mL ≈ 1g으로 근사**하고 화면에 표시합니다(`volumeBased`).
- 에너지 `AMT_NUM1`, 탄수화물 `AMT_NUM6`, 단백질 `AMT_NUM3`, 지방 `AMT_NUM4`. 쉼표 숫자("1,010.000")·빈 값·"N/A"를 처리합니다.
- 탄수화물/단백질/지방이 비어 있으면 0으로 저장하고 "정보 없음(0으로 계산)"으로 알립니다. 에너지가 없거나 값이 비정상(음수, 100g당 900kcal·영양소 100g 초과)이면 후보에서 제외합니다.
- 1인분 중량은 1회 섭취참고량(`NUTRI_AMOUNT_SERVING`) → 없으면 식품 중량(`Z10500`) 순으로 사용합니다(5000g 이하만).
- 원본 API는 부분 일치·관련도 정렬 없음이라("콜라" → "쇼콜라" 먼저), 받은 페이지 안에서 정확히 일치 → 앞부분 일치 → 단어 일치 순으로 다시 정렬합니다.
- 가져오기 요청은 식품코드만 받고 영양값은 서버가 보관한 최근 검색 결과(최대 2시간, 1000건)에서 꺼냅니다. 만료되면 409 `MFDS_SEARCH_EXPIRED`.
- 오류: 키 미설정 503 `MFDS_NOT_CONFIGURED`, 외부 API 오류·인증 실패·시간 초과 502 `MFDS_UNAVAILABLE`(원인은 서버 로그에만). 화면은 검색 버튼을 누를 때만 조회하고 자동 재시도하지 않습니다(개발계정 트래픽 한도 보호).
- 테스트는 외부 API를 호출하지 않습니다(MockRestServiceServer / MockitoBean). CI에 키가 필요 없습니다.

## 데이터와 계산 규칙 요약

- **demo seed**: `demo` 프로필에서만, 음식(공유 식약처 기본 식품 제외)·운동·기록이 모두 비어 있을 때 `data.json`을 한 번만 넣습니다. `seed_history` 테이블로 적용 여부를 기록하므로 seed 데이터를 지워도 재시작 시 복원되지 않습니다. ID는 DB가 생성하고 샘플 ID는 `sample_id` 컬럼에 매핑합니다. `source=DEMO`가 유지되고 화면에 DEMO/샘플로 표시됩니다. `profileExample`은 사용자 프로필로 저장하지 않습니다.
- **BMR**(Mifflin-St Jeor) = 10×kg + 6.25×cm − 5×나이 + (MALE +5 / FEMALE −161), 성별 미선택 시 BMR/TDEE는 null. **TDEE** = BMR × 활동계수(1.2/1.375/1.55/1.725/1.9).
- **체성분**(`/api/v1/body-compositions?from=&to=`, POST/PUT/DELETE): 인바디 결과지를 직접 입력. 체중 필수, 체지방률·골격근량·기초대사량·내장지방 레벨은 선택. 사용자별 하루 1건(중복 409 `DUPLICATE_DATE`). 체지방량 = 체중 × 체지방률/100, 제지방량 = 체중 − 체지방량(서버 계산).
- **BMR 계산 방식**(프로필 `bmrMethod`): `FORMULA`(위 Mifflin) / `BODY_FAT`(Katch-McArdle = 370 + 21.6 × 제지방량, 체지방률이 있는 최근 측정) / `MEASURED`(기초대사량이 있는 최근 측정값). 필요한 측정이 없으면 `FORMULA`로 계산하고 `bmrAppliedMethod`로 실제 방식을 알려 줍니다.
- **단백질 목표** = 제지방 1kg당 g(프로필 `proteinGPerKgLean`, 0.8~3.0) × 최근 제지방량. 체지방률 기록이 없으면 null.
- **음식** = 100g 기준값 × g / 100 (0 < g ≤ 5000). 인분 단위는 `servingGrams`가 있는 음식만 지원(화면에서 g로 환산해 전송).
- **운동 종목**: 마이그레이션(V5·V6)이 기본 카탈로그(`source=CATALOG`)를 넣습니다. 시간 운동 16종(테니스·클라이밍·복싱·수영 등)과 헬스 부위별(가슴 22·등 22·어깨 20·하체 28·팔 22·복근 20) 134종. 헬스 종목은 도구(바벨·덤벨·머신·케이블·맨몸·케틀벨)와 주·보조 근육(18개 근육 코드)을 가지며, 운동 화면은 이를 앞·뒤 근육 그림(직접 그린 SVG)으로 강조합니다. MET는 Compendium of Physical Activities 기반 추정치입니다.
- **운동 유형**(V7 `energy_system`): 무산소(헬스·요가·필라테스) / 유산소(걷기·달리기·자전거·수영·로잉머신·천국의계단·에어바이크·일립티컬 등 16종) / 무산소+유산소(구기·라켓·격투·크로스핏 등 15종과 점프 스쿼트·케틀벨 스윙 등 헬스 4종).
- **운동 기록 방식**(`mode`): `SETS`(헬스) = MET × 3.5 × 체중kg / 200 × (세트 × 2.5분 추정). 무게로 칼로리를 구하는 검증된 식이 없어 무게·횟수는 볼륨 기록용입니다. `TIME`(그 밖의 운동) = 같은 MET 식 × 분이며, MET는 강도 하나로 정합니다: 체감 강도(`intensity` 가볍게·보통·힘들게별 MET) 또는 거리(`distanceKm` ÷ 시간 = 평균 속도)·속도(`speedKmh`)를 속도별 MET 곡선(걷기·달리기·자전거·수영·로잉머신만)에 넣은 값. 이전 `DISTANCE`(km당 계수) 기록은 그대로 읽히며, 새 `DISTANCE` 요청은 시간이 있으면 `TIME` + 거리로 저장합니다.
- **동작 그림**: 종목마다 `motion` 키(예: `pecDeck`, `bench:incline`)로 `frontend/src/motion/patterns.ts`의 동작 패턴을 골라 직접 그린 SVG 인체가 시작↔끝 자세를 반복합니다(주·보조 근육 빨강, 일시정지 버튼, 움직임 줄이기 설정 시 시작·끝 정지 그림). 개발 서버에서 `/dev/motions`로 모든 패턴을 한 번에 볼 수 있습니다(빌드에는 포함되지 않음).
- **운동**(시간 기록) = MET × 3.5 × 체중kg / 200 × 분 (1~1440분). 생성 시 프로필 체중을 snapshot 저장(프로필 없으면 409 `PROFILE_REQUIRED`). 수정 시 체중 유지, 운동 종류가 바뀔 때만 새 MET 적용.
- **남은 칼로리** = 목표 − 섭취(음수 그대로, 목표 미설정이면 null). 운동량은 목표에 자동 가산하지 않습니다.
- 식단 기록은 음식명·100g 기준 영양값을 snapshot으로 보관해 음식이 바뀌어도 과거 계산값이 변하지 않습니다.
- **당류·나트륨·포화지방**(V8): 음식과 기록에 100g 기준 값을 둡니다(모르면 null). 식단 화면에서 오늘 섭취량을 상한(나트륨 2,000mg · 당류 열량의 20% · 포화지방 열량의 7%), 최근 7일 평균과 비교하고 줄일 부분을 안내합니다. 상한 기준 열량은 설정한 하루 목표 → 유지 열량 → 2,000kcal 순서입니다.
- **목표별 식단표**: 유지 열량 기준으로 근육량 증가 +10% · 유지 · 감량 −20%(기초대사량 아래로 내리지 않음), 단백질 1.8 · 1.6 · 2.2g/kg, 지방 25%, 나머지는 탄수화물. 아침 25% · 점심 30% · 저녁 30% · 간식 15%로 나눠, 식약처 DB 값으로 넣은 기본 식품 25종에서 양을 맞춥니다. 근거(ISSN·ACSM·WHO·한국인 영양소 섭취기준)는 화면의 '근거 자료'와 [API.md](API.md)에 있습니다. 조리할 때 쓰는 소금·기름은 포함하지 않습니다.
- 날짜는 브라우저 로컬 `YYYY-MM-DD` ↔ 서버 `LocalDate`(UTC 변환 없음). 선택 날짜는 URL `?date=`로 유지됩니다.
- 최근 7일 통계는 빈 날짜를 0으로 채우고, `/stats`는 최대 366일입니다.

모든 수치는 참고용 추정치이며 의료적 조언이 아닙니다. 샘플 음식/운동 값은 검증된 영양정보가 아닙니다.

## 남은 한계 / 후속 작업

- 로그인 세션은 백엔드 메모리에 있어 백엔드를 재시작하면 다시 로그인해야 함(Spring Session JDBC 등으로 교체 가능).
- 비밀번호 변경·재설정, 계정 삭제, 관리자 기능 없음. HTTPS로 서비스하려면 `SESSION_COOKIE_SECURE=true` 필요.
- 음식/운동 마스터의 수정·삭제 API와 사용자 운동 등록 기능 없음(명세 범위 밖).
- 식약처 DB는 검색·가져오기만 지원. 가져온 뒤 원본이 바뀌어도 자동 동기화하지 않음(가져온 음식 삭제·재가져오기 기능 없음).
- 즐겨찾기, 내보내기/가져오기, 월간 분석은 미구현.
- E2E 브라우저 자동화 테스트(Playwright 등)는 저장소에 아직 없음(수동 확인만).

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
