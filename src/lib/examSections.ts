import type { Track } from '../types/database'

/**
 * Deneme bölüm şablonları — koç ekranı (DenemelerPage) ve mobil öğrenci portalı
 * aynı bölüm adlarını/soru sayılarını kullansın diye tek kaynak burası.
 */
export const SECTIONS_CONFIG = {
  TYT: [
    { name: 'Türkçe', max: 40 },
    { name: 'Matematik', max: 40 },
    { name: 'Sosyal Bilimler', max: 20 },
    { name: 'Fen Bilimleri', max: 20 },
  ],
  AYT: {
    SAY: [
      { name: 'Matematik', max: 40 },
      { name: 'Fen Bilimleri', max: 40 },
    ],
    EA: [
      { name: 'Matematik', max: 40 },
      { name: 'Edebiyat-Sosyal1', max: 40 },
    ],
    SÖZ: [
      { name: 'Edebiyat-Sosyal1', max: 40 },
      { name: 'Sosyal Bilimler-2', max: 40 },
    ],
  },
} as const

export type ExamSectionTemplate = { name: string; max: number }

/** Sınav türü + öğrencinin alanına göre girilecek bölümleri döndürür. */
export function getExamSections(examType: 'TYT' | 'AYT', track: Track): readonly ExamSectionTemplate[] {
  if (examType === 'TYT') return SECTIONS_CONFIG.TYT
  return SECTIONS_CONFIG.AYT[track] ?? SECTIONS_CONFIG.AYT.SAY
}
