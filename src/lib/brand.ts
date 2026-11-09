// Görünen marka adının tek kaynağı (bağımlılıksız; node selftest'lerinden de import edilir).
export const BRAND_LONG = 'Eda Cangert Eğitim Danışmanlığı'
export const BRAND_SHORT = 'Eda Danışmanlık'
export const BRAND_TAGLINE = 'YKS · LGS Koçluk'

// Kurum adı Konsept/Concept ise o kurumun logosu kullanılır (menü + yazdırma başlığı).
export const isKonseptInstitution = (name: string | null | undefined) =>
  /konsept|concept/i.test(name ?? '')

// Veli mesajının imzası: öğrencinin kurumu Konsept ise kurum adı, değilse varsayılan marka.
// Portal başlığı: kurum adı RPC'den gelmediyse (eski SQL) hiçbir şey gösterme, yanlış marka basma.
export const portalBrand = (institutionName: string | null | undefined) =>
  institutionName ? brandShortFor(institutionName) : null

export const brandShortFor = (institutionName: string | null | undefined) =>
  isKonseptInstitution(institutionName) ? 'Konsept Akademi' : BRAND_SHORT
