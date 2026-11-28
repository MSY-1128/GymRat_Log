# API 계약

기준 경로 `/api/v1`. JSON은 camelCase, 날짜는 `YYYY-MM-DD`, 단위는 kcal·g·kg·분·km·km/h. 생성 201, 조회·수정 200, 삭제 204. 엔티티가 아닌 DTO를 반환한다.
변경 이력은 [CHANGELOG.md](CHANGELOG.md)를 본다.

## 공통 규칙

- **인증**: 세션 쿠키 로그인. `/auth/csrf`, `/auth/signup`, `/auth/login`을 뺀 모든 API는 로그인이 필요하고(없으면 401 `UNAUTHORIZED`), 데이터는 사용자별로 분리된다. 다른 사용자의 기록은 404로 응답한다.
- **CSRF**: 상태를 바꾸는 요청(POST·PUT·DELETE)은 `XSRF-TOKEN` 쿠키 값을 `X-XSRF-TOKEN` 헤더로 보낸다. 쿠키가 없으면 먼저 `GET /auth/csrf`.
- **서버 계산**: kcal·영양소·BMR 등 계산값은 서버가 구하고, 클라이언트가 보낸 계산값은 받지 않는다.
- **snapshot**: 식단·운동 기록은 저장 시점의 음식 영양값, 운동 이름·MET, 프로필 체중을 함께 저장한다. 나중에 음식·운동·프로필이 바뀌어도 과거 기록의 kcal는 그대로다.
- **오류 형식**: `{"code":"VALIDATION_ERROR","message":"입력값을 확인해 주세요.","fieldErrors":{"grams":"0보다 커야 합니다."}}`
  - 400 `VALIDATION_ERROR`, 401 `UNAUTHORIZED`·`INVALID_CREDENTIALS`, 403 `FORBIDDEN`(CSRF), 404 `NOT_FOUND`, 405 `METHOD_NOT_ALLOWED`, 409 `PROFILE_REQUIRED`·`USERNAME_TAKEN`·`DUPLICATE_DATE`·`MFDS_SEARCH_EXPIRED`, 415 `UNSUPPORTED_MEDIA_TYPE`, 429 `TOO_MANY_ATTEMPTS`, 500 `INTERNAL_ERROR`, 503 `MFDS_*`·`FOODSAFETY_*`
  - 내부 예외·DB 정보는 응답에 넣지 않는다. CORS 전체 허용 금지.
- 저장에 성공하면 화면은 관련 Query(목록·요약·차트)를 무효화해 다시 불러온다.

## 인증 `/auth`

| Method | Path | 입력 | 결과 |
|---|---|---|---|
| GET | /auth/csrf | | 204, `XSRF-TOKEN` 쿠키 발급 |
| GET | /auth/me | | `{id, username}` |
| POST | /auth/signup | `username`(영문·숫자·`_ . -` 3~30자), `password`(8~64자) | 201 `{id, username}`, 가입 즉시 로그인. 중복이면 409 `USERNAME_TAKEN` |
| POST | /auth/login | `username`, `password` | `{id, username}`. 5번 실패하면 5분간 429 `TOO_MANY_ATTEMPTS` |
| POST | /auth/logout | | 204 |

## 프로필 `/profile`

| Method | Path | 입력 또는 결과 |
|---|---|---|
| GET | /profile | 프로필 + 계산값. 아직 없으면 204 |
| PUT | /profile | 아래 입력. 결과는 GET과 같다 |

- **입력**
  - `age`: 19~100
  - `sexForFormula`: `MALE`·`FEMALE`·null
  - `heightCm`: 100~250
  - `weightKg`: 30~350
  - `activityFactor`: 1.2·1.375·1.55·1.725·1.9 중 하나
  - `goal`: `LOSE`·`MAINTAIN`·`GAIN`
  - `dailyTargetKcal`: null 또는 1~10000
  - `bmrMethod`: `FORMULA`·`BODY_FAT`·`MEASURED`. null이면 FORMULA
  - `proteinGPerKgLean`: null 또는 0.8~3.0
- **결과**
  - 입력값 전부
  - `bmrAppliedMethod`: 실제로 쓴 방식. 필요한 측정값이 없으면 FORMULA
  - `bmrMeasuredOn`, `bmrKcal`, `tdeeKcal`
  - `leanMassKg`, `leanMassMeasuredOn`, `proteinTargetG`
- **BMR 계산 방식**
  - FORMULA: Mifflin-St Jeor
  - BODY_FAT: Katch-McArdle, 370 + 21.6 × 제지방량. 최근 체지방률 측정을 쓴다
  - MEASURED: 최근 측정 기초대사량

## 음식 `/foods`

| Method | Path | 입력 또는 결과 |
|---|---|---|
| GET | /foods?q=&page=0&size=20 | `{items, page, size, totalElements}`. 내 음식 + 공용(샘플·식약처) 음식 |
| POST | /foods | `name`, `kcal`, `carbsG`, `proteinG`, `fatG`(100g 기준), `servingGrams`(nullable) |
| GET | /foods/external?q=&page=0&kind=GENERIC&maker= | 식약처 식품영양성분DB 검색. `kind`: `ALL`·`GENERIC`(일반 음식)·`BRAND`(외식·브랜드 메뉴), `maker`: 브랜드명 |
| GET | /foods/barcode/{code} | 식품안전나라 바코드 조회. `{barcode, product, match, items}` |
| POST | /foods/import | `externalCode`. 검색·조회 결과의 식품을 내 음식으로 가져온다 |

- `match` 값
  - `REPORT_NO`: 품목보고번호로 정확히 연결됨
  - `NAME`: 제품명으로 찾은 후보라 확인이 필요함
  - `NO_NUTRITION`: 제품은 있지만 영양정보가 없음
  - `NOT_FOUND`: 찾지 못함
- 외부 API 키가 없으면 503 `MFDS_NOT_CONFIGURED`·`FOODSAFETY_NOT_CONFIGURED`.
- 가져오려는 검색 결과가 만료되었으면 409 `MFDS_SEARCH_EXPIRED`가 난다. 다시 검색해야 한다.

## 식단 `/meals`

| Method | Path | 입력 또는 결과 |
|---|---|---|
| GET | /meals?date= | 그날 기록 배열 |
| POST | /meals | `date`, `mealType`(`BREAKFAST`·`LUNCH`·`DINNER`·`SNACK`), `foodId`, `grams`(0 초과 5000 이하) |
| PUT | /meals/{id} | POST와 같음 |
| DELETE | /meals/{id} | 204 |

- 응답 필드: `id`, `date`, `mealType`, `foodId`, `grams`, `foodNameSnapshot`, `calculatedKcal`, `carbsG`, `proteinG`, `fatG`

## 운동 종목 `/exercises`

| Method | Path | 결과 |
|---|---|---|
| GET | /exercises | 종목 배열(카탈로그 순서) |

- **기본 정보**
  - `id`, `name`, `source`(`CATALOG`·`DEMO`·`USER`)
  - `kind`: `STRENGTH`는 헬스, `TIME`은 시간 운동
  - `energySystem`: `ANAEROBIC`(무산소)·`AEROBIC`(유산소)·`MIXED`(무산소+유산소)
- **MET**
  - `met`: 보통 강도의 MET. 헬스는 종목 MET
  - `metLight`, `metVigorous`: 가볍게·힘들게 MET. 시간 운동만 있고 헬스는 null
  - `speedMetCurve`: `[{speedKmh, met}]`. 거리·속도로 강도를 정할 수 있는 운동(걷기·달리기·자전거·수영·로잉머신)만 값이 있고, 나머지는 빈 배열
- **헬스 종목만 값이 있음**
  - `bodyPart`: `CHEST`·`BACK`·`SHOULDER`·`LEGS`·`ARMS`·`CORE`
  - `equipment`: `BARBELL`·`DUMBBELL`·`MACHINE`·`CABLE`·`BODYWEIGHT`·`KETTLEBELL`
  - `primaryMuscles`, `secondaryMuscles`: 근육 코드 18종. 예: `CHEST`, `FRONT_DELT`, `LATS`, `QUADS`
- **화면용**
  - `motion`: 동작 애니메이션 키(예: `pecDeck`, `bench:incline`)

## 운동 기록 `/workouts`

| Method | Path | 입력 또는 결과 |
|---|---|---|
| GET | /workouts?date= | 그날 기록 배열 |
| POST | /workouts | 아래 방식별 입력 |
| PUT | /workouts/{id} | POST와 같음 |
| DELETE | /workouts/{id} | 204 |

**입력**: 공통으로 `date`, `exerciseId`, `mode`(생략하면 `TIME`)를 보낸다.

- **`SETS`(헬스 종목 전용)**
  - 입력: `sets`(1~50), `reps`(1~100), `liftedKg`(0~500, 맨몸은 0)
  - kcal = MET × 3.5 × 체중 ÷ 200 × (세트 × 2.5분)
  - 무게·횟수는 볼륨 기록용이다. 무게로 칼로리를 구하는 검증된 식이 없다.
- **`TIME`(헬스가 아닌 운동 전용)**
  - 입력: `minutes`(1~1440, 필수)와 강도 하나. 강도는 아래 셋 중 하나만 보낼 수 있다.
    - `intensity`: `LIGHT`·`MODERATE`·`VIGOROUS`. 강도를 생략하면 `MODERATE`
    - `distanceKm`: 0.01~300. 평균 속도 = 거리 ÷ 시간
    - `speedKmh`: 0.5~80
  - 거리·속도는 `speedMetCurve`가 있는 운동만 쓸 수 있다. 곡선의 점 사이는 직선으로 잇고, 양 끝 밖은 끝점 값을 쓴다.
  - 평균 속도가 시속 0.5~80km를 벗어나면 400이다.
  - kcal = MET × 3.5 × 체중 ÷ 200 × 분
- **`DISTANCE`(이전 형식)**
  - 시간이 있으면 `TIME` + 거리로 저장하고, 없으면 400이다.
  - 예전에 저장된 거리 기록은 원래 식(km당 계수 × 체중 × km)으로 계속 보여 준다.
- **오류**
  - 종목과 방식이 맞지 않으면 400 `fieldErrors.mode`
  - 프로필 체중이 없으면 409 `PROFILE_REQUIRED`

**응답 필드**

- 기록: `id`, `date`, `exerciseId`, `mode`, `minutes`, `distanceKm`, `sets`, `reps`, `liftedKg`
- 계산값: `volumeKg`, `durationMinutes`(헬스는 세트 × 2.5분), `calculatedKcal`
- 강도: `intensityBasis`(`LEVEL`·`DISTANCE`·`SPEED`, 이전 시간 기록은 null), `intensity`, `speedKmh`
- 종목 정보: `bodyPart`, `energySystem`
- snapshot: `nameSnapshot`, `weightKgSnapshot`, `metSnapshot`(이 기록에 적용한 MET), `kcalPerKgKmSnapshot`(이전 거리 기록만)

**수정 시 snapshot 규칙**: 체중은 기록 당시 값을 유지한다. 종목이나 강도 입력(기준·체감 강도·속도)이 바뀐 경우에만 MET를 새로 정한다.

## 체성분 `/body-compositions`

| Method | Path | 입력 또는 결과 |
|---|---|---|
| GET | /body-compositions?from=&to= | 기간 안의 측정 배열(최대 1830일) |
| POST | /body-compositions | 아래 입력. 같은 날짜가 이미 있으면 409 `DUPLICATE_DATE` |
| PUT | /body-compositions/{id} | POST와 같음 |
| DELETE | /body-compositions/{id} | 204 |

- **입력**(`measuredOn`, `weightKg` 말고는 모두 선택)
  - `measuredOn`
  - `weightKg`: 30~350
  - `bodyFatPct`: 3~70
  - `skeletalMuscleKg`: 5~100
  - `measuredBmrKcal`: 500~5000
  - `visceralFatLevel`: 1~30
- **결과**: 입력값과 `id`, `fatMassKg`, `leanMassKg`. 체지방률이 있을 때만 계산한다.

## 요약 `/summary`, `/stats`

| Method | Path | 결과 |
|---|---|---|
| GET | /summary?date= | `date`, `consumedKcal`, `targetKcal`, `remainingKcal`, `exerciseKcal`, `exerciseMinutes`, `carbsG`, `proteinG`, `fatG` |
| GET | /stats?from=&to= | 일별 summary 배열, 최대 366일 |

- `exerciseMinutes`는 시간 운동의 분과 헬스 추정 시간을 합해 반올림한 값이다.
- 운동 kcal는 목표 섭취량에 자동으로 더하지 않는다.
