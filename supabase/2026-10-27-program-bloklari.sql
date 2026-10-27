-- ===========================================================================
-- P — Saatli program blokları ve "Görev Ekle" penceresi (2026-10-27)
-- ===========================================================================

-- 1. weekly_tasks yeni kolonlar: start_time, block_kind, subject_id
alter table weekly_tasks add column if not exists start_time time;
alter table weekly_tasks add column if not exists block_kind text not null default 'ders';
alter table weekly_tasks add column if not exists subject_id int references subjects(id) on delete set null;

-- 2. block_kind check kısıtı ('ders', 'mola', 'serbest')
alter table weekly_tasks drop constraint if exists weekly_tasks_block_kind_ck;
alter table weekly_tasks add constraint weekly_tasks_block_kind_ck
  check (block_kind in ('ders', 'mola', 'serbest'));

-- 3. Geriye dönük subject_id doldurma
update weekly_tasks w
set subject_id = t.subject_id
from topics t
where w.topic_id = t.id and w.subject_id is null;

-- 4. Trigger: insert veya update'te topic_id doluysa subject_id'yi topics'ten doldur
create or replace function trg_weekly_tasks_subject_id()
returns trigger
language plpgsql
as $$
begin
  if NEW.topic_id is not null then
    select t.subject_id into NEW.subject_id
    from topics t
    where t.id = NEW.topic_id;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_weekly_tasks_subject_id on weekly_tasks;
create trigger trg_weekly_tasks_subject_id
before insert or update on weekly_tasks
for each row execute function trg_weekly_tasks_subject_id();

-- 5. portal_dashboard güncellemesi
create or replace function portal_dashboard(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
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
        'total_tasks', coalesce((select count(*) from weekly_tasks wt where wt.student_id = v_student_id and wt.week_start = v_week and wt.block_kind = 'ders'), 0),
        'completed_tasks', coalesce((select count(*) from weekly_tasks wt where wt.student_id = v_student_id and wt.week_start = v_week and wt.completed = true and wt.block_kind = 'ders'), 0),
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
          where wt.student_id = v_student_id and wt.week_start = v_week and wt.block_kind = 'ders'
        ), '[]'::json),
        'improved_topics', coalesce((
          select json_agg(distinct json_build_object('topic_name', tp.name, 'subject_name', sb.name))
          from weekly_tasks wt
          join topics tp on tp.id = wt.topic_id
          left join subjects sb on sb.id = tp.subject_id
          where wt.student_id = v_student_id
            and wt.week_start = v_week
            and wt.completed = true
            and wt.block_kind = 'ders'
            and wt.correct_count is not null
            and wt.question_count > 0
            and (wt.correct_count::numeric / wt.question_count) >= 0.7
        ), '[]'::json)
      ) from students s where s.id = v_student_id
    ),
    'tasks', coalesce((
      select json_agg(t order by t.day_index, t.start_time nulls last, t.created_at) from (
        select wt.id, wt.day_index, wt.week_start, wt.question_count,
               wt.is_exam, wt.completed, wt.created_at,
               wt.start_time, wt.duration_min, wt.block_kind,
               coalesce(wt.custom_label, tp.name, 'Görev') as label,
               coalesce(sb_direct.name, sb_tp.name) as subject_name
        from weekly_tasks wt
        left join topics tp on tp.id = wt.topic_id
        left join subjects sb_tp on sb_tp.id = tp.subject_id
        left join subjects sb_direct on sb_direct.id = wt.subject_id
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

-- 6. portal_set_task_completed: Yalnızca ders blokları tamamlanabilir
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

  perform set_config('app.actor', 'ogrenci:' || v_student_id, true);

  update weekly_tasks set completed = coalesce(p_completed, false)
  where id = p_task_id and student_id = v_student_id and block_kind = 'ders';
  get diagnostics v_rows = row_count;

  if v_rows = 0 then
    return json_build_object('ok', false, 'error', 'Görev bulunamadı.');
  end if;
  return json_build_object('ok', true);
end;
$$;
grant execute on function portal_set_task_completed(text, uuid, boolean) to anon, authenticated;
