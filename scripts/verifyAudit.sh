#!/usr/bin/env bash
# audit_log trigger'ının GERÇEKTEN çalıştığını kanıtlar.
#
# verify:schema şemanın uygulandığını gösterir, davranışını göstermez. Denetim
# kaydında asıl risk sessiz başarısızlıktır: trigger kurulur, hiçbir hata vermez,
# ama yanlış aktör yazar / bağlamı çözemez / gürültüyü elemez. Bu test onu yakalar.
#
# Kullanım: npm run test:audit   (gereksinim: docker; Supabase'e BAĞLANMAZ)

set -uo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER="netlik-audit-verify-$$"

command -v docker >/dev/null 2>&1 || { echo "HATA: docker kurulu değil."; exit 1; }
cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▶ postgres:16 başlatılıyor…"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=netlik postgres:16 >/dev/null

ready=0
for _ in $(seq 1 90); do
  if docker exec "$CONTAINER" psql -U postgres -d netlik -c 'select 1' >/dev/null 2>&1; then
    ready=$((ready+1)); [ "$ready" -ge 3 ] && break
  else ready=0; fi
  sleep 1
done
[ "$ready" -ge 3 ] || { echo "HATA: postgres hazır olmadı."; exit 1; }
sleep 1

for f in supabase/test/stub.sql supabase/schema.sql supabase/test/audit_test.sql; do
  docker cp "$REPO_ROOT/$f" "$CONTAINER:/tmp/" >/dev/null
done

docker exec "$CONTAINER" psql -U postgres -d netlik -q -f /tmp/stub.sql   >/dev/null 2>&1
docker exec "$CONTAINER" psql -U postgres -d netlik -q -f /tmp/schema.sql >/dev/null 2>&1

echo "▶ denetim testleri koşuluyor…"
OUT="$(docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -f /tmp/audit_test.sql 2>&1)"
CODE=$?
echo "$OUT" | grep -E "NOTICE|ERROR|BAŞARISIZ" || true
if [ $CODE -ne 0 ] || echo "$OUT" | grep -q "ERROR"; then
  echo "❌ Denetim testleri BAŞARISIZ."
  exit 1
fi
echo "✅ Denetim kaydı davranışsal olarak doğrulandı."
