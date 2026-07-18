const fs = require('fs');
const path = require('path');

// Helper to generate a random ID
function uuid() {
  return Math.random().toString(36).substring(2, 11);
}

// Helper to generate random integers
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Helper to subtract days from current date
function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result.toISOString().split('T')[0];
}

// Define YKS subjects by category
const subjectsData = {
  SAY: [
    { id: 'mat-temel', name: 'Temel Kavramlar', category: 'Matematik' },
    { id: 'mat-fonksiyon', name: 'Fonksiyonlar', category: 'Matematik' },
    { id: 'mat-limit', name: 'Limit ve Süreklilik', category: 'Matematik' },
    { id: 'mat-türev', name: 'Türev', category: 'Matematik' },
    { id: 'mat-integral', name: 'İntegral', category: 'Matematik' },
    { id: 'fiz-vektor', name: 'Vektörler ve Kuvvet', category: 'Fizik' },
    { id: 'fiz-optik', name: 'Optik', category: 'Fizik' },
    { id: 'fiz-elektrik', name: 'Elektriksel Kuvvet ve Alan', category: 'Fizik' },
    { id: 'fiz-modern', name: 'Modern Fizik', category: 'Fizik' },
    { id: 'kim-atom', name: 'Atom ve Periyodik Sistem', category: 'Kimya' },
    { id: 'kim-gazlar', name: 'Gazlar', category: 'Kimya' },
    { id: 'kim-organik', name: 'Organik Kimya', category: 'Kimya' },
    { id: 'biy-hucre', name: 'Hücre ve Organeller', category: 'Biyoloji' },
    { id: 'biy-sistemler', name: 'İnsan Fizyolojisi (Sistemler)', category: 'Biyoloji' },
    { id: 'biy-genetik', name: 'Genden Proteine', category: 'Biyoloji' },
  ],
  EA: [
    { id: 'mat-temel', name: 'Temel Kavramlar', category: 'Matematik' },
    { id: 'mat-fonksiyon', name: 'Fonksiyonlar', category: 'Matematik' },
    { id: 'mat-limit', name: 'Limit ve Süreklilik', category: 'Matematik' },
    { id: 'mat-türev', name: 'Türev', category: 'Matematik' },
    { id: 'edb-siir', name: 'Şiir Bilgisi', category: 'Edebiyat' },
    { id: 'edb-donemler', name: 'Edebi Dönemler', category: 'Edebiyat' },
    { id: 'edb-divan', name: 'Divan Edebiyatı', category: 'Edebiyat' },
    { id: 'edb-cumhuriyet', name: 'Cumhuriyet Dönemi', category: 'Edebiyat' },
    { id: 'tar-tarih', name: 'Tarih Bilimine Giriş', category: 'Tarih' },
    { id: 'tar-islam', name: 'İslam Tarihi', category: 'Tarih' },
    { id: 'tar-inkilap', name: 'Atatürk İlkeleri ve İnkılap Tarihi', category: 'Tarih' },
    { id: 'cogr-nufus', name: 'Nüfus ve Göç', category: 'Coğrafya' },
    { id: 'cogr-iklim', name: 'İklim Bilgisi', category: 'Coğrafya' },
  ],
  SOZ: [
    { id: 'edb-siir', name: 'Şiir Bilgisi', category: 'Edebiyat' },
    { id: 'edb-donemler', name: 'Edebi Dönemler', category: 'Edebiyat' },
    { id: 'edb-divan', name: 'Divan Edebiyatı', category: 'Edebiyat' },
    { id: 'edb-cumhuriyet', name: 'Cumhuriyet Dönemi', category: 'Edebiyat' },
    { id: 'tar-tarih', name: 'Tarih Bilimine Giriş', category: 'Tarih' },
    { id: 'tar-islam', name: 'İslam Tarihi', category: 'Tarih' },
    { id: 'tar-osmanli', name: 'Osmanlı Tarihi', category: 'Tarih' },
    { id: 'tar-inkilap', name: 'Atatürk İlkeleri ve İnkılap Tarihi', category: 'Tarih' },
    { id: 'cogr-iklim', name: 'İklim Bilgisi', category: 'Coğrafya' },
    { id: 'cogr-cevre', name: 'Çevre ve Toplum', category: 'Coğrafya' },
    { id: 'fel-felsefe', name: 'Felsefeyle Tanışma', category: 'Felsefe' },
    { id: 'fel-mantik', name: 'Mantığa Giriş', category: 'Felsefe' },
    { id: 'din-inanclar', name: 'İnanç ve İbadet', category: 'Din Kültürü' },
  ]
};

const students = [
  { id: 'std-1', name: 'Deniz Yılmaz', track: 'SAY', grade: '12', target: 'Boğaziçi Üniversitesi Bilgisayar Mühendisliği' },
  { id: 'std-2', name: 'Elif Demir', track: 'EA', grade: 'MEZUN', target: 'Galatasaray Üniversitesi Hukuk Fakültesi' },
  { id: 'std-3', name: 'Can Kaya', track: 'SAY', grade: '12', target: 'Hacettepe Üniversitesi Tıp Fakültesi (Türkçe)' },
  { id: 'std-4', name: 'Zeynep Çelik', track: 'EA', grade: '12', target: 'Boğaziçi Üniversitesi İşletme' },
  { id: 'std-5', name: 'Mert Şahin', track: 'SOZ', grade: 'MEZUN', target: 'Boğaziçi Üniversitesi Tarih' }
];

const mockData = {
  students: students,
  exams: [],
  subjectProficiencies: {},
  weeklyMeetings: [],
  tasks: []
};

// Generate data for each student
const today = new Date();

students.forEach(student => {
  const track = student.track;
  
  // 1. Generate Subject Proficiencies
  mockData.subjectProficiencies[student.id] = subjectsData[track].map(sub => {
    const statuses = ['YETERLI', 'GELISIYOR', 'KRITIK', 'OLCULMEDI'];
    // High-achieving student biases
    let status = statuses[randomInt(0, 3)];
    if (student.name === 'Deniz Yılmaz' || student.name === 'Elif Demir') {
      status = ['YETERLI', 'YETERLI', 'GELISIYOR', 'OLCULMEDI'][randomInt(0, 3)];
    }
    const accuracy = status === 'OLCULMEDI' ? null : (status === 'YETERLI' ? randomInt(76, 98) : (status === 'GELISIYOR' ? randomInt(51, 74) : randomInt(20, 49)));
    
    return {
      subjectId: sub.id,
      subjectName: sub.name,
      category: sub.category,
      status: status,
      lastTested: status === 'OLCULMEDI' ? undefined : subtractDays(today, randomInt(2, 20)),
      accuracy: accuracy || undefined
    };
  });

  // 2. Generate 6 TYT and 6 AYT Exams (over last 12 weeks)
  const examCount = 6;
  let tytStartNet = student.name === 'Deniz Yılmaz' ? 78 : (student.name === 'Elif Demir' ? 75 : (student.name === 'Mert Şahin' ? 55 : 62));
  let aytStartNet = student.name === 'Deniz Yılmaz' ? 52 : (student.name === 'Elif Demir' ? 45 : (student.name === 'Mert Şahin' ? 40 : 42));

  for (let i = 1; i <= examCount; i++) {
    const date = subtractDays(today, (examCount - i) * 14 + randomInt(0, 3));
    
    // --- TYT GENERATION ---
    const tytProgress = i * randomInt(2, 4); // General improvement
    const tytTotalNet = Math.min(118, tytStartNet + tytProgress + randomInt(-2, 3));
    
    // Distribute TYT questions (Max 40 Türkçe, 40 Matematik, 20 Sosyal, 20 Fen)
    // Distribution depends on student track
    let trNet, matNet, sosNet, fenNet;
    if (track === 'SAY') {
      trNet = Math.round(tytTotalNet * 0.3);
      matNet = Math.round(tytTotalNet * 0.4);
      fenNet = Math.round(tytTotalNet * 0.2);
      sosNet = Math.max(0, Math.round(tytTotalNet - (trNet + matNet + fenNet)));
    } else if (track === 'EA') {
      trNet = Math.round(tytTotalNet * 0.35);
      matNet = Math.round(tytTotalNet * 0.35);
      sosNet = Math.round(tytTotalNet * 0.2);
      fenNet = Math.max(0, Math.round(tytTotalNet - (trNet + matNet + sosNet)));
    } else { // SOZ
      trNet = Math.round(tytTotalNet * 0.4);
      sosNet = Math.round(tytTotalNet * 0.4);
      matNet = Math.round(tytTotalNet * 0.15);
      fenNet = Math.max(0, Math.round(tytTotalNet - (trNet + sosNet + matNet)));
    }

    const tytScores = {
      Turkce: { correct: Math.min(40, Math.round(trNet + randomInt(1, 3))), incorrect: randomInt(0, 4) },
      Matematik: { correct: Math.min(40, Math.round(matNet + randomInt(1, 3))), incorrect: randomInt(0, 4) },
      Sosyal: { correct: Math.min(20, Math.round(sosNet + randomInt(1, 2))), incorrect: randomInt(0, 3) },
      Fen: { correct: Math.min(20, Math.round(fenNet + randomInt(1, 2))), incorrect: randomInt(0, 3) }
    };

    // Recalculate exact nets
    Object.keys(tytScores).forEach(sub => {
      const s = tytScores[sub];
      s.net = Math.max(0, Math.round((s.correct - s.incorrect / 4) * 100) / 100);
      s.blank = 40 - (s.correct + s.incorrect);
      if (sub === 'Sosyal' || sub === 'Fen') s.blank = 20 - (s.correct + s.incorrect);
    });

    const calculatedTytTotalNet = Math.round(Object.values(tytScores).reduce((sum, item) => sum + item.net, 0) * 100) / 100;

    mockData.exams.push({
      id: `exam-tyt-${student.id}-${i}`,
      studentId: student.id,
      date: date,
      examName: `Kurumsal TYT Denemesi - ${i}`,
      type: 'TYT',
      scores: tytScores,
      totalNet: calculatedTytTotalNet
    });

    // --- AYT GENERATION ---
    // SAY does Mat & Fen, EA does Mat & Edebiyat-Sos1, SOZ does Edebiyat-Sos1 & Sos2
    const aytProgress = i * randomInt(2, 4);
    const aytTotalNet = Math.min(78, aytStartNet + aytProgress + randomInt(-2, 3));
    
    let aytScores = {};
    if (track === 'SAY') {
      const mat = Math.min(40, Math.round(aytTotalNet * 0.55));
      const fen = Math.min(40, Math.max(0, Math.round(aytTotalNet - mat)));
      aytScores = {
        Matematik: { correct: mat, incorrect: randomInt(0, 4) },
        Fen: { correct: fen, incorrect: randomInt(0, 4) }
      };
    } else if (track === 'EA') {
      const mat = Math.min(40, Math.round(aytTotalNet * 0.5));
      const edb = Math.min(40, Math.max(0, Math.round(aytTotalNet - mat)));
      aytScores = {
        Matematik: { correct: mat, incorrect: randomInt(0, 4) },
        EdebiyatSosyal1: { correct: edb, incorrect: randomInt(0, 4) }
      };
    } else { // SOZ
      const edb = Math.min(40, Math.round(aytTotalNet * 0.5));
      const sos2 = Math.min(40, Math.max(0, Math.round(aytTotalNet - edb)));
      aytScores = {
        EdebiyatSosyal1: { correct: edb, incorrect: randomInt(0, 4) },
        Sosyal2: { correct: sos2, incorrect: randomInt(0, 4) }
      };
    }

    // Recalculate exact nets for AYT
    Object.keys(aytScores).forEach(sub => {
      const s = aytScores[sub];
      s.net = Math.max(0, Math.round((s.correct - s.incorrect / 4) * 100) / 100);
      s.blank = 40 - (s.correct + s.incorrect);
    });

    const calculatedAytTotalNet = Math.round(Object.values(aytScores).reduce((sum, item) => sum + item.net, 0) * 100) / 100;

    mockData.exams.push({
      id: `exam-ayt-${student.id}-${i}`,
      studentId: student.id,
      date: date,
      examName: `Kurumsal AYT Denemesi - ${i}`,
      type: 'AYT',
      scores: aytScores,
      totalNet: calculatedAytTotalNet
    });
  }

  // 3. Generate 8 Weekly Meetings
  const meetingNotes = [
    "Genel durum iyi. Limit konusundaki eksikler tamamlandı, türeve başlandı. Haftalık soru hedefi artırıldı.",
    "Deneme analizi yapıldı. Matematikteki dikkat hataları üzerinde duruldu. Süre yönetimi planı revize edildi.",
    "Geometriye biraz daha vakit ayrılması gerekiyor. Programda paragraf çözümü artırıldı. Motivasyon yüksek.",
    "Fizikte modern fizik ünitesi çalışıldı. Kimya organik kimya tekrarı planlandı. Çalışma saatleri stabil.",
    "Haftalık soru çözme hedefinin gerisinde kalındı. Hastalık sebebiyle 2 gün aksama olmuş. Telafi planı yapıldı.",
    "AYT netlerindeki yükseliş devam ediyor. Türkçe dil bilgisinde eksik olan konular listelendi ve ödev verildi.",
    "Sosyal denemelerine ağırlık vermeye karar verdik. Haftalık 3 adet TYT branş denemesi çözülecek.",
    "Genel tekrar haftası. Son 10 yılın çıkmış sorularının çözümü yapıldı. Sınav kaygısı ve nefes egzersizi çalışıldı."
  ];

  for (let j = 1; j <= 8; j++) {
    const targetQ = randomInt(8, 15) * 100; // 800 - 1500 questions
    const solvedQ = Math.round(targetQ * (randomInt(75, 110) / 100)); // 75% to 110% completion
    
    mockData.weeklyMeetings.push({
      id: `meet-${student.id}-${j}`,
      studentId: student.id,
      date: subtractDays(today, (8 - j) * 7),
      notes: meetingNotes[j - 1],
      attendance: 'KATILDI',
      weeklyTargetQuestions: targetQ,
      solvedQuestions: solvedQ
    });
  }

  // 4. Generate 5 Tasks
  const taskTemplates = [
    { title: 'Türev Konu Anlatımı ve Soru Çözümü', desc: 'Fasikülden türev 1. ve 2. ünite bitecek, en az 300 soru çözülecek.' },
    { title: 'Kimya Organik Tekrarı', desc: 'Organik kimyadaki fonksiyonel gruplar özet çıkarılacak.' },
    { title: 'Edebiyat Cumhuriyet Dönemi Yazar Eşleştirmesi', desc: 'Cumhuriyet dönemi tiyatro yazarları hafıza kartları çalışılacak.' },
    { title: 'Haftalık 2 Adet TYT Matematik Branş Denemesi', desc: 'Süre tutularak çözülecek ve analizleri koça gönderilecek.' },
    { title: 'Fizik Optik Ünitesi Bitirme', desc: 'Optik konusunda kırılma ve mercekler eksikleri kapatılacak.' }
  ];

  taskTemplates.forEach((t, index) => {
    const statuses = ['YAPILACAK', 'DEVAM_EDIYOR', 'TAMAMLANDI'];
    mockData.tasks.push({
      id: `task-${student.id}-${index}`,
      studentId: student.id,
      title: t.title,
      description: t.desc,
      dueDate: subtractDays(today, -randomInt(1, 10)),
      status: statuses[randomInt(0, 2)]
    });
  });
});

// Write to src/mockData.json
const outputPath = path.join(__dirname, '..', 'src', 'mockData.json');
fs.writeFileSync(outputPath, JSON.stringify(mockData, null, 2), 'utf-8');

console.log(`Mock data successfully generated at ${outputPath}!`);
console.log(`Generated:`);
console.log(`- ${mockData.students.length} Students`);
console.log(`- ${mockData.exams.length} Exam Results`);
console.log(`- ${mockData.weeklyMeetings.length} Weekly Meetings`);
console.log(`- ${mockData.tasks.length} Active Tasks`);
