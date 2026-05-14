#!/usr/bin/env bash
# seed/ad_data.sql 을 ooh-postgres 컨테이너에 restore.
# EC2 에서 실행. 사전 조건:
#   - seed/ad_data.sql 이 레포에 동봉되어 있거나 scp 로 올려둠
#   - postgres 컨테이너가 떠 있음 (docker compose up -d postgres)

set -euo pipefail

SQL_FILE="${SQL_FILE:-seed/ad_data.sql}"
CONTAINER="${CONTAINER:-ooh-postgres}"
DB="${DB:-ooh_recommend}"
USER="${USER:-postgres}"

if [ ! -f "$SQL_FILE" ]; then
  echo "❌ $SQL_FILE 없음. scp 로 EC2 에 올린 뒤 SQL_FILE=... 으로 지정."
  exit 1
fi

echo "==> pgvector 확장 보장"
docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"

echo "==> $SQL_FILE → $CONTAINER:/tmp/ 복사"
docker cp "$SQL_FILE" "$CONTAINER:/tmp/ad_data.sql"

echo "==> psql restore"
docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -v ON_ERROR_STOP=1 -f /tmp/ad_data.sql

echo "==> 행수 확인"
docker exec "$CONTAINER" psql -U "$USER" -d "$DB" -c "
  SELECT 'ad_media' AS t, COUNT(*) FROM ad_media
  UNION ALL SELECT 'sangwon_area', COUNT(*) FROM sangwon_area
  UNION ALL SELECT 'sangwon_population', COUNT(*) FROM sangwon_population;
"
echo "==> 완료"
