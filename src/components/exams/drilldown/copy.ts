import type { DrillRole } from './types'

export function roleText<T>(role: DrillRole, t: { coach: T; student: T; parent: T }): T {
  return t[role]
}

/** Veli açıklamaları (taslaktaki explain(...) cümleleri). */
export const EXPLAIN = {
  totalNet: 'Her nokta bir deneme. Çizgi yukarı gidiyorsa toplam net artıyor. Kesikli çizgiler hedef ve ortalama.',
  groups: 'Sütunun boyu toplam net. Renkli parçalar netin hangi ders grubundan geldiğini gösteriyor.',
  cardsHeat: 'Her satır bir ders, her sütun bir deneme. Hücrede net ve başarı yüzdesi; yeşil iyi, sarı orta, kırmızı zayıf.',
  cardsCards: 'Her kart bir ders. Büyük sayı son denemedeki net; ok, ilk denemelere göre başarının arttığını ya da azaldığını gösteriyor.',
  allLoss: 'Listenin başındaki konular toplamda en çok puan kaybettiren konular.',
  examDeltas: 'Sağa uzanan yeşil çubuk o derste netin arttığını, sola uzanan kırmızı çubuk azaldığını gösterir.',
  examLoss: 'En üstteki konular bu denemede en çok puan kaybettiren konular. Çalışmaya buradan başlamak en hızlı kazancı getirir.',
} as const

export const EXAM_DELTA_EMPTY = 'Bu ilk deneme; bir sonraki denemeden itibaren ders ders artış/azalış burada görünür.'
export const EXAM_NO_TOPICS = 'Bu denemede yalnız ders sonuçları girildi, konu detayı yok. Konu grafikleri bu denemeyi boş gösterir.'

export const FORMULA_LINES = [
  "Net = Doğru − Yanlış ÷ 4 (LGS'te ÷ 3) · Başarı % = Doğru ÷ Soru · Kayıp net = Soru − Net",
  'Bantlar: %75 ve üstü Yeterli, %50–75 Gelişiyor, altı Kritik · "Son 3" = konu detayı girilmiş son 3 denemenin toplamı · Eğilim = son 3 − öncekiler (puan)',
  'Konu detayı girilmemiş denemeler konu grafiklerinde boş kalır; ders sonuçları her zaman elle girilen değerdir.',
]
