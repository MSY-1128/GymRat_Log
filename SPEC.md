# 제품 및 계산 명세
밝은 배경과 초록색 포인트의 한국어 모바일 대응 앱. 오늘·식단·운동·기록·설정 화면. 입력 label과 키보드 접근, 로딩·빈 상태·오류·재시도 제공. 삭제 확인 제공.

## 프로필과 계산
성인 참고용. age 19~100, heightCm 100~250, weightKg 30~350, activityFactor는 1.2/1.375/1.55/1.725/1.9 중 선택. 이 범위는 입력 검증용이며 건강 권장 범위가 아니다.
Mifflin-St Jeor 참고식: BMR=10×kg+6.25×cm−5×나이+상수. MALE=5, FEMALE=-161. 계산식용 성별 선택을 설명하고 미선택 시 BMR/TDEE는 null. TDEE=BMR×활동계수.
목표는 감량/유지/증량을 저장하되 칼로리는 사용자가 직접 설정한다. 초기 목표는 미설정. 섭취 목표가 없으면 남은 칼로리는 null.
음식 kcal/영양소=100g 기준 값×섭취g/100. g는 0 초과 5000 이하. 인분 단위는 servingGrams가 있는 음식만 지원.
운동 kcal=MET×3.5×체중kg/200×분. 운동 시간 1~1440분. 휴식 대사를 포함한 총 소모 추정치라고 표시.
남은 칼로리=목표−섭취량. 음수도 그대로 표시. 운동량은 별도 표시하고 섭취 목표에 자동 가산하지 않는다. 활동계수에 운동이 포함될 수 있어 중복 계산에 유의하도록 설명.
계산은 BigDecimal로 정밀도를 유지하고 합계 후 화면에서 kcal 정수, 영양소 소수 1자리로 반올림한다.

## DB
Profile, Food, Exercise, MealEntry, ExerciseEntry. 생성형 id, 생성/수정 시각.
Food: name, 100g 기준 kcal/carbsG/proteinG/fatG, servingGrams(nullable), source. 영양값 0 이상. 사용자 등록은 USER, 샘플은 DEMO.
Exercise: name, met(0 초과), source.
MealEntry: LocalDate date, mealType(BREAKFAST/LUNCH/DINNER/SNACK), food FK, grams, 음식명·기준 영양값 snapshot.
ExerciseEntry: LocalDate date, exercise FK, minutes, nameSnapshot, weightKgSnapshot, metSnapshot.
프로필/음식이 바뀌어도 과거 기록 계산값은 변하지 않는다. 운동 수정은 기존 체중을 유지하고 종류 변경 시에만 새 MET를 적용한다.
날짜는 브라우저 로컬 YYYY-MM-DD와 서버 LocalDate 사용. UTC 변환에 따른 날짜 이동 방지.
최근 7일은 빈 날짜도 0으로 채운다. 음식 검색은 길이 제한/페이지네이션. 기록은 날짜와 id로 안정 정렬.
의료 조언이 아닌 참고용 추정치임을 표시한다. 실제 음식 데이터는 추후 출처/라이선스/기준량을 확인해 연동한다.

## 후속 범위
로그인과 사용자별 데이터 격리, 실제 영양 API, 즐겨찾기, 내보내기/가져오기, 월간 분석은 MVP 이후 별도 작업. 공개 배포 전 인증과 사용자 격리가 필수.
