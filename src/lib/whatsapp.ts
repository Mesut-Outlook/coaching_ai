// Ortak WhatsApp yardımcıları. Önceden ProgramPage.tsx ve OgrencilerPage.tsx'te
// aynı telefon formatlama mantığı kopyalanmıştı — tek kaynağa taşındı.

/** Türkiye telefon numarasını WhatsApp linki için 90XXXXXXXXXX biçimine çevirir. */
export function formatPhoneForWhatsApp(raw: string): string {
  const digitsOnly = raw.replace(/\D/g, '').replace(/^0/, '90')
  if (digitsOnly.startsWith('90') && digitsOnly.length === 12) return digitsOnly
  if (digitsOnly.length === 10) return '90' + digitsOnly
  return digitsOnly
}

/** Verilen numaraya, ön-doldurulmuş mesajla bir WhatsApp sohbet penceresi açar. */
export function openWhatsAppChat(phone: string, message: string): void {
  window.open(
    `https://api.whatsapp.com/send?phone=${formatPhoneForWhatsApp(phone)}&text=${encodeURIComponent(message)}`,
    '_blank'
  )
}
