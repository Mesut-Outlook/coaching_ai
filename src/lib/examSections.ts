import type { ExamType, Track } from '../types/database'

/**
 * Deneme bölüm şablonları — koç ekranı (DenemelerPage) ve mobil öğrenci portalı
 * aynı bölüm adlarını/soru sayılarını kullansın diye tek kaynak burası.
 *
 * `katsayi` yalnız LGS bölümlerinde dolu — YKS'de ağırlıklı net kavramı yok.
 * ⚠️ Gerçek LGS puanı (500'lük) hesaplanamaz: merkezî sınavın istatistiklerini
 * (ortalama/standart sapma) gerektirir, elimizde yok. Bunun yerine `weightedNet`
 * yalnızca ders katsayılarıyla tartılmış bir NET üretir — asla "puan" denmesin.
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
  LGS: [
    { name: 'Türkçe', max: 20, katsayi: 4 },
    { name: 'Matematik', max: 20, katsayi: 4 },
    { name: 'Fen Bilimleri', max: 20, katsayi: 4 },
    { name: 'T.C. İnkılap Tarihi ve Atatürkçülük', max: 10, katsayi: 1 },
    { name: 'Din Kültürü ve Ahlak Bilgisi', max: 10, katsayi: 1 },
    { name: 'Yabancı Dil (İngilizce)', max: 10, katsayi: 1 },
  ],
} as const

export type ExamSectionTemplate = { name: string; max: number; katsayi?: number }

/** LGS'te 3 yanlış, YKS'de (TYT/AYT) 4 yanlış 1 doğruyu götürür — tek kaynak burası. Şema'daki `wrong_penalty` ile tutarlı tutulmalı. */
export function wrongPenaltyFor(examType: ExamType): number {
  return examType === 'LGS' ? 3 : 4
}

/** Sınav türü + öğrencinin alanına göre girilecek bölümleri döndürür. LGS'te alan (track) kullanılmaz. */
export function getExamSections(examType: ExamType, track: Track | null): readonly ExamSectionTemplate[] {
  if (examType === 'LGS') return SECTIONS_CONFIG.LGS
  if (examType === 'TYT') return SECTIONS_CONFIG.TYT
  return SECTIONS_CONFIG.AYT[track ?? 'SAY'] ?? SECTIONS_CONFIG.AYT.SAY
}

/** Bir bölümün netini anlık önizleme için hesaplar — DB'deki generated `net` ile aynı formül. */
export function sectionNet(correct: number, wrong: number, examType: ExamType): number {
  return correct - wrong / wrongPenaltyFor(examType)
}

/**
 * LGS için ders katsayılarıyla TARTILMIŞ NET (gerçek LGS puanı DEĞİL — bkz. yukarıdaki
 * uyarı). YKS denemelerinde kavram yok; bu fonksiyon yalnız LGS bölümleri için anlamlı.
 */
export function weightedNet(sections: readonly { section_name: string; net: number }[]): number {
  return sections.reduce((sum, s) => {
    const template = SECTIONS_CONFIG.LGS.find((t) => t.name === s.section_name)
    const katsayi = template?.katsayi ?? 1
    return sum + Number(s.net) * katsayi
  }, 0)
}
