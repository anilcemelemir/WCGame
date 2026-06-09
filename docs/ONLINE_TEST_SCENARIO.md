# Online Test Senaryosu

Bu dokuman online lobi, takim secimi, ortak turnuva akisi ve yayin oncesi kontroller icin kullanilir.

## Otomatik Smoke Test

On kosul: client ve lobi server calisiyor olmali.

```bash
npm run dev
npm run test:online
```

`npm run test:online` su kontrolleri yapar:

- Gecersiz oda kodu reddedilir.
- Odaya katilan oyuncu host ekranina yansir.
- Secilmis takim ikinci oyuncuya kilitlenir.
- Takim secmeden hazir verilmesi reddedilir.
- Herkes hazir olunca oyun baslar.
- Eksik ilk 11 plani reddedilir.
- Tum oyuncular plan gonderince planlar senkronize olur.
- Turnuva paketini sadece host baslatabilir.
- Ilk hafta tum oyunculara ayni anda yayilir.
- Tek oyuncu hazir verdiginde sonraki haftaya gecilmez.
- Herkes hazir verdiginde sonraki hafta yayilir.
- Son hafta bitince oyun tamamlanir.

## Manuel Arkadas Testi

### 1. Hazirlik

- Host `npm run dev` calistirsin.
- Ayni agdaysaniz host bilgisayarin IP adresini bulun.
- Arkadaslar `http://HOST_IP:5173/` adresine girsin.
- Gerekirse client `.env` icinde `VITE_LOBBY_HOST=HOST_IP:8787` kullanilsin.
- Windows guvenlik duvari 5173 ve 8787 portlarini engellemiyor olmali.

### 2. Lobi

- Host takma ad girip `Oda kur` butonuna basssin.
- Oda kodu gorunmeli.
- En az iki oyuncu oda koduyla katilsin.
- Her oyuncunun takma adi host ve diger oyuncularin lobi listesinde gorunmeli.
- Bir oyuncu takim sectiginde ayni takim diger oyuncularda secilemez hale gelmeli.
- Takim secmeden `Hazirim` denenirse hata mesaji gorunmeli.
- Hazir olan oyuncu takim degistirememeli.
- Haziri kaldirinca takim secimi tekrar degistirilebilir olmali.

### 3. Oyun Baslangici

- Her oyuncu farkli takim secip hazir versin.
- Tum oyuncular ayni anda kadro secim ekranina gecmeli.
- Her oyuncu 23 kisilik kadroyu secsin veya otomatik tamamlasin.
- Ilk 11, yedekler, taktik, penalti ve serbest vuruscu ayarlansin.
- Plan gonderildiginde oyuncu listesinde hazir plan sayisi artmali.
- Tum oyuncular plan gonderince host turnuva paketini olusturmali ve herkes ilk haftaya gecmeli.

### 4. Eszamanli Mac Haftasi

- Birbirine karsi oynayan iki oyuncu ayni mac anlatimini ve ayni skoru gormeli.
- Canli skor gol geldikce guncellenmeli.
- Duran top, korner, kart, duduk ve gol/kacti animasyonlari textlerden once gorunmeli.
- Mac bitince herkes `Sonraki haftaya hazirim` butonunu gormeli.
- Bir oyuncu hazir verince hafta ilerlememeli.
- Herkes hazir verince siradaki hafta ayni anda baslamali.

### 5. Negatif Testler

- Yanlis oda koduyla katilmayi dene: hata mesaji beklenir.
- Oyun basladiktan sonra ayni oda koduyla katilmaya calis: reddedilmesi beklenir.
- Host sekmesini kapat: hostluk odadaki sonraki oyuncuya gecmeli.
- Bir oyuncu mac haftasinda ayrilirsa hazir sayaci kalan oyunculara gore devam etmeli.
- Mobil ekranda lobi, kadro, saha ve mac anlatimi tasma yapmamali.

## Yayin Notu

GitHub Pages yalnizca statik frontend icin uygundur. Bu projenin online modu WebSocket lobi sunucusu gerektirir. Bu nedenle:

- Offline mod GitHub Pages uzerinde calisabilir.
- Online mod icin `server/lobbyServer.mjs` ayri bir Node/WebSocket hostunda calismalidir.
- Frontend yayininda `VITE_LOBBY_HOST` canli WebSocket adresine ayarlanmalidir.
