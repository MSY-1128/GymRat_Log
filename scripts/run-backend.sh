#!/usr/bin/env sh
# .env 를 읽어 환경변수로 명시 주입한 뒤 Spring Boot를 실행한다.
# 사용: ./scripts/run-backend.sh   (프로젝트 루트에서)
set -eu
ROOT=$(cd "$(dirname "$0")/.." && pwd)
ENV_FILE="$ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo ".env 파일이 없습니다. 먼저 'cp .env.example .env' 후 값을 수정하세요." >&2
  exit 1
fi

while IFS= read -r line || [ -n "$line" ]; do
  line=$(printf '%s' "$line" | tr -d '\r')
  case "$line" in ''|'#'*) continue ;; esac
  key=${line%%=*}
  val=${line#*=}
  case "$key" in
    SPRING_DATASOURCE_URL|SPRING_DATASOURCE_USERNAME|SPRING_DATASOURCE_PASSWORD|SPRING_PROFILES_ACTIVE|SERVER_PORT|SERVER_ADDRESS|MFDS_SERVICE_KEY|FOODSAFETY_API_KEY)
      export "$key=$val" ;;
  esac
done < "$ENV_FILE"

cd "$ROOT/backend"
exec ./mvnw spring-boot:run
