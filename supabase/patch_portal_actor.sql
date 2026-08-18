-- Netlik — portal aktör damgası yaması
-- ---------------------------------------------------------------------------
-- schema.sql'deki bu iki fonksiyon canlıda güncellenmemiş (doğrulandı:
-- pg_get_functiondef içinde 'app.actor' yok). Damga olmadan öğrencinin portalda
-- yaptığı işlemler denetim kaydında 'sistem' görünüyor.
--
-- Bu dosya schema.sql'den birebir çıkarıldı; schema.sql'i tekrar çalıştırmak da
-- aynı sonucu verir, bu yalnızca kısa yol.
-- Tekrar tekrar çalıştırılabilir (create or replace).

create or replace function portal_set_task_completed(p_code text, p_task_id uuid, p_completed boolean)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid;
  v_role text;
  v_rows int;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;
  if v_role <> 'ogrenci' then
    return json_build_object('ok', false, 'error', 'Veli görev durumunu değiştiremez.');
  end if;

  -- Denetim aktörü: bu fonksiyon security definer + anon ile çalışıyor, yani
  -- auth.uid() null. İşaretlemeyi yapanın öğrenci olduğunu buradan bildiriyoruz.
  perform set_config('app.actor', 'ogrenci:' || v_student_id, true);

  update weekly_tasks set completed = coalesce(p_completed, false)
  where id = p_task_id and student_id = v_student_id;
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return json_build_object('ok', false, 'error', 'Görev bulunamadı.');
  end if;
  return json_build_object('ok', true);
end;
$$;
grant execute on function portal_set_task_completed(text, uuid, boolean) to anon, authenticated;

create or replace function portal_add_exam(
  p_code text,
  p_name text,
  p_publisher text,
  p_exam_type text,
  p_exam_date date,
  p_sections jsonb
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_student_id uuid;
  v_role text;
  v_exam_id uuid;
  v_bad int;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;
  if v_role <> 'ogrenci' then
    return json_build_object('ok', false, 'error', 'Veli deneme sonucu giremez.');
  end if;

  -- Bkz. portal_set_task_completed: aktör damgası olmadan öğrencinin girdiği
  -- deneme logda 'sistem' görünür.
  perform set_config('app.actor', 'ogrenci:' || v_student_id, true);
  if coalesce(btrim(p_name), '') = '' then
    return json_build_object('ok', false, 'error', 'Sınav adı gerekli.');
  end if;
  if p_exam_type not in ('TYT', 'AYT') then
    return json_build_object('ok', false, 'error', 'Sınav türü TYT veya AYT olmalı.');
  end if;
  if p_exam_date is null or p_exam_date > current_date then
    return json_build_object('ok', false, 'error', 'Sınav tarihi bugünden ileri olamaz.');
  end if;

  select count(*) into v_bad
  from jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb))
    as x(section_name text, max_questions int, correct_count int, wrong_count int, blank_count int)
  where coalesce(x.correct_count,0) < 0 or coalesce(x.wrong_count,0) < 0 or coalesce(x.blank_count,0) < 0
     or coalesce(x.correct_count,0) + coalesce(x.wrong_count,0) + coalesce(x.blank_count,0)
        > coalesce(x.max_questions, 0);
  if v_bad > 0 then
    return json_build_object('ok', false, 'error', 'Doğru + yanlış + boş, soru sayısını aşamaz.');
  end if;

  insert into mock_exams (student_id, name, publisher, exam_type, exam_date)
  values (v_student_id, btrim(p_name), nullif(btrim(coalesce(p_publisher, '')), ''), p_exam_type, p_exam_date)
  returning id into v_exam_id;

  insert into mock_exam_sections (mock_exam_id, section_name, max_questions, correct_count, wrong_count, blank_count)
  select v_exam_id, x.section_name, x.max_questions,
         coalesce(x.correct_count,0), coalesce(x.wrong_count,0), coalesce(x.blank_count,0)
  from jsonb_to_recordset(coalesce(p_sections, '[]'::jsonb))
    as x(section_name text, max_questions int, correct_count int, wrong_count int, blank_count int);

  return json_build_object('ok', true, 'exam_id', v_exam_id);
end;
$$;
grant execute on function portal_add_exam(text, text, text, text, date, jsonb) to anon, authenticated;
