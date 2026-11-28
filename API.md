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
| POST | /foods | `name`, `kcal`, `carbsG`, `proteinG`, `fatG`(100g 기준), `servingGrams`(nullable), 선택 `sugarsG`(0~100), `sodiumMg`(0~40000), `saturatedFatG`(0~100) |
| GET | /foods/external?q=&page=0&kind=GENERIC&maker= | 식약처 식품영양성분DB 검색. `kind`: `ALL`·`GENERIC`(일반 음식)·`BRAND`(외식·브랜드 메뉴), `maker`: 브랜드명 |
| GET | /foods/barcode/{code} | 식품안전나라 바코드 조회. `{barcode, product, match, items}` |
| POST | /foods/import | `externalCode`. 검색·조회 결과의 식품을 내 음식으로 가져온다. 지웠던 식품이면 목록에 되살린다 |
| DELETE | /foods/{id} | 204. 내 음식 목록에서 지운다. 지난 식단 기록은 그대로 남는다 |

- **삭제 방식**
  - 내가 직접 등록했고 식단 기록에 쓰이지 않은 음식은 행을 지운다.
  - 식약처에서 가져온 음식(다른 사용자와 공유)과 기록에 쓰인 음식은 이 사용자의 목록에서만 숨긴다.
  - 샘플(DEMO) 음식은 지울 수 없다(409 `DEMO_FOOD`). 남의 음식은 404다.

- `match` 값
  - `REPORT_NO`: 품목보고번호로 정확히 연결됨
  - `NAME`: 제품명으로 찾은 후보라 확인이 필요함
  - `NO_NUTRITION`: 제품은 있지만 영양정보가 없음
  - `NOT_FOUND`: 찾지 못함
- 외부 API 키가 없으면 503 `MFDS_NOT_CONFIGURED`·`FOODSAFETY_NOT_CONFIGURED`.
- 가져오려는 검색 결과가 만료되었으면 409 `MFDS_SEARCH_EXPIRED`가 난다. 다시 검색해야 한다.
- 음식·식약처 검색 결과에는 100g 기준 `sugarsG`(당류 g)·`sodiumMg`(나트륨 mg)·`saturatedFatG`(포화지방 g)가 있다. 모르면 `null`이며 0과 다르다.
  - 식약처 원본: 당류 `AMT_NUM7`, 나트륨 `AMT_NUM13`, 포화지방 `AMT_NUM24`. 당류 > 탄수화물, 포화지방 > 지방처럼 앞뒤가 맞지 않는 값은 `null`로 둔다(식품은 빼지 않는다).
  - 직접 등록할 때 당류 > 탄수화물이면 400 `fieldErrors.sugarsG`, 포화지방 > 지방이면 400 `fieldErrors.saturatedFatG`.
  - 이미 가져온 식품을 다시 가져오면(`/foods/import`) 비어 있던 세 값만 검색 결과로 채운다.

## 식단 `/meals`

| Method | Path | 입력 또는 결과 |
|---|---|---|
| GET | /meals?date= | 그날 기록 배열 |
| POST | /meals | `date`, `mealType`(`BREAKFAST`·`LUNCH`·`DINNER`·`SNACK`), `foodId`, `grams`(0 초과 5000 이하) |
| PUT | /meals/{id} | POST와 같음 |
| DELETE | /meals/{id} | 204 |

- 응답 필드: `id`, `date`, `mealType`, `foodId`, `grams`, `foodNameSnapshot`, `calculatedKcal`, `carbsG`, `proteinG`, `fatG`, `sugarsG`, `sodiumMg`, `saturatedFatG`(섭취량 기준, 음식에 정보가 없으면 `null`). 세 값도 기록 당시 값으로 snapshot한다

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
| GET | /body-compositions/{id}/analysis | 결과지 형태로 정리하고 국제 기준으로 판정한 분석 |

- **입력**: 인바디 결과지 순서. `measuredOn`, `weightKg` 말고는 모두 선택이다.
  - 기본: `measuredOn`, `weightKg` 30~350
  - 체성분분석: `bodyWaterL` 10~150(L), `proteinKg` 1~40, `mineralKg` 0.5~15, `bodyFatMassKg` 1~250
  - 골격근·지방, 비만분석: `skeletalMuscleKg` 5~100, `bodyFatPct` 3~70
  - 부위별 근육: `segmentalLean` = `{rightArm, leftArm, trunk, rightLeg, leftLeg}`(kg). 팔 0.1~30, 몸통 1~120, 다리 0.5~50
  - 부위별 체지방: `segmentalFat` = 같은 모양(kg). 팔 0~40, 몸통 0~150, 다리 0~60
  - 연구항목: `measuredBmrKcal` 500~5000, `visceralFatLevel` 1~30, `ecwRatio` 0.300~0.500(세포외수분비), `waistHipRatio` 0.50~1.50(복부지방률), `inbodyScore` 0~100
  - 범위는 입력 검증용이며 건강 기준이 아니다. 부위 값의 오류 키는 `segmentalLean.rightArm` 형태다.
- **정형화**: 저장 전에 서버가 값을 맞추고 검사한다. 맞지 않는 항목은 한 번에 모두 400 `fieldErrors`로 돌려준다.
  - 체지방률과 체지방량은 하나만 넣어도 나머지를 계산해 함께 저장한다(소수 첫째 자리).
  - 둘 다 넣었으면 체중 × 체지방률과 체지방량의 차이가 1.0kg 이하여야 한다(`bodyFatMassKg`).
  - 체수분 + 단백질 + 무기질 + 체지방량 ≈ 체중이어야 한다. 넷 다 있을 때만 보고, 허용 오차는 1.5kg이다(`bodyWaterL`).
  - 골격근량 < 제지방량(체지방 정보가 없으면 < 체중)이어야 한다(`skeletalMuscleKg`).
  - 부위별 근육 합 ≤ 제지방량 + 1kg(`segmentalLean`), 부위별 체지방 합 ≤ 체지방량 + 1kg(`segmentalFat`)이어야 한다.
- **결과**
  - 입력 항목(체지방량은 `fatMassKg`로 나온다)
  - `id`, `leanMassKg`(체중 − 체지방량)
  - `appendicularLeanKg`: 팔·다리 근육량 합. 네 부위가 다 있을 때만
- **분석**(`/analysis`): 판정에는 프로필의 성별·나이·키를 쓴다. 없으면 `context.missing`에 이유를 적고 그 판정은 뺀다.
  - `context`: `sex`, `age`, `heightCm`, `standardWeightKg`(BMI 22 기준), `missing`
  - `groups[]`
    - 묶음 키: `COMPOSITION`(체성분분석), `MUSCLE_FAT`(골격근·지방분석), `OBESITY`(비만분석), `MUSCLE`(근육 지표), `SEGMENT_LEAN`(부위별 근육), `SEGMENT_FAT`(부위별 체지방), `RESEARCH`(연구항목)
    - 값이 없는 항목은 빠지고, 항목이 하나도 없는 묶음도 빠진다.
  - 항목(`items[]`): `key`, `label`, `unit`, `value`, `sharePct`(체중 대비 %), `level`(`LOW`·`NORMAL`·`HIGH`·`VERY_HIGH`), `levelLabel`, `normalLow`, `normalHigh`, `basis`(출처)

| 항목 | 기준 |
|---|---|
| 체지방률 | Gallagher 외 2000(AJCN). 나이·성별 건강 범위. 예: 남 20~39세 8~20%, 여 21~33%. 18세 미만은 판정하지 않음 |
| BMI | WHO 아시아·태평양(2000). 정상 18.5~22.9, 과체중 23~24.9, 비만 25 이상 |
| 체지방량지수(FMI, 체지방량 ÷ 키²) | Kelly 외 2009(NHANES). 남 정상 3~6, 여 5~9 |
| 복부지방률 | WHO 전문가 협의(2008). 남 0.90, 여 0.85 이상이면 위험 |
| 사지근육지수(ASMI, 사지 근육량 ÷ 키²) | AWGS 2019. 남 7.0, 여 5.7 미만이면 낮음 |
| 내장지방 레벨(10 이상 높음), 세포외수분비(0.360~0.390 표준) | 국제 기준이 없어 인바디 제조사 기준. `basis`에 그렇게 적는다 |
| 제지방량지수(FFMI), 좌우 차이, 기초대사량(제지방 공식 370 + 21.6 × 제지방량) | 값만 보여 주고 판정하지 않음 |

## 요약 `/summary`, `/stats`

| Method | Path | 결과 |
|---|---|---|
| GET | /summary?date= | `date`, `consumedKcal`, `targetKcal`, `remainingKcal`, `exerciseKcal`, `exerciseMinutes`, `carbsG`, `proteinG`, `fatG`, `sugarsG`, `sodiumMg`, `saturatedFatG`, `mealCount`, `sugarsMissing`, `sodiumMissing`, `saturatedFatMissing` |
| GET | /stats?from=&to= | 일별 summary 배열, 최대 366일 |

- `exerciseMinutes`는 시간 운동의 분과 헬스 추정 시간을 합해 반올림한 값이다.
- 운동 kcal는 목표 섭취량에 자동으로 더하지 않는다.
- `sugarsG`·`sodiumMg`·`saturatedFatG`는 정보가 있는 기록만 더한 값이고, `*Missing`은 정보가 없어 빠진 기록 수다.

## 영양 안내 `/nutrition`

| Method | Path | 결과 |
|---|---|---|
| GET | /nutrition/limits?date= | 그날 당류·나트륨·포화지방 섭취와 상한·최근 7일 평균 비교, 줄일 부분 안내 |
| GET | /nutrition/meal-plan?goal=&variant=0 | 목표별 하루 식단표. `goal`: `GAIN`·`MAINTAIN`·`LOSE`(비우면 프로필 목표), `variant`: 0~999(식품 조합 번호) |

### `/nutrition/limits`

- 기준 열량(`referenceKcal`, `referenceBasis`): 설정한 하루 목표(`TARGET`) → 프로필 유지 열량(`TDEE`) → 2,000kcal(`DEFAULT`) 순서.
- 상한(`items[].limit`). 2,000kcal 기준으로는 국내 식품 라벨의 1일 영양성분 기준치와 같은 값이다.
  - 나트륨(`SODIUM`): 2,000mg (WHO 2012)
  - 당류(`SUGARS`): 기준 열량 × 20% ÷ 4 g. 식약처 값이 총당류라서 2020 한국인 영양소 섭취기준의 총당류 상한을 쓴다.
  - 포화지방(`SATURATED_FAT`): 기준 열량 × 7% ÷ 9 g (2020 한국인 영양소 섭취기준, 19세 이상)
- `items[]`: `nutrient`, `label`, `unit`, `today`, `todayMissing`, `average`(기록한 날 평균, 없으면 `null`), `limit`, `limitBasis`, `percent`, `status`, `averageStatus`.
  - `status`: `NO_RECORD`(기록 없음) · `OK`(상한의 80% 이하) · `NEAR`(80~100%) · `OVER`(초과)
- 평균 기간: `averageFrom`부터 `date`까지 7일. 그중 식단 기록이 있는 날(`averageDays`)로 나눈다.
- `advice[]`: 초과(`WARN`)·주의(`INFO`)인 영양소만. `message`, `topFoods`(그날 하루 양의 10% 이상을 준 기록, 최대 3개: `name`, `mealType`, `amount`), `tips`.
  - 그날 운동이 60분 이상이면 나트륨 팁에 땀 손실 안내(ACSM 2007)를 더한다.

### `/nutrition/meal-plan`

- 몸 기준(`body`): 가장 최근 체성분 측정을 쓴다. 없으면 프로필을 쓴다(`source`).
  - 체중: 측정 체중 → 프로필 체중
  - 기초대사량(`bmrSource`): 인바디 측정값(`MEASURED`) → 제지방량 공식 370 + 21.6 × 제지방량(`LEAN_MASS`, Katch-McArdle) → 프로필 계산값(`PROFILE`)
  - 체지방률 판정(`bodyFatLevel`): Gallagher 2000 나이·성별 건강 범위
  - 응답: `source`, `measuredOn`, `weightKg`, `bodyFatPct`, `leanMassKg`, `skeletalMuscleKg`, `bmrKcal`, `bmrSource`, `bodyFatLevel`, `bodyFatLabel`, `bodyFatNormalLow`, `bodyFatNormalHigh`
- 열량: 유지 열량 = 기초대사량 × 프로필 활동계수.
  - `GAIN`: +10% (ISSN 2017, Iraki 외 2019). 체지방률이 건강 범위보다 높으면 +5%로 줄인다(ISSN 2017 식단과 체성분).
  - `MAINTAIN`: 그대로
  - `LOSE`: −20% (Helms 외 2014). 마를수록 천천히 줄인다.
    - 체지방률이 건강 범위면 −15%
    - 건강 범위 아래면 −10%이고, 감량 대신 유지를 권하는 안내를 붙인다.
    - 기초대사량보다 낮아지지 않는다.
- 단백질: 열량의 40%를 넘지 않는다. 우선순위는 다음과 같다.
  - 설정에서 단백질 목표(제지방 1kg당)를 정했으면 그 값
  - 제지방량이 있으면 제지방 1kg당 `GAIN` 2.1g · `MAINTAIN` 1.9g · `LOSE` 2.6g
    - 증가·유지는 체중 기준 1.8·1.6g(ISSN 2017·ACSM 2016 권장 1.4~2.0g)을 체지방률 15% 기준으로 바꾼 값이다.
    - 감량은 Helms 2014 권장 2.3~3.1g의 가운데 값이다.
  - 없으면 체중 1kg당 `GAIN` 1.8g · `MAINTAIN` 1.6g · `LOSE` 2.2g
- 지방: 열량의 25% (ACSM 2016 권장 20~35%). 탄수화물: 나머지.
- 끼니 몫: 아침 25% · 점심 30% · 저녁 30% · 간식 15%.
  - 아침 → 간식 → 점심 → 저녁 순서로 짠다. 앞 끼니에서 모자라거나 넘친 양은 뒤 끼니가 메운다.
- 식품: V8 마이그레이션이 넣은 식약처 식품영양성분DB 기본 식품 25종(`source=MFDS`).
  - 끼니마다 탄수화물·단백질·지방 역할 식품을 하나씩 고르고, 채소·과일은 정해진 양을 넣는다.
  - `variant`로 고르는 식품이 바뀌며, 다른 끼니에서 이미 쓴 식품은 되도록 피한다.
- 응답: `goal`, `variant`, `targets`(`weightKg`, `tdeeKcal`, `kcal`, `kcalRule`, `proteinG`, `proteinPerKg`, `proteinRule`, `fatG`, `fatPercent`, `carbsG`, `carbsPerKg`), `meals[]`(`mealType`, `sharePercent`, `target`, `total`, `items[]`: `foodId`, `name`, `role`, `grams`, `nutrition`), `total`, `notes[]`.
  - `items[].foodId`는 실제 음식 ID라서 그대로 `POST /meals`로 기록할 수 있다.
- 오류
  - 프로필이 없거나 유지 열량을 계산할 수 없으면 409 `PROFILE_REQUIRED`.
  - `goal` 값이 틀리면 400.
  - `variant`가 범위 밖이면 400 `fieldErrors.variant`.
