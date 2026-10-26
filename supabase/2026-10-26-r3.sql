create or replace function audit_row()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_old jsonb;
  v_new jsonb;
  v_rec jsonb;
  v_student uuid;
  v_inst uuid;
  v_row_id text;
begin
  -- Gerçekten değişmediyse yazma: arayüz her kaydetmede tüm alanları gönderiyor.
  if TG_OP = 'UPDATE' and to_jsonb(OLD) = to_jsonb(NEW) then
    return NEW;
  end if;

  -- weekly_tasks'ta yalnız 'completed' değiştiyse atla. Öğrenci portalda her gün
  -- onlarca kutu işaretliyor; denetim değeri düşük, logun en büyük kalemi bu olur.
  -- 'completed_at' (R1-1) aynı işaretlemeyle trigger'ca yazılır, o da gürültü sayılır.
  if TG_TABLE_NAME = 'weekly_tasks' and TG_OP = 'UPDATE'
     and (to_jsonb(OLD) - 'completed' - 'completed_at') = (to_jsonb(NEW) - 'completed' - 'completed_at') then
    return NEW;
  end if;

  begin
    v_old := case when TG_OP in ('UPDATE','DELETE') then to_jsonb(OLD) end;
    v_new := case when TG_OP in ('INSERT','UPDATE') then to_jsonb(NEW) end;

    if TG_TABLE_NAME = 'students' then
      v_old := audit_redact(v_old);
      v_new := audit_redact(v_new);
    end if;

    v_rec := coalesce(v_new, v_old);
    v_row_id := coalesce(v_rec->>'id', '?');

    -- Bağlam yazarken çözülür: silinen satırın kurumu sonradan bulunamaz,
    -- bulunamayan kurum ise RLS'i çürütür.
    if TG_TABLE_NAME = 'students' then
      v_student := (v_rec->>'id')::uuid;
      v_inst := nullif(v_rec->>'institution_id','')::uuid;
    elsif TG_TABLE_NAME in ('weekly_tasks','topic_measurements','coach_decisions','attendance_records','mock_exams','ogrenci_tercih_listeleri') then
      v_student := nullif(v_rec->>'student_id','')::uuid;
      select s.institution_id into v_inst from students s where s.id = v_student;
    elsif TG_TABLE_NAME in ('mock_exam_sections','error_basket_items','mock_exam_subject_results','mock_exam_topic_results') then
      select e.student_id, s.institution_id into v_student, v_inst
      from mock_exams e left join students s on s.id = e.student_id
      where e.id = nullif(v_rec->>'mock_exam_id','')::uuid;
    elsif TG_TABLE_NAME in ('memberships','invitations','roles') then
      v_inst := nullif(v_rec->>'institution_id','')::uuid;
    elsif TG_TABLE_NAME = 'institutions' then
      v_inst := (v_rec->>'id')::uuid;
    end if;

    insert into audit_log (
      actor_id, actor_label, actor_name, institution_id, student_id,
      table_name, row_id, action, old_row, new_row
    ) values (
      auth.uid(),
      audit_actor_label(),
      (select p.full_name from profiles p where p.id = auth.uid()),
      v_inst, v_student,
      TG_TABLE_NAME, v_row_id, lower(TG_OP), v_old, v_new
    );
  exception when others then
    -- Denetim hatası iş akışını KESMEMELİ: koçun öğrenci kaydedememesi,
    -- log tutulamamasından daha kötü. En azından hatayı kaydetmeye çalış.
    begin
      insert into audit_log (actor_label, table_name, row_id, action, new_row)
      values ('sistem', TG_TABLE_NAME, coalesce(v_row_id,'?'), lower(TG_OP),
              jsonb_build_object('audit_error', SQLERRM));
    exception when others then null;
    end;
  end;

  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$fn$;

create or replace function portal_dashboard(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $fn$
declare
  v_student_id uuid;
  v_role text;
  v_week date;
  v_result json;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;

  select coalesce(
    (select wt.week_start from weekly_tasks wt
      where wt.student_id = v_student_id
        and wt.week_start = date_trunc('week', current_date)::date
      limit 1),
    (select max(wt.week_start) from weekly_tasks wt where wt.student_id = v_student_id)
  ) into v_week;

  select json_build_object(
    'ok', true,
    'role', v_role,
    'week_start', v_week,
    'is_current_week', (v_week = date_trunc('week', current_date)::date),
    'student', (
      select json_build_object(
        'id', s.id, 'full_name', s.full_name, 'grade', s.grade, 'track', s.track,
        'target_program', s.target_program, 'target_ranking', s.target_ranking,
        'photo_url', s.photo_url
      ) from students s where s.id = v_student_id
    ),
    'my_week', (
      select json_build_object(
        'total_tasks', coalesce((select count(*) from weekly_tasks wt where wt.student_id = v_student_id and wt.week_start = v_week), 0),
        'completed_tasks', coalesce((select count(*) from weekly_tasks wt where wt.student_id = v_student_id and wt.week_start = v_week and wt.completed = true), 0),
        'target_net', case
          when s.grade in ('7. Sınıf', '8. Sınıf') then s.target_net_lgs
          else coalesce(s.target_net_tyt, s.target_net_ayt)
        end,
        'latest_net', (
          select case
            when me.exam_type = 'LGS' then (
              select round(coalesce(sum(
                case
                  when ms.section_name in ('Türkçe', 'Matematik', 'Fen Bilimleri') then ms.net * 4
                  else ms.net * 1
                end
              ), 0), 2)
              from mock_exam_sections ms
              where ms.mock_exam_id = me.id
            )
            else (
              select round(coalesce(sum(ms.net), 0), 2)
              from mock_exam_sections ms
              where ms.mock_exam_id = me.id
            )
          end
          from mock_exams me
          where me.student_id = v_student_id
          order by me.exam_date desc, me.created_at desc
          limit 1
        ),
        'latest_exam_type', (
          select me.exam_type
          from mock_exams me
          where me.student_id = v_student_id
          order by me.exam_date desc, me.created_at desc
          limit 1
        ),
        'days_to_exam', (
          select (ec.exam_date - current_date)
          from exam_calendar ec
          where ec.exam = case when s.grade in ('7. Sınıf', '8. Sınıf') then 'LGS' else 'YKS' end
          limit 1
        ),
        'coach_latest_note', (
          select cd.note
          from coach_decisions cd
          where cd.student_id = v_student_id
            and coalesce(btrim(cd.note), '') <> ''
          order by cd.decided_at desc
          limit 1
        ),
        'focus_topics', coalesce((
          select json_agg(distinct coalesce(wt.custom_label, tp.name, 'Görev'))
          from weekly_tasks wt
          left join topics tp on tp.id = wt.topic_id
          where wt.student_id = v_student_id and wt.week_start = v_week
        ), '[]'::json),
        'improved_topics', coalesce((
          select json_agg(distinct json_build_object('topic_name', tp.name, 'subject_name', sb.name))
          from weekly_tasks wt
          join topics tp on tp.id = wt.topic_id
          left join subjects sb on sb.id = tp.subject_id
          where wt.student_id = v_student_id
            and wt.week_start = v_week
            and wt.completed = true
            and wt.correct_count is not null
            and wt.question_count > 0
            and (wt.correct_count::numeric / wt.question_count) >= 0.7
        ), '[]'::json)
      ) from students s where s.id = v_student_id
    ),
    'tasks', coalesce((
      select json_agg(t order by t.day_index, t.created_at) from (
        select wt.id, wt.day_index, wt.week_start, wt.question_count,
               wt.is_exam, wt.completed, wt.created_at,
               coalesce(wt.custom_label, tp.name, 'Görev') as label,
               sb.name as subject_name
        from weekly_tasks wt
        left join topics tp on tp.id = wt.topic_id
        left join subjects sb on sb.id = tp.subject_id
        where wt.student_id = v_student_id and wt.week_start = v_week
      ) t
    ), '[]'::json),
    'exams', coalesce((
      select json_agg(e order by e.exam_date desc, e.created_at desc) from (
        select me.id, me.name, me.publisher, me.exam_type, me.exam_date, me.created_at,
          coalesce((select sum(ms.net) from mock_exam_sections ms where ms.mock_exam_id = me.id), 0) as total_net,
          coalesce((
            select json_agg(json_build_object(
              'section_name', ms.section_name, 'max_questions', ms.max_questions,
              'correct_count', ms.correct_count, 'wrong_count', ms.wrong_count,
              'blank_count', ms.blank_count, 'net', ms.net
            ) order by ms.section_name)
            from mock_exam_sections ms where ms.mock_exam_id = me.id
          ), '[]'::json) as sections
        from mock_exams me
        where me.student_id = v_student_id
        order by me.exam_date desc, me.created_at desc
        limit 20
      ) e
    ), '[]'::json),
    'attendance', coalesce((
      select json_agg(a order by a.absence_date desc) from (
        select ar.id, ar.absence_date, ar.session_type, ar.status,
               ar.excuse_type, ar.excuse_note
        from attendance_records ar
        where ar.student_id = v_student_id
        order by ar.absence_date desc
        limit 50
      ) a
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$fn$;
grant execute on function portal_dashboard(text) to anon, authenticated;


-- ===========================================================================
-- Raporlar 2.0 · R3-0 — Şema ve Veri Modeli Genişletmeleri (Idempotent)
-- ===========================================================================

-- 1. weekly_tasks: duration_min kolonu (R4-3)
alter table weekly_tasks add column if not exists duration_min smallint;

-- 2. parent_summary_log: Veli özeti görüntüleme ve WhatsApp logu (R3-6)
create table if not exists parent_summary_log (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  week_start date not null,
  opened_at timestamptz not null default now(),
  opened_by uuid default auth.uid(),
  channel text not null default 'whatsapp'
);

create index if not exists parent_summary_log_student_week_idx on parent_summary_log(student_id, week_start desc);

alter table parent_summary_log enable row level security;

drop policy if exists "parent_summary_log: öğrenciyi görebilen koç okur" on parent_summary_log;
create policy "parent_summary_log: öğrenciyi görebilen koç okur" on parent_summary_log
  for select to authenticated using (
    (select is_system_admin()) or exists (
      select 1 from students s
      where s.id = parent_summary_log.student_id
    )
  );

drop policy if exists "parent_summary_log: öğrenciyi görebilen koç ekler" on parent_summary_log;
create policy "parent_summary_log: öğrenciyi görebilen koç ekler" on parent_summary_log
  for insert to authenticated with check (
    (select is_system_admin()) or exists (
      select 1 from students s
      where s.id = parent_summary_log.student_id
    )
  );

-- 3. topic_weights: ÖSYM / MEB konu soru dağılım ağırlıkları (R4-1)
create table if not exists topic_weights (
  id serial primary key,
  exam_type text not null check (exam_type in ('TYT', 'AYT', 'LGS')),
  exam_topic_id int not null references exam_topics(id) on delete cascade,
  avg_questions numeric(5,2) not null,
  source text not null,
  year_from int,
  year_to int,
  unique (exam_type, exam_topic_id, source)
);

create index if not exists topic_weights_exam_topic_idx on topic_weights(exam_type, exam_topic_id);

alter table topic_weights enable row level security;

drop policy if exists "topic_weights: herkes okur" on topic_weights;
create policy "topic_weights: herkes okur" on topic_weights
  for select to authenticated using (true);

drop policy if exists "topic_weights: yetkili koç ekler" on topic_weights;
create policy "topic_weights: yetkili koç ekler" on topic_weights
  for insert to authenticated with check (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  );

drop policy if exists "topic_weights: yetkili koç günceller" on topic_weights;
create policy "topic_weights: yetkili koç günceller" on topic_weights
  for update to authenticated using (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  ) with check (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  );

drop policy if exists "topic_weights: yetkili koç siler" on topic_weights;
create policy "topic_weights: yetkili koç siler" on topic_weights
  for delete to authenticated using (
    (select is_system_admin()) or (select user_has_any_permission('curriculum.manage'))
  );
