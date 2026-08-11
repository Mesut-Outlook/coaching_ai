#!/usr/bin/env bash
# supabase/schema.sql'i temiz bir postgres:16 konteynerinde İKİ KEZ çalıştırır.
#
# NEDEN İKİ KEZ: schema.sql'i Supabase SQL Editor'de çalıştıran kullanıcıdır ve dosyanın
# idempotent olması şarttır (bkz. CLAUDE.md "Bilinmesi gereken tuzaklar") — tekrar
# çalıştırıp düzeltebilmek dosyanın varlık sebebi. Tek koşu yeşil olup ikinci koşu
# patlayan gerçek bir hata 2026-08-11'de bu testle yakalandı: yetki koruma trigger'ları
# kendilerinden ÖNCE gelen seed'leri, migration bağlamında auth.uid() NULL olduğu için
# reddediyordu.
#
# Kullanım: npm run verify:schema
# Gereksinim: docker. Supabase'e BAĞLANMAZ, hiçbir gerçek veriye dokunmaz.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA="$REPO_ROOT/supabase/schema.sql"
STUB="$REPO_ROOT/supabase/test/stub.sql"
CONTAINER="netlik-schema-verify-$$"
IMAGE="postgres:16"

for f in "$SCHEMA" "$STUB"; do
  [ -f "$f" ] || { echo "HATA: bulunamadı: $f"; exit 1; }
done

command -v docker >/dev/null 2>&1 || { echo "HATA: docker kurulu değil."; exit 1; }
docker info >/dev/null 2>&1 || { echo "HATA: docker çalışmıyor / erişilemiyor."; exit 1; }

cleanup() { docker rm -f "$CONTAINER" >/dev/null 2>&1 || true; }
trap cleanup EXIT

echo "▶ postgres:16 konteyneri başlatılıyor…"
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=netlik "$IMAGE" >/dev/null

# ⚠️ postgres resmi imajı başlarken İKİ KEZ ayağa kalkar: önce initdb için geçici bir
# sunucu, sonra asıl sunucu. Tek bir başarılı yoklama geçici sunucuya denk gelebilir ve
# hemen ardından bağlantı kopar. Bu yüzden üst üste 3 başarılı sorgu şartı aranıyor.
ready=0
for _ in $(seq 1 90); do
  if docker exec "$CONTAINER" psql -U postgres -d netlik -c 'select 1' >/dev/null 2>&1; then
    ready=$((ready + 1))
    [ "$ready" -ge 3 ] && break
  else
    ready=0
  fi
  sleep 1
done
[ "$ready" -ge 3 ] || { echo "HATA: postgres hazır olmadı."; docker logs "$CONTAINER" 2>&1 | tail -10; exit 1; }

docker cp "$STUB" "$CONTAINER:/tmp/stub.sql" >/dev/null
docker cp "$SCHEMA" "$CONTAINER:/tmp/schema.sql" >/dev/null

echo "▶ Supabase taklidi (auth/storage/roller) yükleniyor…"
docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -q -f /tmp/stub.sql >/dev/null \
  || { echo "HATA: stub yüklenemedi."; exit 1; }

run_pass() {
  local n="$1" log="/tmp/pass$1.log" rc
  docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -q -f /tmp/schema.sql \
    >"$log" 2>&1
  rc=$?
  echo "▶ $n. koşu → çıkış kodu $rc"
  if [ "$rc" -ne 0 ]; then
    echo "── hata çıktısı ──"
    grep -E "ERROR:|FATAL:|CONTEXT:" "$log" | head -15
    echo "──────────────────"
  fi
  return $rc
}

FAILED=0
docker exec "$CONTAINER" bash -c 'true'  # noop, exec yolu sıcak
run_pass 1 || FAILED=1
if [ "$FAILED" -eq 0 ]; then
  run_pass 2 || { FAILED=1; echo "  ⚠️ 1. koşu geçip 2. koşu patladı → ŞEMA IDEMPOTENT DEĞİL."; }
fi

if [ "$FAILED" -eq 0 ]; then
  echo "▶ İçerik kontrolü:"
  docker exec "$CONTAINER" psql -U postgres -d netlik -q -c "
    select 'kurum' as ne, count(*) from institutions
    union all select 'izin katalogu', count(*) from permission_catalog
    union all select 'sablon rol',    count(*) from roles where institution_id is null
    union all select 'politika',      count(*) from pg_policies where schemaname='public'
    union all select 'rls acik tablo',count(*) from pg_tables t
      join pg_class c on c.relname = t.tablename
      where t.schemaname='public' and c.relrowsecurity;"
  echo
  echo "✅ schema.sql iki kez arka arkaya hatasız çalıştı (idempotent)."
else
  echo
  echo "❌ Doğrulama başarısız — schema.sql bu haliyle Supabase'de çalıştırılmamalı."
fi

exit $FAILED
