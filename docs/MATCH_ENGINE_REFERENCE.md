# Web Tabanlı Futbol Simülasyon Oyunu — Taktik & Hesaplama Dokümantasyonu

## Genel Mimari Felsefesi

Bu dokümantasyon, hafif, eğlenceli ve hızlı oynanan bir web tabanlı futbol simülasyonu için taktiksel hesaplama sistemini tanımlar. Sistem üç ana katmandan oluşur: **Oyuncu Puanlama**, **Taktik Uyumluluk (Fit Skoru)** ve **Maç Simülasyonu**. Football Manager gibi profesyonel oyunlardan ilham alınmış olmakla birlikte, gereksiz karmaşıklıktan kaçınılmıştır.[^1]

Temel prensip şudur: gerçekçi simülasyonda oyuncuların nitelik (attribute) puanları, seçilen taktiğe ne kadar uyduklarını belirler; bunun üzerine iki taktiğin karşı karşıya geldiğinde hangi tarafın avantaj kazandığı hesaplanır.[^2]

***

## Bölüm 1: Oyuncu Nitelikleri (Attributes)

Football Manager'ın attribute sistemi dört ana kategoriye ayrılır. Hafif bir simülasyon için bu kategoriler sadeleştirilebilir.[^3]

### 1.1 Temel Attribute Kategorileri

| Kategori | Oyun için Önemi | Dahil Edilecek Örnekler |
|----------|----------------|-------------------------|
| **Teknik** | Topu kullanma kalitesi | Pas, Şut, Dribling, İlk Kontrol |
| **Mental** | Oyun okuma ve karar verme | Pozisyon Alma, Beklenti, Takım Çalışması |
| **Fiziksel** | Hız, güç, dayanıklılık | Hız, İvme, Dayanıklılık, Güç |
| **Kaleci** | Sadece kaleciye özel | Refleks, Pozisyon Alma |

### 1.2 Önerilen Sadeleştirilmiş Attribute Seti

Hafif bir oyun için her oyuncunun aşağıdaki **6 temel attribute**'a sahip olması önerilir. Her biri 1–20 arası bir değer alır (FM standardı).[^3]

```
PAC  → Hız (Pace + Acceleration ortalaması)
TEC  → Teknik (Pas + Şut + Dribling ortalaması)
PHY  → Fizik (Güç + Dayanıklılık ortalaması)
MEN  → Mental (Beklenti + Kararlar + Takım Çalışması ortalaması)
DEF  → Savunma (Pozisyon Alma + Müdahale ortalaması)
ATK  → Hücum (Şut + Çapraz + Hava Topu ortalaması)
```

### 1.3 Oyuncu Genel Puanı (Overall Rating)

FM-Arena testlerinde, tüm hesaplamalara göre **Hız (Pace/Acceleration)** en kritik meta-attributelar arasında yer alır; bu iki attribute değeri 2 puan artırıldığında takımlar sezonda ortalama 20 gol fazla atıp 20 gol az yemiştir.[^2]

```
OverallRating = (PAC * 1.5 + TEC * 1.2 + MEN * 1.3 + PHY * 1.0 + ATK * 1.1 + DEF * 1.1) / 7.2
```

> **Not:** Katsayılar pozisyona göre değişir. Bir forvetin ATK katsayısı 1.8'e çıkarken DEF katsayısı 0.6'ya düşer.

### 1.4 Pozisyona Göre Ağırlık Matrisi

| Pozisyon | PAC | TEC | MEN | PHY | ATK | DEF |
|----------|-----|-----|-----|-----|-----|-----|
| Kaleci | 0.5 | 0.8 | 1.2 | 1.0 | 0.2 | 1.8 |
| Stoper | 0.9 | 0.8 | 1.1 | 1.5 | 0.4 | 1.8 |
| Bek | 1.3 | 1.0 | 1.0 | 1.0 | 0.8 | 1.5 |
| Defansif Orta | 1.0 | 1.1 | 1.4 | 1.2 | 0.7 | 1.5 |
| Orta Saha | 1.1 | 1.4 | 1.4 | 1.0 | 1.0 | 1.0 |
| Kanat | 1.6 | 1.3 | 1.0 | 0.9 | 1.4 | 0.6 |
| Forvet | 1.4 | 1.2 | 1.1 | 1.2 | 1.8 | 0.3 |

***

## Bölüm 2: Taktikler ve Sistemi

### 2.1 Temel Taktik Listesi

Oyunda 8 temel taktik bulunur. Her taktik, bir **saldırı stili** ve bir **savunma bloğu** kombinasyonundan oluşur:[^4]

| ID | Taktik Adı | Saldırı Stili | Savunma Bloğu | Tempo |
|----|-----------|--------------|--------------|-------|
| T1 | **Gegenpressing** | Yüksek pres, hızlı geçiş | Yüksek blok | Çok yüksek |
| T2 | **Pozisyon Oyunu** | Kısa pas, yavaş birikim | Orta blok | Düşük |
| T3 | **Tiki-Taka** | Kısa pas, sürekli hareket | Orta blok | Orta |
| T4 | **Kontr-Atak** | Hızlı geçiş, uzun pas | Düşük blok | Değişken |
| T5 | **Long Ball** | Uzun top, kanat hücumu | Düşük blok | Yüksek |
| T6 | **Park the Bus** | Minimal hücum | Çok düşük blok | Çok düşük |
| T7 | **Yüksek Ofansif** | Sürekli baskı, çok oyuncu | Yüksek blok | Yüksek |
| T8 | **Kontrol** | Dengeli, esneklik | Orta blok | Orta |

### 2.2 Taktik Karşı-Sistem (Rock-Paper-Scissors)

eFootball ve gerçek futbol analizlerine göre taktikler arasında doğal bir üstünlük döngüsü vardır. Bu "taş-kağıt-makas" dinamiği, oyunun temel dengesidir:[^5][^6]

```
Gegenpressing  → Pozisyon Oyunu'nu yener  (yüksek pres, yavaş geçiş oyuncunu cezalandırır)
Pozisyon Oyunu → Long Ball'u yener        (top kontrolü, uzun top takımını etkisiz kılar)
Long Ball      → Kontr-Atak'ı yener       (derin blok bozulmaz, uzun toplarla alan kullanılır)
Kontr-Atak     → Gegenpressing'i yener    (pres arkasındaki alanı kanlı hücumla kullanır)
Tiki-Taka      → Kontr-Atak'ı yener       (top kontrolü, koşu alanı bırakmaz)
Long Ball      → Tiki-Taka'yı yener       (hava topu baskısı kısa pas oyununu bozar)
Park the Bus   → Yüksek Ofansif'i yener   (savunma yoğunluğu, hücumcu takımı sıkıştırır)
Yüksek Ofansif → Kontrol'ü yener          (baskı, dengeli takımın ritim bulmasını engeller)
```

### 2.3 Taktik Avantaj Matrisi

Aşağıdaki matris, her taktik çiftinin karşılaşmasında elde edilen **avantaj çarpanı**nı gösterir. 1.0 = nötr, >1.0 = avantaj, <1.0 = dezavantaj:[^7]

| Saldıran \ Savunan | Gegenpres | Pozisyon | Tiki-Taka | Kontr | LongBall | ParkBus | HighAtt | Kontrol |
|-------------------|-----------|----------|-----------|-------|----------|---------|---------|---------|
| **Gegenpres**     | 1.00 | **1.25** | 1.05 | 0.80 | 1.10 | 0.90 | 1.05 | 1.10 |
| **Pozisyon**      | 0.85 | 1.00 | 1.05 | 1.10 | **1.25** | 0.95 | 0.90 | 1.05 |
| **Tiki-Taka**     | 0.95 | 0.95 | 1.00 | **1.20** | 0.80 | 0.90 | 1.00 | 1.05 |
| **Kontr-Atak**    | **1.20** | 0.90 | 0.85 | 1.00 | **1.15** | 0.75 | 0.90 | 1.10 |
| **Long Ball**     | 0.90 | 0.80 | **1.20** | 0.85 | 1.00 | 0.85 | 1.10 | 0.95 |
| **Park the Bus**  | 1.10 | 1.05 | 1.10 | **1.25** | 1.15 | 1.00 | **1.20** | 1.05 |
| **High Attack**   | 0.95 | 1.10 | 1.00 | 1.10 | 0.90 | 0.80 | 1.00 | **1.20** |
| **Kontrol**       | 0.90 | 0.95 | 0.95 | 0.90 | 1.05 | 0.95 | 0.85 | 1.00 |

> **Kalın** değerler belirgin taktik üstünlükleri gösterir.

***

## Bölüm 3: Taktik-Oyuncu Uyum Skoru (Fit Score)

Bir taktiğin o kadroyla ne kadar uyumlu olduğunu ölçen **Fit Score**, oyunun en kritik hesaplamasıdır. FM mantığına göre iyi oyuncu iyi taktikten daha önemlidir; ancak doğru taktik doğru oyuncuyla birleşince büyük etki yaratır.[^2]

### 3.1 Her Taktik için Gereken Attribute Profili

| Taktik | Öncelikli Attribute | İkincil Attribute | Engel Attribute |
|--------|--------------------|--------------------|-----------------|
| Gegenpressing | PAC ≥14, PHY ≥13 | MEN ≥13, TEC ≥12 | - |
| Pozisyon Oyunu | TEC ≥14, MEN ≥13 | PAC ≥10 | - |
| Tiki-Taka | TEC ≥15, MEN ≥14 | PAC ≥12 | PHY düşük olabilir |
| Kontr-Atak | PAC ≥15, ATK ≥13 | MEN ≥12 | - |
| Long Ball | PHY ≥14, ATK ≥13 | PAC ≥12 | TEC düşük olabilir |
| Park the Bus | DEF ≥14, PHY ≥13 | MEN ≥12 | ATK düşük olabilir |
| High Attack | ATK ≥14, PAC ≥13 | TEC ≥12 | DEF zayıf kalır |
| Kontrol | TEC ≥13, MEN ≥13 | DEF ≥12, ATK ≥12 | - |

### 3.2 Fit Score Formülü

Her oyuncu için taktiğe olan uyum skoru şöyle hesaplanır:[^8]

```
PlayerFitScore(oyuncu, taktik) = Σ (attr_value[i] * weight[taktik][i]) / max_possible_score * 100
```

Burada `weight[taktik][i]`, ilgili taktikte o attribute'un ağırlığıdır. Ağırlıklar 0.0 ile 2.0 arasında değer alır.

**Örnek — Kontr-Atak için Ağırlıklar:**
```json
{
  "PAC": 2.0,
  "ATK": 1.8,
  "MEN": 1.2,
  "TEC": 0.8,
  "PHY": 1.0,
  "DEF": 0.5
}
```

**Takım Fit Skoru**, kadrodaki tüm oyuncuların fit skorlarının ağırlıklı ortalamasıdır. Pozisyon bazlı ağırlıklar uygulanır (forvet ve orta saha oyuncuları daha kritik):

```
TeamFitScore = (
  GK_fit * 0.8 +
  DEF_avg_fit * 1.0 +
  MID_avg_fit * 1.3 +
  ATT_avg_fit * 1.2
) / 4.3
```

### 3.3 Fit Skoru Yorumlama Tablosu

| Fit Skoru | Kategori | Görsel | Etki |
|-----------|----------|--------|------|
| 85–100 | Mükemmel | ⭐⭐⭐⭐⭐ | Taktik bonusu +%15 |
| 70–84 | İyi | ⭐⭐⭐⭐ | Taktik bonusu +%8 |
| 55–69 | Orta | ⭐⭐⭐ | Nötr |
| 40–54 | Zayıf | ⭐⭐ | Taktik cezası -%5 |
| 0–39 | Uyumsuz | ⭐ | Taktik cezası -%12 |

***

## Bölüm 4: Maç Simülasyon Hesaplaması

### 4.1 Takım Güç Skoru (Team Strength)

Her takım için iki ayrı güç skoru hesaplanır:[^9][^10]

```
AttackStrength(T) = (MID_avg_ATK * 1.1 + ATT_avg_ATK * 1.5 + ATT_avg_PAC * 0.8) / 3.4

DefenseStrength(T) = (GK_overall * 1.2 + DEF_avg_DEF * 1.5 + DEF_avg_PHY * 0.8 + MID_avg_DEF * 0.7) / 4.2
```

### 4.2 Şans Üretimi (Chance Creation)

Her maç, standart "tick" tabanlı bir döngüde işlenir. Her tickte iki takım için şans üretim oranı hesaplanır:[^11]

```
ChanceRate(A vs B) = (AttackStrength_A / DefenseStrength_B) * TacticMultiplier_AB * FitBonus_A
```

Burada:
- `TacticMultiplier_AB` → Bölüm 2.3'teki avantaj matrisinden alınan değer
- `FitBonus_A` → Bölüm 3.3'teki fit skoru dönüşüm tablosundan gelen çarpan

**Şans Üretim Sınırları:**
```
ChanceRate = Math.max(0.3, Math.min(3.0, ChanceRate))
```
> Hiçbir takım sıfır şans üretemez; çok güçlü fark durumunda da çarpan 3'te sınırlanır.

### 4.3 Gol Hesaplama — Poisson Dağılımı

Gerçek dünya futbol verilerine dayanan araştırmalar, gol dağılımının Poisson modeline uyduğunu gösterir. Hafif simülasyon için bunu şöyle uygulayabiliriz:[^12]

```
ExpectedGoals_A = BASE_RATE * ChanceRate_A    // BASE_RATE ≈ 1.3 gol/maç
ExpectedGoals_B = BASE_RATE * ChanceRate_B

Goals_A = poissonSample(ExpectedGoals_A)      // Gerçek Poisson örneklemesi
Goals_B = poissonSample(ExpectedGoals_B)
```

**Basit Poisson Örnekleme (JavaScript):**
```javascript
function poissonSample(lambda) {
  let L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}
```

### 4.4 Gol Rastgelelik Faktörü

Simülasyona biraz sürpriz katmak için küçük bir rastgelelik eklenebilir. Bu, düşük dereceli takımların zaman zaman üstün rakipleri yenmesine olanak tanır:[^13]

```javascript
const UPSET_CHANCE = 0.12; // %12 sürpriz ihtimali
const randomFactor = 1 + (Math.random() - 0.5) * 0.4; // ±%20 varyasyon
Goals_A = Math.round(Goals_A * randomFactor);
```

### 4.5 Maç Akışı Döngüsü (Pseudocode)

```
function simulateMatch(teamA, teamB, tacticA, tacticB):
  
  fitA = calculateTeamFit(teamA, tacticA)
  fitB = calculateTeamFit(teamB, tacticB)
  
  strengthA = calculateStrength(teamA, tacticA, fitA)
  strengthB = calculateStrength(teamB, tacticB, fitB)
  
  tacticMult_AB = TACTIC_MATRIX[tacticA][tacticB]
  tacticMult_BA = TACTIC_MATRIX[tacticB][tacticA]
  
  xG_A = BASE_RATE * (strengthA.attack / strengthB.defense) * tacticMult_AB
  xG_B = BASE_RATE * (strengthB.attack / strengthA.defense) * tacticMult_BA
  
  goals_A = poissonSample(clamp(xG_A, 0.3, 3.5))
  goals_B = poissonSample(clamp(xG_B, 0.3, 3.5))
  
  return { goalsA: goals_A, goalsB: goals_B, xG_A, xG_B, fitA, fitB }
```

***

## Bölüm 5: Gelişmiş Mekanikler

### 5.1 Kondisyon ve Yorgunluk

FM'deki yorgunluk mekanizmasından ilham alınarak:[^13]

- Her oyuncunun bir **kondisyon değeri** (0–100) vardır
- Maç oynadıkça kondisyon düşer: `cond -= match_intensity * 5`
- Düşük kondisyon tüm attribute'ları cezalandırır: `effective_attr = attr * (0.7 + kondisyon * 0.003)`
- Dinlendirme veya rotasyon ile kondisyon geri yüklenir

### 5.2 Moral Sistemi

- Takım morali 1–10 arasında değer alır
- Kazanılan maçlar morali artırır: `+1`, yenilen maçlar düşürür: `-1`
- Moral, genel takım performansını hafifçe etkiler: `moralMultiplier = 0.95 + (moral * 0.01)`

### 5.3 Ev Sahibi Avantajı

Araştırmalar, ev sahibi avantajının gerçek dünya verilerinde ölçülebilir olduğunu göstermektedir:[^9]

```
HOME_ADVANTAGE_BONUS = 0.08   // %8 attack/defense bonusu
homeAttack  *= (1 + HOME_ADVANTAGE_BONUS)
homeDefense *= (1 + HOME_ADVANTAGE_BONUS * 0.5)
```

### 5.4 Taktik Adaptasyon (AI Öğrenme)

FM motorunun gözlemlenen bir özelliğine göre AI rakibi, sizi yenen taktikleri tercih etme eğilimi kazanır. Basit bir uygulama:[^13]

```javascript
// Her maç sonrası AI taktik hafızasını günceller
if (aiWon) {
  aiTacticWeights[tacticUsed] += 0.1;
} else {
  aiTacticWeights[tacticUsed] -= 0.05;
}
// Ağırlıklar normalize edilir, bir sonraki seçim probability olarak kullanılır
```

***

## Bölüm 6: Skor Çıktısı ve UI Gösterimi

### 6.1 Maç Sonrası Özet Metrikleri

Her maç simülasyonundan sonra oyuncuya şu veriler gösterilebilir:

| Metrik | Formül | Yorum |
|--------|--------|-------|
| xG (Beklenen Gol) | Hesaplanan xG_A / xG_B | Gerçek kaliteyi gösterir |
| Taktik Avantajı | TACTIC_MATRIX değeri | "Taktiğin rakibine karşı %X avantajlıydı" |
| Kadro Uyumu | TeamFitScore | Kadronu ne kadar iyi kullandın |
| Dominant Skoru | attack / defense ratio | Maçı kim domine etti |

### 6.2 Renk Kodlu Fit Feedback

Oyuncuya oyuncu seçimi sırasında her oyuncunun seçili taktike uyumunu renkli göster:

```
🟢 Mükemmel uyum (Fit ≥ 85)
🟡 İyi uyum    (Fit 70–84)
🟠 Orta uyum   (Fit 55–69)
🔴 Zayıf uyum  (Fit < 55)
```

### 6.3 Taktik Öneri Sistemi

Kadronu analiz edip en uygun taktiki öneren basit bir fonksiyon:

```javascript
function suggestBestTactic(squad) {
  return TACTICS.map(tactic => ({
    tactic,
    fitScore: calculateTeamFit(squad, tactic)
  })).sort((a, b) => b.fitScore - a.fitScore).tactic;
}
```

***

## Bölüm 7: Denge ve Tuning Önerileri

### 7.1 Taktik Dengeleme İlkeleri

eFootball ve FM meta analizlerine göre, taktik dengeleme yaparken dikkat edilecekler:[^14][^5]

- **Hiçbir taktik her durumda kazanmamalı.** Avantaj çarpanları 1.30'u geçmemeli.
- **Sürpriz faktörü her zaman olmalı.** Güçlü takımlar da %10–15 ihtimalle yenilmeli.
- **Fit uyumu ceza/ödülü taktik avantajını geçmemeli.** Aksi hâlde oyuncu kalitesi her şeyi belirler.
- **Taktik sayısını 6–8'de tut.** Çok fazla seçenek kafa karıştırır; RPS döngüsü bozulur.[^14]

### 7.2 Attribute Dengeleme

FM Arena'nın 4.000 maçlık testlerine göre, en kritik attributelar:[^2]
1. **Hız (PAC)** — Hem hücumda hem savunmada en yüksek etkili
2. **İvme** — Hızla birleşince geometrik etki
3. **Beklenti (Anticipation)** — Pozisyon alma kalitesini doğrudan artırır
4. **Dayanıklılık** — Uzun vadeli maçlarda kritik
5. **İş Gücü (Work Rate)** — Pressing sistemlerinde vazgeçilmez

Bu nedenle attribute dengeleme yaparken PAC çok yüksek oyunculara doğal zayıflık (örn. düşük TEC veya DEF) eklenmelidir.

### 7.3 Taktik Zorluk Katmanları

Oyuna progresif bir zorluk eklemek için:

```
Seviye 1: Sadece 4 taktik (Kontr, Pozisyon, Long Ball, Pres)
Seviye 2: 6 taktik + oyuncu fit göstergesi
Seviye 3: 8 taktik + moral + kondisyon sistemi
Seviye 4: Tüm sistemler + AI taktik adaptasyonu
```

***

## Bölüm 8: Örnek Senaryo — Hesaplama Adım Adım

### Senaryo: Team A (Kontr-Atak) vs Team B (Gegenpressing)

**Team A Kadrosu:**
- Ortalama PAC: 16, ATK: 14, MEN: 12, TEC: 11, PHY: 13, DEF: 11

**Team B Kadrosu:**
- Ortalama PAC: 14, ATK: 13, MEN: 14, TEC: 13, PHY: 14, DEF: 13

**Adım 1 — Fit Skoru:**
```
TeamA FitScore (Kontr-Atak) = (PAC*2.0 + ATK*1.8 + MEN*1.2 + TEC*0.8 + PHY*1.0 + DEF*0.5) / max
= (16*2 + 14*1.8 + 12*1.2 + 11*0.8 + 13*1.0 + 11*0.5) / (20*7.3)
= (32 + 25.2 + 14.4 + 8.8 + 13 + 5.5) / 146 = 99.9/146 ≈ 68.4 → Orta (nötr)

TeamB FitScore (Gegenpressing) = (PAC*1.8 + PHY*1.6 + MEN*1.4 + TEC*1.2 ...) ≈ 74.2 → İyi (+%8)
```

**Adım 2 — Taktik Avantajı:**
```
TACTIC_MATRIX[Kontr][Gegenpres] = 1.20   // Kontr-Atak, Gegenpressing'i yener
```

**Adım 3 — xG Hesabı:**
```
xG_A = 1.3 * (14/13) * 1.20 * 1.00 (nötr fit) = 1.3 * 1.077 * 1.20 = 1.68
xG_B = 1.3 * (13/11) * 0.83 * 1.08 (iyi fit) = 1.3 * 1.182 * 0.83 * 1.08 = 1.38
```

**Adım 4 — Poisson Örneklemesi:**
```
Goals_A ~ Poisson(1.68) → Olası sonuç: 2
Goals_B ~ Poisson(1.38) → Olası sonuç: 1
```

**Sonuç: Team A 2–1 kazandı.** Kontr-Atak taktiği Gegenpressing'e karşı taktik avantaj sağladı; ancak Team B'nin iyi kadro uyumu farkı kapatmaya çalıştı.[^6][^5]

---

## References

1. [How football manager simulation games determine the outcome of ...](https://www.reddit.com/r/learnprogramming/comments/rucr1m/how_football_manager_simulation_games_determine/) - It takes an input of 2 teams, and based on the characteristics of those teams, it determines a winne...

2. [Attributes Are More Important Than Tactics - YouTube](https://www.youtube.com/watch?v=vf7HgdvbgEA) - How Football Manager's Match Engine Works. FMProjects•8.2K views · 11 ... The Game You Can't Fail. C...

3. [FM24 Guide: Player's Attributes Explained - Sortitoutsi](https://sortitoutsi.net/content/67538/fm24-guide-players-attributes-explained) - This guide delves into the four primary categories of Football Manager player's attributes: Technica...

4. [Tactics that counter each other](https://www.reddit.com/r/footballmanagergames/comments/11172r1/tactics_that_counter_each_other/)

5. [The eFootball Meta: Rock, Paper, Scissors of Playstyles - eFootball Edge](https://efootballedge.com/en/articles/meta-mastering-playstyle-matchups) - An in-depth analysis of the 'rock, paper, scissors' dynamic between Possession Game, Long Ball Count...

6. [Warshaw: Rock-Paper-Scissors game tells you a lot about ...](https://www.mlssoccer.com/news/warshaw-rock-paper-scissors-game-tells-you-lot-about-western-conference) - Warshaw: Let's play Rock-Paper-Scissors out West

7. [GitHub - claesjs/footylite: Football simulator with Node.js](https://github.com/claesjs/footylite) - Football simulator with Node.js. Contribute to claesjs/footylite development by creating an account ...

8. [I made a Site where you can calculate Players Rating & Role ...](https://www.reddit.com/r/footballmanagergames/comments/iavewo/i_made_a_site_where_you_can_calculate_players/) - You can enter the Attributes of a Player and the site will calculate a Rating for each Position (Onl...

9. [What's a good way of generating football scores based on team ...](https://stackoverflow.com/questions/64043308/whats-a-good-way-of-generating-football-scores-based-on-team-strength) - So for example, if a team had a max of 20 attack rating and played against a team with 5 defence rat...

10. [Soccer results formula. Any advice? : r/sportsanalytics - Reddit](https://www.reddit.com/r/sportsanalytics/comments/1so14ti/soccer_results_formula_any_advice/) - Strength= attack strength*defence strength. Attack strength= Goals scored per game for team/average ...

11. [Improving soccer simulation algorithm](https://stackoverflow.com/questions/1439102/improving-soccer-simulation-algorithm) - In another question, you helped me to build a simulation algorithm for soccer. I got some very good ...

12. [Luck vs Skill And Attack vs Defence - Statsbomb Blog Archive](https://blogarchive.statsbomb.com/articles/soccer/luck-vs-skill-and-attack-vs-defence/) - and we assume the expected number of goals in each game is independent, the following formula holds:...

13. [Does the Match Engine sometimes just decide you're going to lose?](https://www.reddit.com/r/footballmanagergames/comments/18w4n9j/does_the_match_engine_sometimes_just_decide_youre/) - The way the match engine works does make me not believe there is a predetermined outcomes. The engin...

14. [Is it possible for turn based games to not have rock-paper-scissor ...](https://www.reddit.com/r/gamedesign/comments/1tllsvq/is_it_possible_for_turn_based_games_to_not_have/) - RPS exactly is certainly not required, but a tactics-strategy game certainly needs to have distinct ...

