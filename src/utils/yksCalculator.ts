import type { ExamResult, SubjectResult, ProficiencyStatus } from '../types/coaching';

/**
 * Calculates YKS net score based on correct and incorrect answers.
 * Standard formula: Net = Correct - (Incorrect / 4)
 */
export function calculateNet(correct: number, incorrect: number): number {
  const rawNet = correct - incorrect / 4;
  // Net cannot be negative in practice, or it can be but usually clamped or left as is.
  // We round it to 2 decimal places to prevent floating point issues.
  return Math.round(rawNet * 100) / 100;
}

/**
 * Creates a SubjectResult object and computes the net.
 */
export function createSubjectResult(correct: number, incorrect: number, maxQuestions: number): SubjectResult {
  const blank = Math.max(0, maxQuestions - (correct + incorrect));
  const net = calculateNet(correct, incorrect);
  return { correct, incorrect, blank, net };
}

/**
 * Resolves the proficiency status based on accuracy rate (0-100).
 */
export function getProficiencyFromAccuracy(accuracy?: number): ProficiencyStatus {
  if (accuracy === undefined || accuracy === null) return 'OLCULMEDI';
  if (accuracy >= 75) return 'YETERLI';
  if (accuracy >= 50) return 'GELISIYOR';
  return 'KRITIK';
}

/**
 * Calculates average nets for a list of exam results.
 */
export function calculateAverageNets(exams: ExamResult[]): { [subject: string]: number } {
  if (exams.length === 0) return {};
  
  const totals: { [subject: string]: number } = {};
  const counts: { [subject: string]: number } = {};
  
  exams.forEach(exam => {
    Object.entries(exam.scores).forEach(([subject, score]) => {
      totals[subject] = (totals[subject] || 0) + score.net;
      counts[subject] = (counts[subject] || 0) + 1;
    });
  });
  
  const averages: { [subject: string]: number } = {};
  Object.keys(totals).forEach(subject => {
    averages[subject] = Math.round((totals[subject] / counts[subject]) * 100) / 100;
  });
  
  return averages;
}

/**
 * Calculates progress trend (whether the net is going up or down).
 * Compares the average of the first half of exams with the second half.
 */
export function calculateNetTrend(exams: ExamResult[]): 'UP' | 'DOWN' | 'STABLE' {
  if (exams.length < 2) return 'STABLE';
  
  // Sort exams by date ascending
  const sortedExams = [...exams].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  const midPoint = Math.floor(sortedExams.length / 2);
  const firstHalf = sortedExams.slice(0, midPoint);
  const secondHalf = sortedExams.slice(midPoint);
  
  const avgFirst = firstHalf.reduce((sum, e) => sum + e.totalNet, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, e) => sum + e.totalNet, 0) / secondHalf.length;
  
  const diff = avgSecond - avgFirst;
  
  if (diff > 1.5) return 'UP';
  if (diff < -1.5) return 'DOWN';
  return 'STABLE';
}

/**
 * Maximum questions per subject for standard YKS exams.
 */
export const YKS_QUESTION_COUNTS = {
  TYT: {
    Turkce: 40,
    Matematik: 40,
    Sosyal: 20, // Tarih 5, Coğrafya 5, Felsefe 5, Din 5
    Fen: 20, // Fizik 7, Kimya 7, Biyoloji 6
  },
  AYT: {
    Matematik: 40,
    EdebiyatSosyal1: 40, // Edebiyat 24, Tarih1 10, Coğrafya1 6
    Sosyal2: 40, // Tarih2 11, Coğrafya2 11, Felsefe Grubu 12, Din 6
    Fen: 40, // Fizik 14, Kimya 13, Biyoloji 13
  }
};
