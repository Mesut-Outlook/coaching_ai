-- Portal deneme analizi: konu bağlantıları, ödev/konu testi sonuçları ve hedef net eklendi. Supabase SQL Editor'de bir kez çalıştır (idempotent).
create or replace function portal_exam_report(p_code text)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_student_id uuid;
  v_role text;
  v_result json;
begin
  select r.student_id, r.portal_role into v_student_id, v_role
  from portal_resolve_code(p_code) r;

  if v_student_id is null then
    return json_build_object('ok', false, 'error', 'Geçersiz erişim kodu.');
  end if;

  select json_build_object(
    'ok', true,
    'role', v_role,
    'student', (
      select json_build_object(
        'id', s.id, 'full_name', s.full_name, 'grade', s.grade, 'track', s.track,
        'target_net_tyt', s.target_net_tyt, 'target_net_ayt', s.target_net_ayt,
        'target_net_lgs', s.target_net_lgs
      ) from students s where s.id = v_student_id
    ),
    'catalog', json_build_object(
      'subjects', coalesce((
        select json_agg(json_build_object(
          'id', es.id,
          'exam_type', es.exam_type,
          'section_name', es.section_name,
          'subject_id', es.subject_id,
          'label', es.label,
          'question_count', es.question_count,
          'choice_group', es.choice_group,
          'sort_order', es.sort_order
        ) order by es.sort_order, es.id)
        from exam_subjects es
      ), '[]'::json),
      'topics', coalesce((
        select json_agg(json_build_object(
          'id', et.id,
          'exam_subject_id', et.exam_subject_id,
          'name', et.name,
          'grades', et.grades,
          'sort_order', et.sort_order,
          'is_active', et.is_active
        ) order by et.sort_order, et.id)
        from exam_topics et
        where et.is_active = true
      ), '[]'::json),
      'links', coalesce((
        select json_agg(json_build_object(
          'exam_topic_id', l.exam_topic_id, 'topic_id', l.topic_id, 'is_primary', l.is_primary
        ) order by l.exam_topic_id, l.topic_id)
        from exam_topic_links l
        join exam_topics et on et.id = l.exam_topic_id and et.is_active = true
      ), '[]'::json),
      'curriculum_topics', coalesce((
        select json_agg(json_build_object(
          'id', t.id, 'name', t.name, 'subject_name', sj.name
        ) order by t.id)
        from topics t
        join subjects sj on sj.id = t.subject_id
        where t.id in (
          select l.topic_id from exam_topic_links l
          join exam_topics et on et.id = l.exam_topic_id and et.is_active = true
        )
      ), '[]'::json),
      'homework', coalesce((
        select json_agg(h order by h.date desc) from (
          select * from (
            select tp.id as topic_id,
              (wt.week_start + wt.day_index) as date,
              coalesce(nullif(wt.custom_label, ''), tp.name || ' · ' || wt.question_count || ' soru') as label,
              wt.question_count,
              wt.correct_count, wt.wrong_count, wt.blank_count,
              round(wt.correct_count * 100.0 / wt.question_count, 1) as accuracy_pct,
              'odev' as kind
            from weekly_tasks wt
            join topics tp on tp.id = wt.topic_id
            where wt.student_id = v_student_id
              and wt.block_kind = 'ders'
              and wt.topic_id is not null
              and wt.correct_count is not null
              and wt.question_count > 0
            union all
            select tm.topic_id, tm.measured_at, tm.source_label,
              coalesce(tm.correct_count, 0) + coalesce(tm.wrong_count, 0) + coalesce(tm.blank_count, 0),
              tm.correct_count, tm.wrong_count, tm.blank_count,
              tm.accuracy_pct,
              'konu_testi'
            from topic_measurements tm
            where tm.student_id = v_student_id and tm.source = 'konu_testi'
          ) u
          where u.date >= current_date - 365
          order by u.date desc
          limit 300
        ) h
      ), '[]'::json)
    ),
    'exams', coalesce((
      select json_agg(e order by e.exam_date desc, e.created_at desc) from (
        select
          me.id,
          me.student_id,
          me.name,
          me.publisher,
          me.exam_type,
          me.exam_date,
          me.score,
          me.percentile,
          me.ranks,
          me.coach_note,
          me.created_at,
          coalesce((
            select json_agg(json_build_object(
              'section_name', ms.section_name,
              'max_questions', ms.max_questions,
              'correct_count', ms.correct_count,
              'wrong_count', ms.wrong_count,
              'blank_count', ms.blank_count,
              'wrong_penalty', ms.wrong_penalty,
              'net', ms.net
            ) order by ms.section_name)
            from mock_exam_sections ms where ms.mock_exam_id = me.id
          ), '[]'::json) as sections,
          coalesce((
            select json_agg(json_build_object(
              'exam_subject_id', sr.exam_subject_id,
              'question_count', sr.question_count,
              'correct_count', sr.correct_count,
              'wrong_count', sr.wrong_count,
              'blank_count', sr.blank_count,
              'wrong_penalty', sr.wrong_penalty,
              'net', sr.net
            ) order by sr.exam_subject_id)
            from mock_exam_subject_results sr where sr.mock_exam_id = me.id
          ), '[]'::json) as subject_results,
          coalesce((
            select json_agg(json_build_object(
              'exam_topic_id', tr.exam_topic_id,
              'question_count', tr.question_count,
              'correct_count', tr.correct_count,
              'wrong_count', tr.wrong_count,
              'blank_count', tr.blank_count
            ) order by tr.exam_topic_id)
            from mock_exam_topic_results tr where tr.mock_exam_id = me.id
          ), '[]'::json) as topic_results
        from mock_exams me
        where me.student_id = v_student_id
        order by me.exam_date desc, me.created_at desc
        limit 30
      ) e
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;
revoke all on function portal_exam_report(text) from public, anon, authenticated;
grant execute on function portal_exam_report(text) to anon, authenticated;
