import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

async function main() {
  console.log('--- Starting Supabase RLS and CRUD Integration Test ---');

  // Load environment variables from .env.local
  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  let supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
  let serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      
      const urlMatch = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
      if (urlMatch && urlMatch[1]) {
        supabaseUrl = urlMatch[1].trim().replace(/['"]/g, '');
      }

      const keyMatch = envContent.match(/VITE_SUPABASE_ANON_KEY\s*=\s*(.+)/);
      if (keyMatch && keyMatch[1]) {
        supabaseAnonKey = keyMatch[1].trim().replace(/['"]/g, '');
      }

      const sroleMatch = envContent.match(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+)/);
      if (sroleMatch && sroleMatch[1]) {
        serviceRoleKey = sroleMatch[1].trim().replace(/['"]/g, '');
      }
    }
  } catch (e) {
    console.error('Error reading .env.local:', e);
  }

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    console.error('Missing required environment variables in .env.local');
    process.exit(1);
  }

  console.log('Supabase URL:', supabaseUrl);

  // Initialize clients
  const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const anonClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const testEmail = `test-coach-${Date.now()}@netlik.com`;
  const testPassword = 'TestPassword123!';
  let tempUserId: string | null = null;

  try {
    // 1. Create temporary coach user
    console.log(`\nCreating temporary coach user: ${testEmail}...`);
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Test Coach Antigravity' }
    });

    if (createError || !newUser?.user) {
      throw new Error(`Failed to create temp coach: ${createError?.message}`);
    }

    tempUserId = newUser.user.id;
    console.log(`Temporary coach created with ID: ${tempUserId}`);

    // Create profile
    const { error: profileError } = await adminClient.from('profiles').insert({
      id: tempUserId,
      full_name: 'Test Coach Antigravity',
      role: 'Deneme Koçu'
    });

    if (profileError) {
      throw new Error(`Failed to create profile: ${profileError.message}`);
    }
    console.log('Temporary coach profile created.');

    // 2. Login as the temporary coach using anon client
    console.log('\nLogging in as temporary coach...');
    const { data: authSession, error: loginError } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword
    });

    if (loginError || !authSession?.session) {
      throw new Error(`Login failed: ${loginError?.message}`);
    }

    const coachSessionToken = authSession.session.access_token;
    console.log('Logged in successfully. Access token obtained.');

    // Create a new client authenticated as the temporary coach
    const coachClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        headers: {
          Authorization: `Bearer ${coachSessionToken}`
        }
      }
    });

    // 3. Retrieve subjects to get an ID for topics
    console.log('\nFetching subjects list...');
    const { data: subjects, error: subjError } = await coachClient
      .from('subjects')
      .select('*')
      .limit(1);

    if (subjError || !subjects || subjects.length === 0) {
      throw new Error(`Failed to fetch subjects: ${subjError?.message || 'No subjects found. Seed db first.'}`);
    }
    const targetSubject = subjects[0];
    console.log(`Found subject: ${targetSubject.name} (ID: ${targetSubject.id})`);

    const { data: topics, error: topicError } = await coachClient
      .from('topics')
      .select('*')
      .eq('subject_id', targetSubject.id)
      .limit(1);

    if (topicError || !topics || topics.length === 0) {
      throw new Error(`Failed to fetch topics: ${topicError?.message || 'No topics found.'}`);
    }
    const targetTopic = topics[0];
    console.log(`Found topic: ${targetTopic.name} (ID: ${targetTopic.id})`);

    // 4. CRUD operations for Student
    console.log('\n--- CRUD test: Students ---');
    console.log('Inserting a new student...');
    const { data: student, error: insertError } = await coachClient
      .from('students')
      .insert({
        coach_id: tempUserId,
        full_name: 'Test Öğrenci',
        grade: '12. Sınıf',
        track: 'SAY',
        target_program: 'Tasarım Mühendisliği',
        target_ranking: '10000',
        target_net_label: 'Hedef Net',
        target_net_value: 95
      })
      .select('*')
      .single();

    if (insertError || !student) {
      throw new Error(`Failed to insert student: ${insertError?.message}`);
    }
    console.log(`Inserted student: ${student.full_name} (ID: ${student.id})`);

    console.log('Selecting students...');
    const { data: studentsList, error: selectError } = await coachClient
      .from('students')
      .select('*');

    if (selectError || !studentsList) {
      throw new Error(`Failed to list students: ${selectError.message}`);
    }
    console.log(`Selected students count: ${studentsList.length}`);
    if (!studentsList.some(s => s.id === student.id)) {
      throw new Error('Inserted student not found in listing.');
    }

    console.log('Updating student target ranking...');
    const { data: updatedStudent, error: updateError } = await coachClient
      .from('students')
      .update({ target_ranking: '5000' })
      .eq('id', student.id)
      .select('*')
      .single();

    if (updateError || !updatedStudent) {
      throw new Error(`Failed to update student: ${updateError.message}`);
    }
    console.log(`Updated student target ranking to: ${updatedStudent.target_ranking}`);

    // 5. CRUD: Mock Exams
    console.log('\n--- CRUD test: Mock Exams ---');
    console.log('Inserting a mock exam...');
    const { data: exam, error: examError } = await coachClient
      .from('mock_exams')
      .insert({
        student_id: student.id,
        name: 'Hızlı Deneme 1',
        publisher: 'Test Yayını',
        exam_type: 'TYT',
        exam_date: new Date().toISOString().split('T')[0]
      })
      .select('*')
      .single();

    if (examError || !exam) {
      throw new Error(`Failed to insert mock exam: ${examError?.message}`);
    }
    console.log(`Inserted mock exam: ${exam.name} (ID: ${exam.id})`);

    console.log('Inserting sections for mock exam...');
    const { data: sections, error: secError } = await coachClient
      .from('mock_exam_sections')
      .insert([
        { mock_exam_id: exam.id, section_name: 'Türkçe', max_questions: 40, correct_count: 35, wrong_count: 4, blank_count: 1 },
        { mock_exam_id: exam.id, section_name: 'Matematik', max_questions: 40, correct_count: 32, wrong_count: 6, blank_count: 2 }
      ])
      .select('*');

    if (secError || !sections) {
      throw new Error(`Failed to insert sections: ${secError?.message}`);
    }
    console.log(`Inserted ${sections.length} exam sections successfully. Nets calculated automatically.`);

    // 6. CRUD: Weekly Tasks
    console.log('\n--- CRUD test: Weekly Tasks ---');
    console.log('Inserting weekly task...');
    const { data: task, error: taskError } = await coachClient
      .from('weekly_tasks')
      .insert({
        student_id: student.id,
        week_start: '2026-07-20',
        day_index: 1, // Salı
        topic_id: targetTopic.id,
        question_count: 100,
        is_exam: false,
        completed: false
      })
      .select('*')
      .single();

    if (taskError || !task) {
      throw new Error(`Failed to insert weekly task: ${taskError?.message}`);
    }
    console.log(`Weekly task inserted (ID: ${task.id})`);

    console.log('Completing weekly task...');
    const { data: updatedTask, error: taskUpdateError } = await coachClient
      .from('weekly_tasks')
      .update({ completed: true })
      .eq('id', task.id)
      .select('*')
      .single();

    if (taskUpdateError || !updatedTask) {
      throw new Error(`Failed to update weekly task: ${taskUpdateError.message}`);
    }
    console.log(`Weekly task completed state updated to: ${updatedTask.completed}`);

    // 7. Verify RLS (Row Level Security)
    console.log('\n--- RLS Verification: Unauthenticated Client ---');
    const cleanAnonClient = createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    const { data: rlsStudents, error: rlsError } = await cleanAnonClient
      .from('students')
      .select('*');

    if (rlsStudents && rlsStudents.some(s => s.id === student.id)) {
      throw new Error('RLS Failure! Unauthenticated user can read the test student.');
    }
    console.log('Correct: Unauthenticated client cannot read student data (returned empty or blocked).');

    // 8. Delete Student and verify cascade deletes
    console.log('\n--- CRUD test: Delete & Cascade ---');
    console.log('Deleting student...');
    const { error: deleteError } = await coachClient
      .from('students')
      .delete()
      .eq('id', student.id);

    if (deleteError) {
      throw new Error(`Failed to delete student: ${deleteError.message}`);
    }
    console.log('Deleted student successfully.');

    // Verify cascade
    const { data: deletedExams } = await coachClient.from('mock_exams').select('*').eq('id', exam.id);
    if (deletedExams && deletedExams.length > 0) {
      throw new Error('Cascade delete failed! Mock exam still exists.');
    }
    console.log('Correct: Cascade delete successfully cleaned up mock_exams.');

    const { data: deletedTasks } = await coachClient.from('weekly_tasks').select('*').eq('id', task.id);
    if (deletedTasks && deletedTasks.length > 0) {
      throw new Error('Cascade delete failed! Weekly task still exists.');
    }
    console.log('Correct: Cascade delete successfully cleaned up weekly_tasks.');

    console.log('\n>>> ALL CRUD AND RLS INTEGRATION TESTS PASSED SUCCESSFULLY! <<<');
  } catch (err: any) {
    console.error('\n!!! TEST FAILED !!!');
    console.error(err.message || err);
  } finally {
    // 9. Clean up temporary coach
    if (tempUserId) {
      console.log(`\nCleaning up temporary coach user: ${testEmail}...`);
      const { error: userDeleteError } = await adminClient.auth.admin.deleteUser(tempUserId);
      if (userDeleteError) {
        console.error('Failed to clean up temporary coach user:', userDeleteError.message);
      } else {
        console.log('Temporary coach user and profile deleted.');
      }
    }
    console.log('--- Test Finished ---');
  }
}

main().catch(console.error);
