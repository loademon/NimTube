# NimTube

[![VirusTotal Clean](https://img.shields.io/badge/VirusTotal-0%2F64%20Clean-emerald?style=flat&logo=virustotal)](https://www.virustotal.com/gui/file/65f10c11337ad700483d271692ea300b10fced994baaa1f93a9140b90c932964/detection)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

> **NimTube**, YouTube videolarını ve ses akışlarını harici bir sunucuya ihtiyaç duymadan, doğrudan kendi tarayıcınız ve internet bağlantınız üzerinden en yüksek kalitede (4K, 1080p, MP3) indirmenizi sağlayan istemci taraflı (client-side) açık kaynaklı bir medya aracıdır.

---

## Öne Çıkan Özellikler

- **Sıfır Sunucu Bant Genişliği:** İndirme işlemleri merkezi bir sunucu üzerinden değil, doğrudan kendi internet bağlantınız üzerinden yürütülür.
- **Hız Kısıtlaması Yok (Throttling Bypass):** YouTube'un tekil bağlantılarda uyguladığı oynatma hızı kısıtlamaları, arka planda 4 eşzamanlı 8 MB paralel worker ile aşılır.
- **Kayıpsız Tarayıcı İçi Birleştirme:** 1080p ve 4K çözünürlüklerdeki ayrı görüntü ve ses akışları, WebAssembly FFmpeg ile yeniden kodlama yapılmadan (`-c copy`) saniyeler içinde birleştirilir.
- **Doğrudan Diske Akış:** File System Access API kullanılarak indirilen parçalar doğrudan diske yazılır; 4K dosyalarda bile tarayıcı belleği (RAM) şişmez.
- **YouTube Sağ Tık Entegrasyonu:** Eklenti sayesinde YouTube'da izlediğiniz herhangi bir videoya sağ tıklayarak doğrudan "NimTube ile İndir" seçeneğiyle indirme başlatabilirsiniz.

---

## Mimari

```text
[ Tarayıcı Web Arayüzü ]
        │
        ▼ (window.postMessage)
[ NimTube Bridge Eklentisi (Manifest V3) ] ──► [ YouTube Innertube API ]
        │                                          (Oturum ve doğrudan CDN adresleri)
        ▼
[ 4x Paralel Worker Havuzu ] ──► [ Googlevideo CDN (8 MB Range Parçaları) ]
        │
        ▼
[ WebAssembly FFmpeg Worker ] ──► (-c copy kayıpsız MP4 konteyner birleştirme)
        │
        ▼
[ File System Access API ] ──► [ Kullanıcının Diski ]
```

---

## Kurulum ve Geliştirme

### Gereksinimler
- Node.js 18+
- npm veya pnpm

### Projeyi Çalıştırma
```bash
# Bağımlılıkları yükleyin
npm install

# Geliştirme sunucusunu başlatın
npm run dev

# Üretim derlemesi ve eklenti paketleme
npm run build
```

---

## NimTube Bridge Eklenti Kurulumu

YouTube indirme araçları Google'ın mağaza politikaları gereği Chrome Web Mağazası'nda yer alamaz. Bu nedenle eklenti açık kaynak olarak yerel kurulur:

1. `public/nimtube-bridge.zip` dosyasını indirin ve bir klasöre çıkartın.
2. Chromium tabanlı tarayıcınızda (Chrome, Edge, Brave, Opera) `chrome://extensions` adresini açın.
3. Sağ üst köşedeki **Geliştirici Modu** (Developer mode) anahtarını açın.
4. Sol üstteki **Paketlenmemiş öğe yükle** butonuna tıklayıp çıkarttığınız `nimtube-bridge` klasörünü seçin.

---

## Güvenlik ve Gizlilik

- **VirusTotal Doğrulaması:** Eklenti paketi (`nimtube-bridge.zip`) VirusTotal üzerinde taranmış olup **0 / 64 temiz** sonucuna sahiptir. [Resmi VirusTotal Raporunu İncele](https://www.virustotal.com/gui/file/65f10c11337ad700483d271692ea300b10fced994baaa1f93a9140b90c932964/detection).
- Eklenti yalnızca `*.youtube.com` ve `*.googlevideo.com` alan adlarına erişim izni ister.
- Tarayıcı geçmişinize, çerezlerinize, şifrelerinize veya diğer sekmelerinize kesinlikle erişmez.
- Hiçbir analitik, telemetri veya üçüncü parti izleyici içermez.

---

## Lisans

Bu proje [MIT Lisansı](LICENSE) altında açık kaynak olarak lisanslanmıştır.
