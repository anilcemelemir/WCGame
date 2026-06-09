# WCGame - Dünya Kupası Menajerlik Oyunu

Web tabanlı, ücretsiz oynanabilir, online lobi destekli Dünya Kupası menajerlik simülasyonu.

Oyuncu FC26 veri setinden milli takım kadrosu kurar, ilk 11 ve taktik planını seçer, ardından 48 takımlı Dünya Kupası formatında maç hafta hafta simüle edilir. Online modda arkadaşlar aynı odaya katılır, her takım yalnızca bir kez seçilir ve maç haftaları herkes hazır verdiğinde eşzamanlı ilerler.

## Özellikler

- React + Vite + TypeScript SPA frontend
- Node.js + WebSocket online lobi server
- FC26 oyuncu veri setinden ülke havuzu ve overall tabanlı kadro seçimi
- 48 takımlı Dünya Kupası grup ve eleme formatı
- Sürükle-bırak ilk 11, yedekler, formasyon ve taktik planı
- Penaltıcı ve serbest vuruşçu seçimi
- Oyuncu overall, pozisyon, taktik uyumu, duran top becerisi ve RNG kontrollü maç motoru
- OSM tarzı canlı maç anlatımı, skor paneli, düdük ve pozisyon animasyonları
- AdSense placeholder bileşenleri
- GitHub Pages frontend deploy workflow
- Render/Koyeb uyumlu backend dosyaları

## Teknoloji

- Frontend: React 19, Vite 6, TypeScript
- Backend: Node.js, `ws`
- UI: CSS, lucide-react
- Deployment hedefi:
  - Frontend: GitHub Pages
  - Backend: Render veya Koyeb Web Service

## Hızlı Başlangıç

```bash
npm install
npm run dev
```

Bu komut hem Vite client'ı hem de WebSocket lobi server'ını başlatır.

- Frontend: `http://127.0.0.1:5173/`
- Backend: `ws://127.0.0.1:8787`
- Health check: `http://127.0.0.1:8787/healthz`

## Komutlar

```bash
npm run dev            # Client + lobby server
npm run dev:client     # Sadece Vite frontend
npm run dev:server     # Sadece WebSocket backend
npm run start:server   # Production backend start
npm run lint           # TypeScript kontrolü
npm run build          # Production frontend build
npm run preview        # Build çıktısını lokal preview
npm run test:online    # WebSocket online smoke testi
```

## Ortam Değişkenleri

`.env.example` dosyasını referans al.

Frontend:

```text
VITE_LOBBY_HOST=127.0.0.1:8787
VITE_BASE_PATH=/
```

Backend:

```text
PORT=8787
```

Canlı frontend HTTPS üzerinden yayınlanırsa `VITE_LOBBY_HOST` yalnızca domain olarak verilebilir:

```text
VITE_LOBBY_HOST=wcgame-lobby.onrender.com
```

Uygulama bunu otomatik olarak `wss://wcgame-lobby.onrender.com` şeklinde kullanır.

## Dosya Yapısı

```text
.github/workflows/        GitHub Pages deployment workflow
Assets/                   Statik görsel varlıklar
Animations/               Animasyon referans/demoları
docs/                     Mimari, deploy ve test dokümantasyonu
scripts/                  Lokal geliştirme ve smoke test scriptleri
server/                   Node.js WebSocket lobi server
src/                      React frontend ve simülasyon motoru
FC26_20250921.csv         Oyuncu veri seti
render.yaml               Render blueprint
Procfile                  Koyeb/Node buildpack process tanımı
```

Detaylı mimari için: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

Deploy rehberi için: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Online test senaryosu için: [docs/ONLINE_TEST_SCENARIO.md](docs/ONLINE_TEST_SCENARIO.md)

Maç motoru referansı için: [docs/MATCH_ENGINE_REFERENCE.md](docs/MATCH_ENGINE_REFERENCE.md)

## Deployment

Frontend GitHub Pages ile yayınlanır. Workflow hazır:

```text
.github/workflows/deploy-pages.yml
```

Backend için iki hazır seçenek:

- Render: `render.yaml`
- Koyeb: `Procfile` ve `npm start`

Detaylar: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

## Test

Lokal server açıkken:

```bash
npm run test:online
```

Bu test oda kurma, katılma, takım kilidi, hazır durumu, plan gönderimi, host turnuva yayını ve hafta geçişi senkronizasyonunu kontrol eder.

## Lisans ve Veri Notu

Kaynak kod MIT lisansı ile yayınlanır. FC26 veri seti, futbolcu/turnuva isimleri, marka referansları ve üçüncü taraf varlıklar MIT lisansı kapsamında değildir. Detaylar için:

- [LICENSE](LICENSE)
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)
