# Skolyoz Vaka Atölyesi

## Hocanın incelemesi için

GitHub Pages hedef adresi: https://nefret2121.github.io/skolyoz-vaka-atolyesi/

Yayın için depo Settings → Pages → Deploy from a branch → main → /docs → Save seçilir. Pages ayarı tamamlanmadan bu adresin açılması beklenmez.

Bu bağlantı şifresiz inceleme demosudur. GitHub deposu kaynak kodunu saklar; tek başına web sitesi yayını değildir.

Hocamız bireysel çalışma ve eğitmen sunumu modlarında dört bölümü deneyebilir. İncelemede soru köklerini, seçenekleri, açıklamaları, gerçek görüntülerin vaka aşamalarıyla eşleşmesini ve ders süresini değerlendirmesi beklenir. Klinik içerik kaynaklı eğitim taslağıdır; klinisyen onayı alınmış sayılmaz.

## Yazılımcı için kurulum paketi

Ortak kamp şifresi henüz belirlenmedi. Kurulum sırasında kamp sorumlusu seçer; `npm run setup` ile tanımlanır. Gerçek şifreler ve `.env` dosyası depoya yüklenmez.

# Skolyoz kampı: ortak şifreyle vaka atölyesi

Bu paket, mevcut siteden bağımsız çalışabilen bir Node.js servisi ve tamamlanmış atölye arayüzüdür. Mevcut sitenin diline/framework'üne göre reverse proxy ile `/vaka-atolyesi/` yoluna bağlanabilir. Mevcut siteye otomatik olarak kurulmuş değildir.

## İçerik

Başlangıçta seslendirmeli 13 saniyelik toraks/T7 animasyonu yer alır. Şematik eğitim görselidir; kaynak hastaların görüntüsü değildir. Video kullanıcı tarafından başlatılır.

- Üç gerçek kaynak hasta, dört bölüm, 17 karar noktası.
- İlk iki bölüm aynı hastanın değerlendirmesi ve takibi.
- Gerçek radyografiler, MRG ve kaynağın 3D rekonstrüksiyonu.
- 23 sayfalık eğitmen PDF'si, açıklamalar ve kaynaklar.
- Bireysel çalışma ve eğitmen sunumu modları.
- Ortak kamp şifresi: bütün katılımcılar aynı şifreyi kullanır.

Canlı oylama, ortak moderatör durumu, üye hesabı ve kişi bazlı sunucu kayıtları bu pakette yoktur. Yanıtlar tarayıcıda saklanır. Zoom anketi veya sohbet canlı oy için kullanılabilir. Ortak şifre katılımcıları ayrı ayrı tanımlamaz.

## Gereksinim

Node.js 22 veya üzeri ve HTTPS sunan mevcut bir site/reverse proxy. Paket üçüncü taraf npm bağımlılığı kullanmaz. Salt statik dosya barındıran bir sunucu bu şifre kontrolünü çalıştıramaz; bir Node servisi veya aynı sözleşmeyi uygulayan backend gerekir.

## Yerel deneme

```sh
npm run setup -- --local
npm start
```

Kurulum, ortak şifreyi iki kez ister; yazılan karakterler görünmez. Şifre en az 12 karakter olmalıdır. `.env` içine yalnız scrypt özeti ve rastgele oturum anahtarı kaydedilir. Adres: `http://localhost:3000/vaka-atolyesi/`.

```sh
npm test
```

Node'un yerleşik testleri giriş, dosya koruması, oturum, origin kontrolü, hız sınırı ve kamp kapanışını sınar. Yerel HTTP ayarı yalnız localhost geliştirme içindir.

## Mevcut canlı siteye kurulum

1. Paketi web kökünün dışında, örneğin `/opt/skolyoz-kamp` altına koyun. `public/` klasörünü doğrudan Nginx/Apache static kökü olarak sunmayın. Görsel, PDF ve `lesson.json` da Node üzerinden korunmalıdır.
2. `npm run setup` çalıştırın. Mevcut sitenin origin adresini `https://siteadresiniz.com` biçiminde girin (sonunda yol veya slash olmadan). Kullanıcıya ortak şifreyi belirletin.
3. `.env` içinde origin, port ve base path'i kontrol edin. `HOST=127.0.0.1` backend'i dış bağlantılardan sınırlar. `TRUST_PROXY=true` yalnız güvenilir proxy doğrudan backend'e bağlanıyorsa kullanılmalıdır.
4. `deploy/nginx-location.conf` içindeki location bloklarını mevcut HTTPS server bloğuna ekleyin. `proxy_pass` sonuna slash eklemeyin; `/vaka-atolyesi/` yolu backend'e korunarak gitmelidir. Node servis portunu ayrıca internete açmayın.
5. Servisi başlatın. `deploy/skolyoz-kamp.service` bir systemd örneğidir: servis kullanıcısını oluşturun, dosya izinlerini düzenleyin, Node yolunu doğrulayın. `.env` dosyasını servis kullanıcısı okuyabilmeli, diğer kullanıcılar okuyamamalıdır.
6. Mevcut siteye `Vaka Atölyesine Gir` düğmesi ekleyin. Hedef `/vaka-atolyesi/`. QR kod da kurulmuş gerçek HTTPS adresine yönlenmelidir.
7. Telefon ve bilgisayarda şifresiz görsel/PDF isteğinin engellendiğini, doğru şifreyle dersin açıldığını ve çıkışın çalıştığını doğrulayın. Proxy katmanında korunan yanıtları cache'lemeyin.

### Docker alternatifi

```sh
docker build -t skolyoz-kamp .
docker run -d --name skolyoz-kamp --restart unless-stopped \
  --env-file .env -e HOST=0.0.0.0 \
  -p 127.0.0.1:3000:3000 skolyoz-kamp
```

Docker dosyası eklenmiştir; bu ortamda Docker build denenmedi. Gizli değerler image içine kopyalanmaz. Aynı Nginx örneğiyle bağlanabilir.

## Şifre değiştirme, oturum ve kamp kapanışı

- `npm run setup -- --replace` yeni şifre ve oturum anahtarı üretir. Origin yeniden sorulur; özelleştirilmiş port/base path ayarlarını koruyun. Servisi yeniden başlatın. Eski oturumlar geçersiz olur.
- Oturum 8 saat geçerlidir. Çerez `HttpOnly`, canlı HTTPS'te `Secure`, `SameSite=Lax` ve atölye yolu kapsamındadır. Frontend'e şifre veya oturum anahtarı gönderilmez.
- `CAMP_ENABLED=false` yapıp servisi yeniden başlatmak bütün ders dosyalarını ve girişleri kapatır. Paylaşılan şifreyi bilen herkes erişebilir.
- Yönetim paneli yerine sunucu ayarları kullanılır. Şifreyi değiştirmek için bu aşamada geliştirici/sunucu erişimi gerekir.

## Korunan yollar

| Yol | Davranış |
|---|---|
| `GET /vaka-atolyesi/` | Oturum yoksa giriş ekranı; varsa ders |
| `POST /vaka-atolyesi/login` | Aynı origin formu; ortak şifre doğrulaması |
| `POST /vaka-atolyesi/logout` | Aynı origin formu; bu tarayıcıdan çıkış |
| `/vaka-atolyesi/assets/*` | Oturum olmadan 401; PDF/görsel dahil |
| `/vaka-atolyesi/lesson.json` | Oturum olmadan 401 |

Başka bir backend'e taşınırsa aynı dosya/oturum koruması tüm yollar için korunmalıdır. Yalnız JavaScript ile şifre sormak bu davranışı sağlamaz.

## Doğrulananlar ve kurulumda kalanlar

Otomatik HTTP testleri Node 24.19.0 üzerinde çalıştırıldı. Eğitim akışındaki 17 karar, bölüm sonuçları ve sunum modu önceki prototipte işlev kontrolünden geçti; PDF sayfaları görsel olarak kontrol edildi. Yeni giriş ekranının gerçek tarayıcı/mobil kontrolü ve mevcut sitenin hosting/proxy uyumu kurulumu yapan geliştirici tarafından doğrulanmalıdır.

Önceki herkese açık demo, bu paketin kurulmasıyla otomatik olarak kapanmaz. Tam kapalı kamp erişimi isteniyorsa eski demo erişimi de ayrıca düzenlenmelidir. PDF'nin içindeki eski demo bağlantısı canlı kurulum adresi bilindiğinde değiştirilmelidir.

## Kaynaklar

Hasta A: Schlenzka ve Yrjönen, DOI 10.1007/s11832-012-0464-5, Şekil 1.
Hasta B: Kawasaki ve ark., DOI 10.1177/21925682211032559, Şekil 2 (kaynak CC BY-NC-ND 4.0).
Hasta C: Xu ve ark., DOI 10.1186/s12891-020-3182-z, Şekil 3 (CC BY 4.0).
Kaynak dosyalar ve şekil içeriği korunmuştur; ekranda ilgili bölge gösterilir. Kaynak atıfları kaldırılmamalıdır. Klinik içerik kaynaklı eğitim taslağıdır; bağımsız klinisyen onayı iddiası içermez.

Uygulama referansları: https://nodejs.org/api/crypto.html ve https://nodejs.org/api/http.html.

## Görsel tasarım
Açık turkuaz/lila arka plan, buzlu beyaz cam kartlar, yuvarlak Nunito başlıklar ve Plus Jakarta Sans metinler. `public/assets/design.css` tema değişkenlerini içerir. Dekoratif küre ve küpler SVG arka planıdır; tıbbi görüntülerin üzerine uygulanmaz. Fontlar yerel WOFF dosyalarıyla sağlanır; OFL lisansları `public/ui/` içindedir. Giriş ekranı aynı tasarımdadır. Yalnız `ui/login.css`, Nunito ve Plus Jakarta Sans fontları giriş öncesi açıktır; ders CSS dosyası, JSON, görüntüler ve PDF oturum korumasındadır.

## GitHub Pages inceleme demosu

`docs/` klasörü şifresiz statik eğitim demosudur. Node sunucusunu ve kamp şifre kontrolünü çalıştırmaz. Canlı sitede şifreli kullanım için kökteki entegrasyon servisi kurulmalıdır.
