// Müfredat YKS/LGS ayrımı — hangi sınıfın hangi müfredata tabi olduğu ve bir
// dersin bir sınıfa uygulanıp uygulanmadığı TEK KAYNAK burada karar veriliyor.
// Konu/ders listeleyen her ekran (Müfredat, Konu Yeterlilik Haritası, Haftalık
// Program, Deneme Girişi vb.) bu iki fonksiyonu çağırmalı — mantığı kopyalamamalı.
import type { Curriculum, Grade, Subject } from '../types/database'

/** Bir sınıfın tabi olduğu müfredat: 7./8. sınıf LGS, geri kalanı (+ Mezun) YKS. */
export function gradeCurriculum(grade: Grade): Curriculum {
  return grade === '7. Sınıf' || grade === '8. Sınıf' ? 'LGS' : 'YKS'
}

/**
 * Bir dersin verilen sınıfa uygulanıp uygulanmadığı:
 * - dersin müfredatı, sınıfın müfredatıyla eşleşmeli (YKS dersi LGS sınıfına uygulanmaz, tersi de)
 * - VE ders ya tüm sınıflara açık (`grades` boş dizi) ya da sınıf `grades` listesinde
 */
export function subjectAppliesTo(
  subject: Pick<Subject, 'curriculum' | 'grades'>,
  grade: Grade,
): boolean {
  if (subject.curriculum !== gradeCurriculum(grade)) return false
  return subject.grades.length === 0 || subject.grades.includes(grade)
}
