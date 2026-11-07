// Görünen marka adının tek kaynağı (bağımlılıksız; node selftest'lerinden de import edilir).
export const BRAND_LONG = 'Eda Cangert Eğitim Danışmanlığı'
export const BRAND_SHORT = 'Eda Danışmanlık'
export const BRAND_TAGLINE = 'YKS · LGS Koçluk'

// Kurum adı Konsept/Concept ise o kurumun logosu kullanılır (menü + yazdırma başlığı).
export const isKonseptInstitution = (name: string | null | undefined) =>
  /konsept|concept/i.test(name ?? '')
