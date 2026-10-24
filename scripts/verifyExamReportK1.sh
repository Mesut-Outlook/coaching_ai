#!/usr/bin/env bash
# scripts/verifyExamReportK1.sh
# K1 Docker Doğrulaması:
# Sıra: eski şema (git HEAD:schema.sql) -> yeni şema -> yeni şema tekrar (idempotentlik).
# Ardından:
#   1. save_exam_report RPC ile TYT denemesi kaydı
#   2. Aynı denemeyi bir konu satırı eksik olarak tekrar kaydetme -> silinmeli
#   3. D+Y > S ihlali -> hata vermeli
#   4. LGS satırında net = D - Y/3 olmalı

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCHEMA="$REPO_ROOT/supabase/schema.sql"
STUB="$REPO_ROOT/supabase/test/stub.sql"
CONTAINER="netlik-k1-verify-$$"
IMAGE="postgres:16"

cleanup() {
  echo "Temizleniyor: $CONTAINER..."
  docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
  rm -f /tmp/old_schema_$$.sql /tmp/test_runner_$$.sql
}
trap cleanup EXIT

echo "=============================================="
echo "K1 DOCKER DOĞRULAMASI BAŞLIYOR"
echo "=============================================="

echo "▶ 1. git HEAD'deki eski schema.sql çıkartılıyor..."
git show HEAD:supabase/schema.sql > "/tmp/old_schema_$$.sql"

echo "▶ 2. postgres:16 konteyneri başlatılıyor..."
docker run -d --name "$CONTAINER" -e POSTGRES_PASSWORD=test -e POSTGRES_DB=netlik "$IMAGE" >/dev/null

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
[ "$ready" -ge 3 ] || { echo "HATA: postgres hazır olmadı."; exit 1; }

docker cp "$STUB" "$CONTAINER:/tmp/stub.sql" >/dev/null
docker cp "/tmp/old_schema_$$.sql" "$CONTAINER:/tmp/old_schema.sql" >/dev/null
docker cp "$SCHEMA" "$CONTAINER:/tmp/new_schema.sql" >/dev/null

echo "▶ 3. Supabase stub'ları yükleniyor..."
docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -q -f /tmp/stub.sql >/dev/null

echo "▶ 4. Eski şema yükleniyor (git HEAD)..."
docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -q -f /tmp/old_schema.sql >/dev/null
echo "   ✓ Eski şema başarıyla yüklendi."

echo "▶ 5. Yeni şema yükleniyor (Geçiş / Migration)..."
docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -q -f /tmp/new_schema.sql >/dev/null
echo "   ✓ Yeni şema başarıyla uygulandı."

echo "▶ 6. Yeni şema 2. kez çalıştırılıyor (İdempotentlik denetimi)..."
docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -q -f /tmp/new_schema.sql >/dev/null
echo "   ✓ Yeni şema tekrar hatasız çalıştı (idempotent)."

echo "▶ 7. Test verileri hazırlanıyor ve save_exam_report RPC testleri koşuluyor..."

cat << 'EOF' > "/tmp/test_runner_$$.sql"
\set ON_ERROR_STOP on

-- Test kullanıcısı, kurum ve öğrenci kur
do $$
declare
  v_user_id uuid := '11111111-1111-1111-1111-111111111111'::uuid;
  v_inst_id uuid;
  v_student_tyt uuid := '22222222-2222-2222-2222-222222222222'::uuid;
  v_student_lgs uuid := '33333333-3333-3333-3333-333333333333'::uuid;
  v_role_id uuid;
  v_sub_tr int;
  v_sub_lgs_mat int;
  v_es_tyt_tr int;
  v_et_tyt_tr1 int;
  v_et_tyt_tr2 int;
  v_es_lgs_mat int;
  v_et_lgs_mat1 int;
  v_exam_id uuid;
  v_cnt int;
  v_net numeric;
  v_error_caught boolean := false;
begin
  -- 1. Kurum
  select id into v_inst_id from institutions limit 1;

  -- 2. Auth user & profile
  insert into auth.users (id, email) values (v_user_id, 'koc@test.com') on conflict (id) do nothing;
  insert into profiles (id, full_name, role) values (v_user_id, 'Test Koç', 'koc') on conflict (id) do nothing;

  -- 3. Rol (exams.manage izinli)
  select id into v_role_id from roles where institution_id is null and 'exams.manage' = any(permissions) limit 1;
  insert into memberships (institution_id, user_id, role_id, is_active)
  values (v_inst_id, v_user_id, v_role_id, true)
  on conflict do nothing;

  -- 4. Öğrenciler (YKS ve LGS)
  insert into students (id, coach_id, institution_id, full_name, grade, track)
  values
    (v_student_tyt, v_user_id, v_inst_id, 'TYT Öğrencisi', '12. Sınıf', 'SAY'),
    (v_student_lgs, v_user_id, v_inst_id, 'LGS Öğrencisi', '8. Sınıf', null)
  on conflict (id) do nothing;

  -- 5. Referans ders ve katalog verisi
  insert into subjects (name, color, soru_sayisi, sort_order, curriculum)
  values ('TYT Türkçe', '#4f46e5', '40', 1, 'YKS')
  on conflict (curriculum, name) do update set name = excluded.name
  returning id into v_sub_tr;

  insert into subjects (name, color, soru_sayisi, sort_order, curriculum)
  values ('Matematik', '#7c3aed', '20', 2, 'LGS')
  on conflict (curriculum, name) do update set name = excluded.name
  returning id into v_sub_lgs_mat;

  -- exam_subjects
  insert into exam_subjects (exam_type, section_name, subject_id, label, question_count, sort_order)
  values ('TYT', 'Türkçe', v_sub_tr, 'Türkçe', 40, 1)
  on conflict (exam_type, section_name, label) do update set question_count = excluded.question_count
  returning id into v_es_tyt_tr;

  insert into exam_topics (exam_subject_id, name, sort_order)
  values (v_es_tyt_tr, 'Sözcükte Anlam', 1)
  on conflict (exam_subject_id, name) do update set sort_order = excluded.sort_order
  returning id into v_et_tyt_tr1;

  insert into exam_topics (exam_subject_id, name, sort_order)
  values (v_es_tyt_tr, 'Cümlede Anlam', 2)
  on conflict (exam_subject_id, name) do update set sort_order = excluded.sort_order
  returning id into v_et_tyt_tr2;

  insert into exam_subjects (exam_type, section_name, subject_id, label, question_count, sort_order)
  values ('LGS', 'Matematik', v_sub_lgs_mat, 'Matematik', 20, 1)
  on conflict (exam_type, section_name, label) do update set question_count = excluded.question_count
  returning id into v_es_lgs_mat;

  insert into exam_topics (exam_subject_id, name, sort_order)
  values (v_es_lgs_mat, 'Çarpanlar ve Katlar', 1)
  on conflict (exam_subject_id, name) do update set sort_order = excluded.sort_order
  returning id into v_et_lgs_mat1;

  -- Koç oturumu taklidi: request.jwt.claim.sub = v_user_id
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);

  -- -------------------------------------------------------------------------
  -- TEST A: TYT denemesi kaydı
  -- -------------------------------------------------------------------------
  v_exam_id := save_exam_report(jsonb_build_object(
    'student_id', v_student_tyt,
    'name', 'Konsept TYT-1',
    'publisher', 'Hız ve Renk',
    'exam_type', 'TYT',
    'exam_date', '2026-10-24',
    'score', 426.442,
    'percentile', 7.34,
    'coach_note', 'Tebrikler güzel başlangıç',
    'ranks', jsonb_build_object('genel', jsonb_build_object('sira', 120, 'katilan', 4500)),
    'sections', jsonb_build_array(
      jsonb_build_object('section_name', 'Türkçe', 'max_questions', 40, 'correct_count', 35, 'wrong_count', 4)
    ),
    'subject_results', jsonb_build_array(
      jsonb_build_object('exam_subject_id', v_es_tyt_tr, 'question_count', 40, 'correct_count', 35, 'wrong_count', 4)
    ),
    'topic_results', jsonb_build_array(
      jsonb_build_object('exam_topic_id', v_et_tyt_tr1, 'question_count', 5, 'correct_count', 4, 'wrong_count', 1),
      jsonb_build_object('exam_topic_id', v_et_tyt_tr2, 'question_count', 5, 'correct_count', 5, 'wrong_count', 0)
    )
  ));

  select count(*) into v_cnt from mock_exam_topic_results where mock_exam_id = v_exam_id;
  if v_cnt <> 2 then
    raise exception 'TEST A BAŞARISIZ: 2 konu sonucu bekleniyordu, % bulundu', v_cnt;
  end if;
  raise notice '✓ TEST A GEÇTİ: TYT denemesi atomik kaydedildi (id: %)', v_exam_id;

  -- -------------------------------------------------------------------------
  -- TEST B: Aynı denemeyi 1 konu eksik olarak tekrar kaydetme -> silinmeli
  -- -------------------------------------------------------------------------
  perform save_exam_report(jsonb_build_object(
    'id', v_exam_id,
    'student_id', v_student_tyt,
    'name', 'Konsept TYT-1 Güncel',
    'exam_type', 'TYT',
    'exam_date', '2026-10-24',
    'sections', jsonb_build_array(
      jsonb_build_object('section_name', 'Türkçe', 'max_questions', 40, 'correct_count', 35, 'wrong_count', 4)
    ),
    'subject_results', jsonb_build_array(
      jsonb_build_object('exam_subject_id', v_es_tyt_tr, 'question_count', 40, 'correct_count', 35, 'wrong_count', 4)
    ),
    'topic_results', jsonb_build_array(
      jsonb_build_object('exam_topic_id', v_et_tyt_tr1, 'question_count', 5, 'correct_count', 4, 'wrong_count', 1)
      -- v_et_tyt_tr2 bilerek ÇIKARILDI -> silinmeli
    )
  ));

  select count(*) into v_cnt from mock_exam_topic_results where mock_exam_id = v_exam_id;
  if v_cnt <> 1 then
    raise exception 'TEST B BAŞARISIZ: Çıkarılan konudan sonra 1 satır kalmalıydı, % bulundu', v_cnt;
  end if;
  select count(*) into v_cnt from mock_exam_topic_results where mock_exam_id = v_exam_id and exam_topic_id = v_et_tyt_tr2;
  if v_cnt <> 0 then
    raise exception 'TEST B BAŞARISIZ: Çıkarılan konu (id: %) silinmemiş', v_et_tyt_tr2;
  end if;
  raise notice '✓ TEST B GEÇTİ: Payload dışı bırakılan konu satırı başarıyla silindi.';

  -- -------------------------------------------------------------------------
  -- TEST C: D+Y > S ihlali -> HATA VERMELİ
  -- -------------------------------------------------------------------------
  begin
    perform save_exam_report(jsonb_build_object(
      'student_id', v_student_tyt,
      'name', 'Hatalı Deneme',
      'exam_type', 'TYT',
      'exam_date', '2026-10-24',
      'sections', jsonb_build_array(
        jsonb_build_object('section_name', 'Türkçe', 'max_questions', 40, 'correct_count', 30, 'wrong_count', 15) -- 30+15=45 > 40!
      )
    ));
  exception when others then
    v_error_caught := true;
    raise notice '✓ TEST C GEÇTİ: D+Y > S ihlali beklenen hatayı verdi: %', sqlerrm;
  end;

  if not v_error_caught then
    raise exception 'TEST C BAŞARISIZ: D+Y > S hatası fırlatılmadı!';
  end if;

  -- -------------------------------------------------------------------------
  -- TEST D: LGS satırında net = D - Y/3 olmalı (ceza: 3)
  -- -------------------------------------------------------------------------
  v_exam_id := save_exam_report(jsonb_build_object(
    'student_id', v_student_lgs,
    'name', 'Mozaik LGS-1',
    'exam_type', 'LGS',
    'exam_date', '2026-10-24',
    'sections', jsonb_build_array(
      jsonb_build_object('section_name', 'Matematik', 'max_questions', 20, 'correct_count', 10, 'wrong_count', 3)
    ),
    'subject_results', jsonb_build_array(
      jsonb_build_object('exam_subject_id', v_es_lgs_mat, 'question_count', 20, 'correct_count', 10, 'wrong_count', 3)
    ),
    'topic_results', jsonb_build_array(
      jsonb_build_object('exam_topic_id', v_et_lgs_mat1, 'question_count', 5, 'correct_count', 3, 'wrong_count', 1)
    )
  ));

  -- LGS: 10 doğru - 3 yanlış / 3 = 10 - 1 = 9.00 net olmalı
  select net into v_net from mock_exam_sections where mock_exam_id = v_exam_id and section_name = 'Matematik';
  if v_net <> 9.00 then
    raise exception 'TEST D BAŞARISIZ: mock_exam_sections.net 9.00 bekleniyordu, % bulundu', v_net;
  end if;

  select net into v_net from mock_exam_subject_results where mock_exam_id = v_exam_id and exam_subject_id = v_es_lgs_mat;
  if v_net <> 9.00 then
    raise exception 'TEST D BAŞARISIZ: mock_exam_subject_results.net 9.00 bekleniyordu, % bulundu', v_net;
  end if;

  raise notice '✓ TEST D GEÇTİ: LGS ceza oranı (3) doğru uygulandı -> D=10, Y=3 => Net=%', v_net;

end $$;
EOF

docker cp "/tmp/test_runner_$$.sql" "$CONTAINER:/tmp/test_runner.sql" >/dev/null
docker exec "$CONTAINER" psql -U postgres -d netlik -v ON_ERROR_STOP=1 -f /tmp/test_runner.sql

echo ""
echo "=============================================="
echo "✅ TÜM DOCKER TESTLERİ BAŞARIYLA GEÇTİ!"
echo "=============================================="
