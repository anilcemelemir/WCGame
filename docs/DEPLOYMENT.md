# Deployment Guide

Bu proje iki parcali yayinlanir:

- Frontend: GitHub Pages uzerinde statik Vite build.
- Backend: Render veya Koyeb uzerinde Node.js WebSocket lobby server.

## Mimari

```text
Oyuncular
  -> GitHub Pages frontend
  -> wss://BACKEND_DOMAIN WebSocket lobby server
```

GitHub Pages yalnizca statik dosya yayinlar. Online mod icin `server/lobbyServer.mjs` ayri bir Node.js web service olarak calismalidir.

## Frontend: GitHub Pages

Workflow dosyasi: `.github/workflows/deploy-pages.yml`

GitHub repository ayarlari:

1. `Settings > Pages` bolumune gir.
2. `Build and deployment > Source` alanini `GitHub Actions` yap.
3. Custom domain icin `playdraft.me` tanimli olmali ve `Enforce HTTPS` acik olmali.
4. `Settings > Secrets and variables > Actions > Variables` bolumune sunlari ekle:
   - `VITE_LOBBY_HOST`: backend domaini. Ornek: `wcgame-lobby.onrender.com` veya `wcgame-lobby.koyeb.app`
   - `VITE_BASE_PATH`: artik gerekli degil; workflow `playdraft.me` root domaini icin `/` ile build alir.

`VITE_BASE_PATH` secimi:

- Repo adresin `https://USERNAME.github.io/REPO/` ise: `/REPO/`
- Custom domain kullaniyorsan: `/`
- Repo adin `USERNAME.github.io` ise: `/`

Workflow bu repo icin her zaman `/` ile build alir ve `public/CNAME` dosyasi sayesinde artifact icinde `playdraft.me` domainini tasir. `VITE_BASE_PATH=/WCGame/` gibi bir Actions variable tanimliysa silinebilir; workflow bunu artik kullanmaz.

### Custom domain sorun giderme

`playdraft.me` adresinde `anilcemelemir.github.io` basligi veya profil sayfasi gorunuyorsa domain `WCGame` reposuna degil, kullanici sayfasi reposuna (`anilcemelemir.github.io`) bagli demektir.

Duzeltme:

1. `anilcemelemir.github.io` reposunda `Settings > Pages` bolumune gir.
2. Custom domain alaninda `playdraft.me` varsa kaldir.
3. `WCGame` reposunda `Settings > Pages` bolumune gir.
4. Source alanini `GitHub Actions` yap.
5. Custom domain alanina `playdraft.me` yaz.
6. DNS check tamamlaninca `Enforce HTTPS` secenegini ac.
7. `Actions > Deploy Frontend to GitHub Pages > Run workflow` ile yeniden deploy et.

Registrar tarafinda HTTP -> HTTPS yonlendirme ayari gerekmez. Apex DNS kayitlari GitHub Pages IP'lerine gittigi surece sertifika ve HTTPS zorlamasi GitHub Pages tarafindan yapilir.

## Backend: Render

Render dosyasi: `render.yaml`

Render ayarlari:

- Service type: `Web Service`
- Runtime: `Node`
- Build command: `npm ci`
- Start command: `npm run start:server`
- Health check path: `/healthz`
- Environment:
  - `NODE_ENV=production`

Render `PORT` degiskenini otomatik verir. Server bunu okur.

Render ucretsiz web service uyuyabilir. Uyuduktan sonra ilk HTTP veya WebSocket istegiyle tekrar uyanir; ilk baglanti yavas olabilir.

Frontend icin GitHub Actions variable:

```text
VITE_LOBBY_HOST=RENDER_DOMAIN
```

Ornek:

```text
VITE_LOBBY_HOST=wcgame-lobby.onrender.com
```

Frontend HTTPS oldugu icin uygulama otomatik `wss://wcgame-lobby.onrender.com` ile baglanir.
Production ortaminda frontend `http://playdraft.me` ile acilirsa uygulama `https://playdraft.me` adresine yonlendirir.

## Backend: Koyeb

Koyeb ayarlari:

- Deployment method: GitHub repository
- Service type: Web Service
- Build command: `npm ci`
- Run command: `npm run start:server` veya bos birakip `npm start`
- Port: Koyeb'in verdigi `PORT` environment'i kullanilir.
- Health check path: `/healthz`

`Procfile` Koyeb/Node buildpack icin hazir:

```text
web: npm run start:server
```

Frontend icin GitHub Actions variable:

```text
VITE_LOBBY_HOST=KOYEB_DOMAIN
```

Ornek:

```text
VITE_LOBBY_HOST=wcgame-lobby.koyeb.app
```

## Local Test

```bash
npm run dev
npm run test:online
```

Health check:

```bash
curl http://127.0.0.1:8787/healthz
```

Production build:

```bash
npm run lint
npm run build
```

GitHub Pages base path testi:

```bash
$env:VITE_BASE_PATH='/'
npm run build
```

## AdSense Notu

AdSense kodu frontend tarafinda `index.html` icindeki `<head>` alanina girer. `ads.txt` gerekiyorsa Vite icin `public/ads.txt` olusturulmalidir. Backend domaininin AdSense ile ilgisi yoktur; AdSense onayi frontend domaini uzerinden yapilir.
