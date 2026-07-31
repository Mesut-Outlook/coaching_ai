import type { PortalRole } from './portal'

/**
 * Mobil portalın rol kimliği — öğrenci ve veli portalları ilk bakışta
 * ayırt edilebilsin diye tek bir vurgu rengi üzerinden kurgulandı.
 *
 * Öğrenci = indigo (uygulamanın ana markası, öğrenci "içeride" hissi),
 * Veli     = teal   (bilgilendirme/gözlemci rolü, indigo'dan net ayrışıyor).
 *
 * ⚠️ Neden `var(--token)` değil de sabit hex: portal sayfaları zemini
 * `#f8fafc`, kartları `#ffffff` olarak SABİT açık renkte çiziyor. tokens.css
 * değişkenleri karanlık temada dönüyor (örn. `--teal-text` açık maviye
 * kayıyor) — o durumda beyaz kartın üstüne açık renk metin gelip okunmaz
 * hale gelirdi. Değerler tokens.css'in AÇIK tema paletinden birebir alındı.
 *
 * ⚠️ `accent` ile `accentStrong` ayrımı kontrast içindir:
 * teal #1D8FA6 üzerine beyaz metin 3.8:1 veriyor (12px kalın rozet için AA
 * eşiği 4.5:1 — kalıyor). Bu yüzden METİN ve rozet dolgusu daima
 * `accentStrong` (teal #0F6478 → 6.8:1, indigo #342E86 → 10.4:1) kullanır;
 * `accent` yalnız METİN OLMAYAN alanlarda (üst şerit, ilerleme çubuğu,
 * seçili kart çerçevesi) kullanılır.
 */
export type PortalTheme = {
  label: string
  /** Metin olmayan dolgular: üst şerit, ilerleme çubuğu, seçili kart çerçevesi. */
  accent: string
  /** Metin ve rozet dolgusu — kontrastı yüksek koyu ton. */
  accentStrong: string
  /** Açık zemin — "Bugün" etiketi, toplam net kutusu gibi yumuşak alanlar. */
  tint: string
  /** Açık zemin üzerindeki metin rengi. */
  tintText: string
}

export const PORTAL_THEME: Record<PortalRole, PortalTheme> = {
  ogrenci: {
    label: 'Öğrenci',
    accent: '#4C43A8', // indigo-600
    accentStrong: '#342E86', // indigo-700
    tint: '#ECEAFA', // indigo-050
    tintText: '#2E2874', // indigo-800
  },
  veli: {
    label: 'Veli',
    accent: '#1D8FA6', // teal
    accentStrong: '#0F6478', // teal-text
    tint: '#E1F3F7', // teal-bg
    tintText: '#0F6478', // teal-text
  },
}

/** Header'daki dolu rozet — her iki portalda birebir aynı biçim, farklı renk. */
export const roleBadgeStyle = (theme: PortalTheme) =>
  ({
    padding: '7px 14px',
    borderRadius: 999,
    backgroundColor: theme.accentStrong,
    color: '#FFFFFF',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 0.3,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  }) as const

/** Sayfanın en üstündeki ince renk şeridi — rolü sekmeye bakmadan belli eder. */
export const roleTopBarStyle = (theme: PortalTheme) =>
  ({
    height: 4,
    backgroundColor: theme.accent,
  }) as const
