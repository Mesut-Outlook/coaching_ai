// Müfredat YKS/LGS ayrımı — hangi sınıfın hangi müfredata tabi olduğu ve bir
// dersin bir sınıfa uygulanıp uygulanmadığı TEK KAYNAK burada karar veriliyor.
// Konu/ders listeleyen her ekran (Müfredat, Konu Yeterlilik Haritası, Haftalık
// Program, Deneme Girişi vb.) bu iki fonksiyonu çağırmalı — mantığı kopyalamamalı.
import type { Curriculum, Grade, Subject, Topic } from '../types/database'

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

/**
 * Bir konunun verilen sınıfa uygulanıp uygulanmadığı — konu listeleyen HER ekran
 * (Müfredat, Konu Yeterlilik Haritası, Haftalık Program, Deneme Girişi vb.) bu tek
 * fonksiyonu çağırmalı, mantığı kopyalamamalı.
 *
 * Kural: önce dersin kendisi bu sınıfa uygulanmalı (`subjectAppliesTo`) — uygulanmıyorsa
 * konunun grades'i ne olursa olsun konu görünmez. Ders uyuyorsa, konu ya tüm sınıflara
 * açıktır (`topic.grades` boş dizi — örn. mevcut YKS konuları ve tek sınıflı LGS dersleri)
 * ya da sınıf `topic.grades` içinde olmalı (örn. hem 7 hem 8. sınıfa açık bir LGS dersinin
 * 7. sınıfa özel konusu 8. sınıf öğrencisine görünmemeli).
 */
export function topicAppliesTo(
  topic: Pick<Topic, 'grades'>,
  subject: Pick<Subject, 'curriculum' | 'grades'>,
  grade: Grade,
): boolean {
  if (!subjectAppliesTo(subject, grade)) return false
  return topic.grades.length === 0 || topic.grades.includes(grade)
}
