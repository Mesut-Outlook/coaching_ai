-- Mobil portal RPC'lerinin işlevsel testi (npm run verify:schema içinde koşar).
-- plpgsql gövdesi `create function` sırasında derlenmez; fonksiyon ÇAĞRILMADAN
-- "could not identify an equality operator for type json" gibi hatalar görünmez.
-- 2026-10-26'dan 2026-11-02'ye kadar bütün portal bu yüzden açılmadı.

\set ON_ERROR_STOP on

do $$
declare
  v_inst uuid;
  v_coach uuid := '22222222-2222-2222-2222-222222222222';
  v_student uuid;
  v_exam uuid;
  v_subject int;
  v_topic int;
  v_es int;
  v_et1 int;
  v_et2 int;
  v_week date := date_trunc('week', current_date)::date;
  v_code text;
  v_res json;
begin
  insert into institutions (name, slug) values ('Portal Test', 'portal-test')
    on conflict (slug) do nothing;
  select id into v_inst from institutions where slug = 'portal-test';

  insert into auth.users (id, email) values (v_coach, 'portal@test.local')
    on conflict (id) do nothing;
  insert into profiles (id, full_name, role) values (v_coach, 'Portal Koç', 'Koç')
    on conflict (id) do nothing;

  insert into students (coach_id, institution_id, full_name, grade, track,
                        student_access_code, parent_access_code)
  values (v_coach, v_inst, 'Portal Denek', '12. Sınıf', 'SAY', 'STU-PORTAL', 'PAR-PORTAL')
  returning id into v_student;

  insert into subjects (name, color, soru_sayisi) values ('Portal Dersi', '#000000', '40')
  returning id into v_subject;
  insert into topics (subject_id, name) values (v_subject, 'Portal Konusu')
  returning id into v_topic;

  -- Aynı konuda iki başarılı görev: improved_topics tek satıra inmeli (DISTINCT dalı).
  insert into weekly_tasks (student_id, week_start, day_index, topic_id, question_count,
                            completed, correct_count)
  values (v_student, v_week, 0, v_topic, 10, true, 9),
         (v_student, v_week, 1, v_topic, 10, true, 8);

  insert into mock_exams (student_id, name, exam_type, exam_date)
  values (v_student, 'Portal Deneme', 'TYT', current_date) returning id into v_exam;
  insert into mock_exam_sections (mock_exam_id, section_name, max_questions, correct_count, wrong_count)
  values (v_exam, 'Türkçe', 40, 30, 4);

  insert into coach_decisions (student_id, topic_id, state, note, decided_by)
  values (v_student, v_topic, 'gelisiyor', 'Portal notu', v_coach);
  insert into attendance_records (student_id, absence_date) values (v_student, current_date);

  -- Derinlik: karne konusu bağlantıları, konu testi ve hedef net.
  insert into exam_subjects (exam_type, section_name, subject_id, label, question_count)
  values ('TYT', 'Türkçe', v_subject, 'Portal Alt Ders', 10) returning id into v_es;
  insert into exam_topics (exam_subject_id, name) values (v_es, 'Karne A') returning id into v_et1;
  insert into exam_topics (exam_subject_id, name) values (v_es, 'Karne B') returning id into v_et2;
  insert into exam_topic_links (exam_topic_id, topic_id, is_primary)
  values (v_et1, v_topic, true), (v_et2, v_topic, false);
  insert into mock_exam_topic_results (mock_exam_id, exam_topic_id, question_count, correct_count, wrong_count)
  values (v_exam, v_et1, 5, 4, 1);
  update students set target_net_tyt = 90 where id = v_student;
  insert into topic_measurements (student_id, topic_id, source, source_label, correct_count, wrong_count, blank_count, accuracy_pct, measured_at)
  values (v_student, v_topic, 'konu_testi', 'Portal Testi', 7, 2, 1, 70, current_date);

  -- Portal anon olarak çağırır; yetkiyi de sınamak için rol değiştir.
  set local role anon;

  foreach v_code in array array['STU-PORTAL', 'PAR-PORTAL'] loop
    v_res := portal_login(v_code);
    if (v_res->>'ok')::boolean is not true then
      raise exception 'portal_login BAŞARISIZ (%): %', v_code, v_res;
    end if;

    v_res := portal_dashboard(v_code);
    if (v_res->>'ok')::boolean is not true then
      raise exception 'portal_dashboard BAŞARISIZ (%): %', v_code, v_res;
    end if;
    if json_array_length(v_res->'tasks') <> 2 then
      raise exception 'portal_dashboard görev sayısı yanlış: %', v_res->'tasks';
    end if;
    if json_array_length(v_res->'my_week'->'improved_topics') <> 1 then
      raise exception 'improved_topics tekilleşmedi: %', v_res->'my_week'->'improved_topics';
    end if;
    if v_res->'my_week'->'improved_topics'->0->>'topic_name' <> 'Portal Konusu' then
      raise exception 'improved_topics içeriği yanlış: %', v_res->'my_week'->'improved_topics';
    end if;

    v_res := portal_exam_report(v_code);
    if (v_res->>'ok')::boolean is not true then
      raise exception 'portal_exam_report BAŞARISIZ (%): %', v_code, v_res;
    end if;
    if json_array_length(v_res->'catalog'->'links') is distinct from 2 then
      raise exception 'catalog.links yanlış: %', v_res->'catalog'->'links';
    end if;
    if json_array_length(v_res->'catalog'->'curriculum_topics') is distinct from 1
       or v_res->'catalog'->'curriculum_topics'->0->>'name' is distinct from 'Portal Konusu' then
      raise exception 'catalog.curriculum_topics yanlış: %', v_res->'catalog'->'curriculum_topics';
    end if;
    if json_array_length(v_res->'catalog'->'homework') is distinct from 3 then
      raise exception 'catalog.homework yanlış: %', v_res->'catalog'->'homework';
    end if;
    if (v_res->'student'->>'target_net_tyt')::numeric is distinct from 90 then
      raise exception 'target_net_tyt yanlış: %', v_res->'student';
    end if;
  end loop;

  v_res := portal_dashboard('STU-YANLIS');
  if (v_res->>'ok')::boolean is not false then
    raise exception 'geçersiz kod kabul edildi: %', v_res;
  end if;

  raise notice 'Portal testleri geçti.';
end;
$$;
