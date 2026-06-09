# GitHub Push Checklist

Repoyu GitHub'da olusturduktan sonra bu sirayla ilerle.

## 1. Local Kontroller

```bash
npm run lint
npm run build
npm run test:online
```

`npm run test:online` icin lokal lobby server calisir durumda olmali. En kolay yol:

```bash
npm run dev
```

## 2. Dosya Kontrolu

Commit'e girmemesi gerekenler:

- `node_modules/`
- `dist/`
- `.env`
- `.env.local`
- log ve cache dosyalari

Commit'e girmesi beklenenler:

- `src/`
- `server/`
- `scripts/`
- `docs/`
- `.github/workflows/deploy-pages.yml`
- `FC26_20250921.csv` veri seti, eger public yayinlama hakkindan eminsen
- `README.md`
- `LICENSE`
- `THIRD_PARTY_NOTICES.md`
- `.env.example`
- `render.yaml`
- `Procfile`

## 3. GitHub Remote

```bash
git remote add origin git@github.com:KULLANICI_ADI/REPO_ADI.git
git branch -M main
git add .
git commit -m "Initial WCGame project"
git push -u origin main
```

## 4. GitHub Pages

GitHub repository icinde:

1. `Settings > Pages`
2. Source: `GitHub Actions`
3. `Settings > Secrets and variables > Actions > Variables`
4. Degiskenleri ekle:

```text
VITE_BASE_PATH=/REPO_ADI/
VITE_LOBBY_HOST=BACKEND_DOMAIN
```

Custom domain kullaniyorsan:

```text
VITE_BASE_PATH=/
```

## 5. Backend

Render veya Koyeb uzerinde GitHub repo baglanir.

Render:

```text
Build command: npm ci
Start command: npm run start:server
Health check path: /healthz
```

Koyeb:

```text
Run command: npm run start:server
Health check path: /healthz
```

Backend domaini hazir olunca GitHub Actions variable olarak `VITE_LOBBY_HOST` guncellenir ve frontend workflow tekrar calistirilir.
