# FitLog 실제 앱 구현 요청
현재 폴더의 SPEC.md, API.md, data.json, preview.html을 읽고 한국어 운동·식단 칼로리 관리 앱을 구현하세요. preview.html은 독립 시안이므로 React/Spring Boot 앱을 별도로 생성해야 합니다.

## 기술
- Java 21, Java 21을 지원하는 현재 안정 Spring Boot, Spring Data JPA, Bean Validation, Maven Wrapper.
- MySQL 8.4, Flyway. ddl-auto=validate. Docker Compose로 로컬 DB 제공.
- React + TypeScript + Vite, React Router, TanStack Query, Recharts, CSS Modules.
- backend/와 frontend/ 모노레포. 백엔드 8080, 프런트 5173. Vite에서 /api를 백엔드로 프록시하고 fetch는 상대경로 /api/v1 사용.
- 버전은 공식 문서로 호환성을 확인하고 고정하세요. package-lock.json과 Maven Wrapper를 포함하세요.

## 구현 방식
기존 파일/변경을 확인하고 간단한 계획 후 직접 구현하세요. DB 마이그레이션 → API → React 화면 → 연결 → 테스트까지 완료하세요. 설명만 하고 끝내지 마세요.
로컬 PC 단일 사용자 MVP입니다. 서버/개발 서버는 기본 127.0.0.1 바인딩. 로그인 없는 상태로 외부에 공개하지 마세요. GitHub 소스 공개와 서비스 배포는 별개입니다.
오늘/식단/운동/기록/설정 화면, 프로필 저장, 음식 검색·직접 등록, 식단 및 운동 CRUD, 날짜 이동, 최근 7일 차트를 만드세요. 실제 API/DB 저장 후 새로고침해도 기록을 유지해야 합니다.
JPA Entity를 응답으로 직접 반환하지 말고 DTO, 서비스 트랜잭션, 공통 예외 처리를 적용하세요. 계산의 기준은 서버입니다.
data.json은 demo 프로필의 빈 DB에 한 번만 seed하고 source=DEMO 표시를 유지하세요. profileExample은 사용자 프로필로 자동 저장하지 마세요. ID는 DB에서 생성하고 sample ID와 매핑하세요. 삭제한 seed를 재시작 시 복원하지 마세요.
JUnit으로 계산식·입력 검증·과거 snapshot 유지 검증, Spring Boot/MySQL 통합 테스트로 CRUD/합계 검증, Vitest로 화면 오류·기록 갱신 검증을 수행하세요. CI에 backend test와 frontend test/typecheck/build를 구성하세요.
README에 설치·DB 실행·환경변수·백엔드/프런트 실행·테스트 명령과 실제 선택 버전을 기록하세요. .env는 자동 로딩된다고 가정하지 말고 Compose env_file 또는 명시적 주입을 구현하세요.
.env.example, .gitignore를 준비하고 비밀값/실제 개인 기록은 커밋하지 마세요. 원격 push는 사용자가 요청할 때 실행하세요.
실행하지 않은 테스트를 성공했다고 보고하지 마세요. 완료 시 실제 결과, 실행법, 남은 한계를 정리하세요.
