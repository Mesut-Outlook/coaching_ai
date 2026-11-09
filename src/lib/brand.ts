// Görünen marka adının tek kaynağı (bağımlılıksız; node selftest'lerinden de import edilir).
export const BRAND_LONG = 'Eda Cangert Eğitim Danışmanlığı'
export const BRAND_SHORT = 'Eda Danışmanlık'
export const BRAND_TAGLINE = 'YKS · LGS Koçluk'
// Tüm WhatsApp mesajlarının imzası, kurumdan bağımsız (Eda'nın talebi, 2026-11-09).
export const WHATSAPP_SIGNATURE = 'Konsept Akademi'

// Kurum adı Konsept/Concept ise o kurumun logosu kullanılır (menü + yazdırma başlığı).
export const isKonseptInstitution = (name: string | null | undefined) =>
  /konsept|concept/i.test(name ?? '')

// Portal başlığı: kurum adı RPC'den gelmediyse (eski SQL) hiçbir şey gösterme, yanlış marka basma.
export const portalBrand = (institutionName: string | null | undefined) =>
  institutionName ? brandShortFor(institutionName) : null

export const brandShortFor = (institutionName: string | null | undefined) =>
  isKonseptInstitution(institutionName) ? 'Konsept Akademi' : BRAND_SHORT
