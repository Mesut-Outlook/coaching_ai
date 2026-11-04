# Supabase e-posta şablonları

Supabase Dashboard → **Authentication → Emails → Templates**. Uygulama yalnız iki e-posta tetikler:
kayıt onayı (`RegisterPage` → `signUp`) ve şifre sıfırlama (`SifreSifirlaPage` → `resetPasswordForEmail`).
Ortamda Management API erişimi yok; bu metinler panele elle yapıştırılır.

## Confirm signup

**Subject:** `Eda Danışmanlık: e-posta adresinizi doğrulayın`

```html
<h2>Eda Cangert Eğitim Danışmanlığı</h2>
<p>Merhaba,</p>
<p>Koçluk paneline kaydınızı tamamlamak için e-posta adresinizi doğrulayın:</p>
<p><a href="{{ .ConfirmationURL }}">E-posta adresimi doğrula</a></p>
<p>Bu kaydı siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
<p>Eda Danışmanlık</p>
```

## Reset password

**Subject:** `Eda Danışmanlık: şifre sıfırlama`

```html
<h2>Eda Cangert Eğitim Danışmanlığı</h2>
<p>Merhaba,</p>
<p>Koçluk paneli şifrenizi sıfırlamak için aşağıdaki bağlantıya tıklayın:</p>
<p><a href="{{ .ConfirmationURL }}">Yeni şifre belirle</a></p>
<p>Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz; şifreniz değişmez.</p>
<p>Eda Danışmanlık</p>
```

Not: gönderen adı (Sender name) yalnız özel SMTP tanımlıysa değişir (**Authentication → Emails → SMTP Settings**);
varsayılan Supabase SMTP'sinde gönderen sabittir.
