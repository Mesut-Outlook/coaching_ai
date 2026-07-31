// Mobil portal erişim kodu üreteci — BAĞIMLILIĞI YOK (özellikle supabase import etmez),
// böylece hem tarayıcı tarafı (src/lib/accessCode.ts) hem de node script'i
// (scripts/generateAccessCodes.ts) aynı kaynağı kullanabiliyor.
// ⚠️ Kod uzunluğunu/alfabesini değiştirirsen tek yer burasıdır — kopyalama.

// Karıştırılması kolay karakterler (O/0, I/1, S/5) dışarıda bırakıldı.
export const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRTUVWXYZ'
export const CODE_LENGTH = 6

/**
 * 6 karakterlik rastgele erişim kodu üretir (örn. STU-4KX9M2).
 *
 * ⚠️ Uzunluk neden 6 ve neden Math.random() değil: kod, kimliği doğrulanmamış
 * istemcinin sunucuya gönderdiği bir bearer token gibi çalışıyor (bkz.
 * portal_login RPC) ve deneme sayısı sınırlı değil. 4 karakterde ~1 milyon
 * ihtimal vardı (kaba kuvvetle saatler içinde taranabilir); 6 karakterde
 * ~887 milyona çıkıyor. Math.random() kriptografik değil, tahmin edilebilir.
 */
export function generateRandomCode(prefix: 'STU' | 'PAR'): string {
  const bytes = new Uint32Array(CODE_LENGTH)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET.charAt(bytes[i] % CODE_ALPHABET.length)
  }
  return `${prefix}-${code}`
}
