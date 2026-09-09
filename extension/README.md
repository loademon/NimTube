# NimTube Bridge Eklentisi (Chrome / Edge / Brave)

NimTube web uygulamasının merkezi bir proxy veya sunucuya ihtiyaç duymadan, doğrudan kullanıcının kendi IP adresi ve tarayıcısı üzerinden YouTube ile haberleşmesini sağlayan hafif Manifest V3 köprüsüdür.

## Kurulum (10 Saniye)

1. Tarayıcınızda eklentiler sayfasına gidin:
   - Chrome / Brave: `chrome://extensions`
   - Edge: `edge://extensions`
2. Sağ üstteki **"Geliştirici Modu" (Developer Mode)** anahtarını açın.
3. Sol üstteki **"Paketlenmemiş Öğe Yükle" (Load unpacked)** butonuna tıklayın.
4. Bu klasörü (`NimTube/extension`) seçin.
5. NimTube web uygulamasını (`https://nimtube.2615.us` veya yerel sunucunuzu) yenileyin. NimTube eklentiyi otomatik olarak algılayacaktır.

---

## Mimari & Güvenlik İzolasyonu

- **Doğrudan Tarayıcı İndirmesi (Direct Native Fetch):** Declarative Net Request kurallarıyla web uygulamasının YouTube CDN'lerinden doğrudan dosya çekebilmesi için gerekli başlıkları sağlar.
- **YouTube Oynatıcı Koruması:** `excludedInitiatorDomains` filtresi sayesinde YouTube, Google ve ilgili alan adlarından yapılan istekler (özellikle YouTube oynatıcısının `credentials: include` istekleri) kesinlikle etkilenmez; YouTube'daki video izleme deneyimi %100 izole kalır.
- **Sıfır Telemetri & Sıfır Sunucu:** Eklenti arka planda hiçbir veri toplamaz, analitik içermez ve verilerinizi dışarı aktarmaz.

