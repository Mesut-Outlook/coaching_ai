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
