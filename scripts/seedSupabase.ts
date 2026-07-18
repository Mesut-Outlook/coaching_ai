import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/database';

// Helper to subtract days
function subtractDays(date: Date, days: number): string {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result.toISOString().split('T')[0];
}

// Get Monday of a week
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

// HSL to Hex colors for subjects
const subjectConfig: Record<string, { color: string; soru_sayisi: string; sort_order: number }> = {
  'Türkçe': { color: '#4f46e5', soru_sayisi: '40', sort_order: 1 },
  'Matematik': { color: '#7c3aed', soru_sayisi: '30', sort_order: 2 },
  'Geometri': { color: '#9333ea', soru_sayisi: '10', sort_order: 3 },
  'Fizik': { color: '#2563eb', soru_sayisi: '7', sort_order: 4 },
  'Kimya': { color: '#0d9488', soru_sayisi: '7', sort_order: 5 },
  'Biyoloji': { color: '#16a34a', soru_sayisi: '6', sort_order: 6 },
  'Tarih': { color: '#d97706', soru_sayisi: '5', sort_order: 7 },
  'Coğrafya': { color: '#059669', soru_sayisi: '5', sort_order: 8 },
  'Felsefe': { color: '#0891b2', soru_sayisi: '5', sort_order: 9 },
  'Din Kültürü': { color: '#e11d48', soru_sayisi: '5', sort_order: 10 },
};

async function main() {
  console.log('Starting Supabase seeding process...');

  // Parse environment variables manually from .env.local
  let supabaseUrl = process.env.VITE_SUPABASE_URL;
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      const match = envContent.match(/VITE_SUPABASE_URL\s*=\s*(.+)/);
      if (match && match[1]) {
        supabaseUrl = match[1].trim().replace(/['"]/g, '');
      }
    }
  } catch (e) {
    // Ignore
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('Error: VITE_SUPABASE_URL (in .env.local or environment) and SUPABASE_SERVICE_ROLE_KEY (in environment) are required.');
    process.exit(1);
  }

  const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 1. Get or Create a Coach User in auth.users
  const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('Error listing auth users:', usersError);
    process.exit(1);
  }

  let coachId: string;
  const users = usersData?.users || [];

  if (users.length === 0) {
    console.log('No auth users found. Creating a default coach user...');
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: 'koc@netlik.com',
      password: 'Password123!',
      email_confirm: true,
      user_metadata: { full_name: 'Eda Cangert' }
    });
    if (createError) {
      console.error('Error creating coach user:', createError);
      process.exit(1);
    }
    coachId = newUser.user.id;
    console.log(`Created default coach user: koc@netlik.com (${coachId})`);
  } else {
    coachId = users[0].id;
    console.log(`Using existing coach user: ${users[0].email} (${coachId})`);
  }

  // Ensure profile exists for the coach in public.profiles
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', coachId)
    .single();

  if (!profile) {
    console.log('Creating profile record for coach...');
    const { error: profileError } = await supabase.from('profiles').insert({
      id: coachId,
      full_name: 'Eda Cangert',
      role: 'Kurucu Koç'
    });
    if (profileError) {
      console.error('Error creating profile:', profileError);
    }
  }

  // 2. Load subjects and topics from tytSubjects.json
  const subjectsJsonPath = path.join(process.cwd(), 'src', 'tytSubjects.json');
  if (!fs.existsSync(subjectsJsonPath)) {
    console.error(`Error: subjects file not found at ${subjectsJsonPath}`);
    process.exit(1);
  }

  const tytSubjects = JSON.parse(fs.readFileSync(subjectsJsonPath, 'utf8'));

  console.log('Clearing existing subjects and topics...');
  // Cascade delete handles topics
  await supabase.from('subjects').delete().neq('id', 0);

  console.log('Seeding subjects and topics...');
  const topicsMap: Record<string, number> = {}; // topic_name -> topic_id

  for (const [subjectName, topicsList] of Object.entries(tytSubjects)) {
    const config = subjectConfig[subjectName] || { color: '#6b7280', soru_sayisi: '5', sort_order: 100 };
    
    const { data: subjectData, error: subjectError } = await supabase
      .from('subjects')
      .insert({
        name: subjectName,
        color: config.color,
        soru_sayisi: config.soru_sayisi,
        sort_order: config.sort_order,
      })
      .select('id')
      .single();

    if (subjectError) {
      console.error(`Error inserting subject ${subjectName}:`, subjectError);
      continue;
    }

    const subjectId = subjectData.id;

    // Insert topics for this subject
    const topicsToInsert = (topicsList as string[]).map((topicName, idx) => ({
      subject_id: subjectId,
      name: topicName,
      sort_order: idx + 1,
    }));

    const { data: insertedTopics, error: topicsError } = await supabase
      .from('topics')
      .insert(topicsToInsert)
      .select('id, name');

    if (topicsError) {
      console.error(`Error inserting topics for ${subjectName}:`, topicsError);
    } else if (insertedTopics) {
      insertedTopics.forEach(t => {
        topicsMap[`${subjectName}:${t.name}`] = t.id;
      });
    }
  }

  // 3. Clear existing students and mock data
  console.log('Clearing existing students...');
  await supabase.from('students').delete().eq('coach_id', coachId);

  // 4. Seed 5 students with realistic YKS tracks
  console.log('Seeding mock students and related data...');
  const studentsToInsert = [
    {
      coach_id: coachId,
      full_name: 'Deniz Yılmaz',
      grade: '12. Sınıf' as const,
      track: 'SAY' as const,
      target_program: 'Boğaziçi Üniversitesi Bilgisayar Mühendisliği',
      target_ranking: 'İlk 1000',
      target_net_label: 'Hedef Net',
      target_net_value: 112,
    },
    {
      coach_id: coachId,
      full_name: 'Elif Demir',
      grade: 'Mezun' as const,
      track: 'EA' as const,
      target_program: 'Galatasaray Üniversitesi Hukuk Fakültesi',
      target_ranking: 'İlk 1500',
      target_net_label: 'Hedef Net',
      target_net_value: 104,
    },
    {
      coach_id: coachId,
      full_name: 'Can Kaya',
      grade: '12. Sınıf' as const,
      track: 'SAY' as const,
      target_program: 'Hacettepe Üniversitesi Tıp Fakültesi (Türkçe)',
      target_ranking: 'İlk 5000',
      target_net_label: 'Hedef Net',
      target_net_value: 106,
    },
    {
      coach_id: coachId,
      full_name: 'Zeynep Çelik',
      grade: '12. Sınıf' as const,
      track: 'EA' as const,
      target_program: 'Boğaziçi Üniversitesi İşletme',
      target_ranking: 'İlk 3000',
      target_net_label: 'Hedef Net',
      target_net_value: 98,
    },
    {
      coach_id: coachId,
      full_name: 'Mert Şahin',
      grade: 'Mezun' as const,
      track: 'SÖZ' as const,
      target_program: 'Boğaziçi Üniversitesi Tarih',
      target_ranking: 'İlk 2000',
      target_net_label: 'Hedef Net',
      target_net_value: 95,
    },
  ];

  const today = new Date();

  for (const studentInfo of studentsToInsert) {
    const { data: student, error: studentError } = await supabase
      .from('students')
      .insert(studentInfo)
      .select('id')
      .single();

    if (studentError || !student) {
      console.error(`Error inserting student ${studentInfo.full_name}:`, studentError);
      continue;
    }

    const studentId = student.id;
    console.log(`Seeding mock data for ${studentInfo.full_name}...`);

    // 4.1 Seed Mock Exams
    const publishers = ['3D Yayınları', 'Özdebir', 'Limit', 'Bilgi Sarmal', 'Karekök', 'Endemik'];
    const examCount = 6;
    const tytBase = studentInfo.track === 'SAY' ? 75 : (studentInfo.track === 'EA' ? 70 : 60);
    const aytBase = studentInfo.track === 'SAY' ? 50 : (studentInfo.track === 'EA' ? 45 : 35);

    for (let i = 1; i <= examCount; i++) {
      const examDate = subtractDays(today, (examCount - i) * 14 + Math.floor(Math.random() * 3));

      // Create TYT
      const { data: tytExam } = await supabase
        .from('mock_exams')
        .insert({
          student_id: studentId,
          name: `${publishers[i - 1]} TYT - ${i}`,
          publisher: publishers[i - 1],
          exam_type: 'TYT',
          exam_date: examDate,
        })
        .select('id')
        .single();

      if (tytExam) {
        // Add TYT sections
        const improvement = i * 3.5;
        const totalTytNet = tytBase + improvement + (Math.random() * 5 - 2.5);
        
        let trCorrect, matCorrect, sosCorrect, fenCorrect;
        if (studentInfo.track === 'SAY') {
          trCorrect = Math.min(40, Math.round(totalTytNet * 0.3 + 5));
          matCorrect = Math.min(40, Math.round(totalTytNet * 0.4 + 5));
          fenCorrect = Math.min(20, Math.round(totalTytNet * 0.2 + 2));
          sosCorrect = Math.min(20, Math.round(totalTytNet * 0.1));
        } else if (studentInfo.track === 'EA') {
          trCorrect = Math.min(40, Math.round(totalTytNet * 0.35 + 5));
          matCorrect = Math.min(40, Math.round(totalTytNet * 0.35 + 5));
          sosCorrect = Math.min(20, Math.round(totalTytNet * 0.2 + 2));
          fenCorrect = Math.min(20, Math.round(totalTytNet * 0.1));
        } else { // SÖZ
          trCorrect = Math.min(40, Math.round(totalTytNet * 0.4 + 5));
          sosCorrect = Math.min(20, Math.round(totalTytNet * 0.4 + 2));
          matCorrect = Math.min(40, Math.round(totalTytNet * 0.15 + 2));
          fenCorrect = Math.min(20, Math.round(totalTytNet * 0.05));
        }

        const sections = [
          { mock_exam_id: tytExam.id, section_name: 'Türkçe', max_questions: 40, correct_count: trCorrect, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
          { mock_exam_id: tytExam.id, section_name: 'Matematik', max_questions: 40, correct_count: matCorrect, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
          { mock_exam_id: tytExam.id, section_name: 'Sosyal Bilimler', max_questions: 20, correct_count: sosCorrect, wrong_count: Math.floor(Math.random() * 3), blank_count: 0 },
          { mock_exam_id: tytExam.id, section_name: 'Fen Bilimleri', max_questions: 20, correct_count: fenCorrect, wrong_count: Math.floor(Math.random() * 3), blank_count: 0 },
        ];
        
        sections.forEach(s => {
          s.blank_count = s.max_questions - (s.correct_count + s.wrong_count);
        });

        await supabase.from('mock_exam_sections').insert(sections);
      }

      // Create AYT
      const { data: aytExam } = await supabase
        .from('mock_exams')
        .insert({
          student_id: studentId,
          name: `${publishers[i - 1]} AYT - ${i}`,
          publisher: publishers[i - 1],
          exam_type: 'AYT',
          exam_date: examDate,
        })
        .select('id')
        .single();

      if (aytExam) {
        // Add AYT sections based on track
        const improvement = i * 3;
        const totalAytNet = aytBase + improvement + (Math.random() * 4 - 2);

        let sections: any[] = [];
        if (studentInfo.track === 'SAY') {
          const mat = Math.min(40, Math.round(totalAytNet * 0.55 + 5));
          const fen = Math.min(40, Math.round(totalAytNet * 0.45 + 5));
          sections = [
            { mock_exam_id: aytExam.id, section_name: 'Matematik', max_questions: 40, correct_count: mat, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
            { mock_exam_id: aytExam.id, section_name: 'Fen Bilimleri', max_questions: 40, correct_count: fen, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
          ];
        } else if (studentInfo.track === 'EA') {
          const mat = Math.min(40, Math.round(totalAytNet * 0.5 + 5));
          const edb = Math.min(40, Math.round(totalAytNet * 0.5 + 5));
          sections = [
            { mock_exam_id: aytExam.id, section_name: 'Matematik', max_questions: 40, correct_count: mat, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
            { mock_exam_id: aytExam.id, section_name: 'Edebiyat-Sosyal1', max_questions: 40, correct_count: edb, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
          ];
        } else { // SÖZ
          const edb = Math.min(40, Math.round(totalAytNet * 0.5 + 5));
          const sos2 = Math.min(40, Math.round(totalAytNet * 0.5 + 5));
          sections = [
            { mock_exam_id: aytExam.id, section_name: 'Edebiyat-Sosyal1', max_questions: 40, correct_count: edb, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
            { mock_exam_id: aytExam.id, section_name: 'Sosyal Bilimler-2', max_questions: 40, correct_count: sos2, wrong_count: Math.floor(Math.random() * 4), blank_count: 0 },
          ];
        }

        sections.forEach(s => {
          s.blank_count = s.max_questions - (s.correct_count + s.wrong_count);
        });

        await supabase.from('mock_exam_sections').insert(sections);
      }
    }

    // 4.2 Seed Subject Measurements & Coach Decisions
    // Let's pick 5 random topics and assign measurements + coach decisions
    const selectedSubjectNames = studentInfo.track === 'SAY' ? ['Matematik', 'Fizik', 'Kimya', 'Biyoloji'] : ['Matematik', 'Tarih', 'Coğrafya', 'Türkçe'];
    const chosenTopics: { id: number; name: string; subject: string }[] = [];
    
    for (const [subjName, list] of Object.entries(tytSubjects)) {
      if (selectedSubjectNames.includes(subjName)) {
        const listCast = list as string[];
        // Pick 2 topics
        for (let k = 0; k < Math.min(2, listCast.length); k++) {
          const tName = listCast[k];
          const tId = topicsMap[`${subjName}:${tName}`];
          if (tId) {
            chosenTopics.push({ id: tId, name: tName, subject: subjName });
          }
        }
      }
    }

    for (let index = 0; index < chosenTopics.length; index++) {
      const topic = chosenTopics[index];
      
      // Topic Measurement
      await supabase.from('topic_measurements').insert({
        student_id: studentId,
        topic_id: topic.id,
        source: 'konu_testi',
        source_label: 'Tarama Testi',
        correct_count: 15,
        wrong_count: 3,
        blank_count: 2,
        accuracy_pct: 75.0,
        measured_at: subtractDays(today, 5 + index),
      });

      // Coach Decision (mix of states)
      const states = ['yeterli', 'gelisiyor', 'kritik'] as const;
      await supabase.from('coach_decisions').insert({
        student_id: studentId,
        topic_id: topic.id,
        state: states[index % 3],
        note: `${topic.name} konusunda gelişim istikrarlı. Haftalık soru hedeflerine uyuluyor.`,
        decided_by: coachId,
      });
    }

    // 4.3 Seed Weekly Tasks (for past week, this week, next week)
    const weeksToSeed = [-7, 0, 7]; // offsets in days
    const mondayToday = getMonday(today);

    for (const offset of weeksToSeed) {
      const weekStartStr = subtractDays(mondayToday, -offset);
      
      // Add 4 tasks per week
      for (let day = 0; day < 5; day++) {
        // Pick a random topic from chosenTopics
        const randomTopic = chosenTopics[Math.floor(Math.random() * chosenTopics.length)];
        
        await supabase.from('weekly_tasks').insert({
          student_id: studentId,
          week_start: weekStartStr,
          day_index: day,
          topic_id: randomTopic.id,
          custom_label: null,
          question_count: 80 + day * 10,
          is_exam: false,
          completed: offset < 0 || (offset === 0 && day < today.getDay()),
        });
      }
      
      // Add weekend exam
      await supabase.from('weekly_tasks').insert({
        student_id: studentId,
        week_start: weekStartStr,
        day_index: 5, // Cumartesi
        topic_id: null,
        custom_label: 'TYT Deneme Çözümü',
        question_count: 120,
        is_exam: true,
        completed: offset < 0 || (offset === 0 && today.getDay() >= 6),
      });
    }
  }

  console.log('Seeding completed successfully!');
}

main().catch(err => {
  console.error('Error during seeding:', err);
  process.exit(1);
});
