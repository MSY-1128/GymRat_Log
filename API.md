# API 계약
/api/v1, JSON camelCase, YYYY-MM-DD, 숫자 단위 kcal/g/min. 생성 201, 조회/수정 200, 삭제 204. DTO 반환.

| Method | Path | 입력 또는 결과 |
|---|---|---|
| GET | /profile | 프로필 + bmrKcal/tdeeKcal, 미설정이면 204 |
| PUT | /profile | age, sexForFormula(nullable), heightCm, weightKg, activityFactor, goal, dailyTargetKcal(nullable) |
| GET | /foods?q=&page=0&size=20 | {items,page,size,totalElements} |
| POST | /foods | name,kcal,carbsG,proteinG,fatG,servingGrams(nullable); 영양은 100g 기준 |
| GET | /exercises | {id,name,met,source} 배열 |
| GET | /meals?date=YYYY-MM-DD | 기록 배열 |
| POST | /meals | date,mealType,foodId,grams |
| PUT | /meals/{id} | date,mealType,foodId,grams |
| DELETE | /meals/{id} | 삭제 |
| GET | /workouts?date=YYYY-MM-DD | 운동 기록 배열 |
| POST | /workouts | date,exerciseId,minutes |
| PUT | /workouts/{id} | date,exerciseId,minutes |
| DELETE | /workouts/{id} | 삭제 |
| GET | /summary?date=YYYY-MM-DD | date,consumedKcal,targetKcal,remainingKcal,exerciseKcal,exerciseMinutes,carbsG,proteinG,fatG |
| GET | /stats?from=YYYY-MM-DD&to=YYYY-MM-DD | 일별 summary 배열; 최대 366일 |

기록 응답에는 id, 입력값, snapshot, calculatedKcal 포함. 클라이언트의 계산값을 신뢰하지 않고 서버에서 계산.
운동 생성 시 서버가 프로필 체중을 snapshot으로 저장. 프로필 체중 없으면 409 PROFILE_REQUIRED.
오류: {"code":"VALIDATION_ERROR","message":"입력값을 확인해 주세요.","fieldErrors":{"grams":"0보다 커야 합니다."}}
잘못된 입력 400, 없는 자원 404, 선행 프로필 누락 409, 서버 오류 500. 내부 예외/DB 정보 노출 금지. CORS 전체 허용 금지. 저장 성공 후 관련 Query를 무효화해 목록·요약·차트를 갱신.
