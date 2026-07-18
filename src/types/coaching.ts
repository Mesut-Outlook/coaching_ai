export type Track = 'SAY' | 'EA' | 'SOZ';

export type StudentGrade = '12' | 'MEZUN';

export interface Student {
  id: string;
  name: string;
  track: Track;
  grade: StudentGrade;
  target: string; // e.g., "Boğaziçi Bilgisayar"
  photoUrl?: string;
}

export type ExamType = 'TYT' | 'AYT';

export interface SubjectResult {
  correct: number;
  incorrect: number;
  blank: number;
  net: number;
}

export interface ExamResult {
  id: string;
  studentId: string;
  date: string; // ISO format string (YYYY-MM-DD)
  examName: string; // e.g., "3D Türkiye Geneli - 1"
  type: ExamType;
  scores: {
    [subject: string]: SubjectResult; // e.g., "Turkce", "Matematik"
  };
  totalNet: number;
}

export type ProficiencyStatus = 'YETERLI' | 'GELISIYOR' | 'KRITIK' | 'OLCULMEDI';

export interface SubjectProficiency {
  subjectId: string; // unique key (e.g. "mat-türev")
  subjectName: string; // human readable name (e.g. "Türev")
  category: string; // e.g. "Matematik", "Fizik"
  status: ProficiencyStatus;
  lastTested?: string; // YYYY-MM-DD
  accuracy?: number; // percentage value 0-100 representing correct/total ratio in recent exams
}

export type MeetingAttendance = 'KATILDI' | 'GELMEDI' | 'ERTELENDI';

export interface WeeklyMeeting {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  notes: string;
  attendance: MeetingAttendance;
  weeklyTargetQuestions: number;
  solvedQuestions: number;
}

export type TaskStatus = 'YAPILACAK' | 'DEVAM_EDIYOR' | 'TAMAMLANDI';

export interface Task {
  id: string;
  studentId: string;
  title: string;
  description: string;
  dueDate: string; // YYYY-MM-DD
  status: TaskStatus;
}
