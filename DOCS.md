# Hibot - AI Destekli Telegram Issue Bot

> Telegram grubundaki musteri mesajlarini otomatik olarak AI ile siniflandirip, Seq'ten log cekip, GitHub Issue olusturan bot servisi.

---

## Icindekiler

- [Genel Bakis](#genel-bakis)
- [Tech Stack](#tech-stack)
- [Sistem Akisi](#sistem-akisi)
- [Klasor Yapisi](#klasor-yapisi)
- [Kurulum](#kurulum)
- [Konfigurasyon](#konfigurasyon)
- [Veritabani Semasi](#veritabani-semasi)
- [Servisler](#servisler)
- [Bot Komutlari](#bot-komutlari)
- [Onay Mekanizmasi](#onay-mekanizmasi)
- [Hata Yonetimi](#hata-yonetimi)
- [Docker ile Deploy](#docker-ile-deploy)
- [On Gereksinimler](#on-gereksinimler)
- [Test Senaryolari](#test-senaryolari)

---

## Genel Bakis

HiTravel seyahat acentasi musterileri bir Telegram grubundan teknik olmayan dilde hata bildirimi ve ozellik talepleri yaziyor. Bu mesajlari manuel olarak issue'ya cevirmek zaman kaybettiriyor.

**Hibot bu sureci otomatize eder:**

1. Musteri `/bug` veya `/istek` komutuyla mesaj yazar
2. AI mesaji siniflandirir, anahtar kelimeleri cikarir
3. Hata ise Seq'ten ilgili backend loglarini ceker
4. GitHub'da benzer acik issue var mi kontrol eder
5. Teknik bir issue taslagi olusturur
6. Telegram'da onay butonu gosterir
7. Onaylanirsa GitHub'a issue acar
8. Musteriye issue numarasini bildirir

---

## Tech Stack

| Teknoloji | Amac |
|-----------|------|
| **Node.js + TypeScript** | Runtime + tip guvenligi |
| **grammy** | Telegram Bot framework (long polling) |
| **openai** | OpenAI API SDK (GPT-4o-mini) |
| **@octokit/rest** | GitHub Issues API |
| **Prisma + SQLite** | Veritabani ORM |
| **Docker (Alpine)** | Containerized deployment |
| **dotenv** | Ortam degiskenleri |

---

## Sistem Akisi

```
Kullanici: /bug Otel aramasi calismiyor, hata veriyor
        |
        v
grammy long polling --> /bug veya /istek komutu yaklanir
        |
        v
+---------------------------------------------+
| Pipeline                                    |
|                                             |
| 1. DB'ye kaydet (status: received)          |
| 2. OpenAI --> intent siniflandir            |
|    + keywords + timerange                   |
| 3. Bug ise --> Seq REST API                 |
|    --> ilgili hata loglari                  |
| 4. GitHub'da duplicate issue kontrolu       |
| 5. OpenAI --> teknik issue taslagi          |
|    (title, body, priority, labels)          |
+---------------------------------------------+
        |
        v
Telegram inline keyboard:
  [Issue Olustur]  [Duzenle]  [Iptal]
        |
        v (Kullanici "Issue Olustur"a basarsa)
+---------------------------------------------+
| 6. GitHub API --> issue olustur             |
| 7. Telegram --> "#123 ile olusturuldu"      |
| 8. DB guncelle (status: completed)          |
+---------------------------------------------+
```

---

## Klasor Yapisi

```
Hibot/
├── src/
│   ├── index.ts                  # Entry point, bot baslatma
│   ├── bot.ts                    # grammy bot, komut handlers, inline keyboard
│   ├── config.ts                 # .env parse + validation
│   ├── pipeline.ts               # Ana islem orchestrator
│   ├── services/
│   │   ├── openai.ts             # Classification + issue draft + duplicate check
│   │   ├── seq.ts                # Seq REST API log lookup
│   │   ├── github.ts             # GitHub issue CRUD
│   │   └── telegram.ts           # Mesaj gonderme/duzenleme helpers
│   ├── prompts/
│   │   ├── classification.ts     # Intent siniflandirma prompt
│   │   └── issue-draft.ts        # Issue taslagi prompt
│   ├── db/
│   │   └── repository.ts         # DB CRUD islemleri
│   └── types/
│       └── index.ts              # Shared types/interfaces
├── prisma/
│   └── schema.prisma
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── package.json
├── tsconfig.json
└── .gitignore
```

### Dosya Aciklamalari

| Dosya | Aciklama |
|-------|----------|
| `src/index.ts` | Uygulamayi baslatir, Prisma client'i initialize eder, grammy bot'u long polling modunda calistirir |
| `src/bot.ts` | `/bug` ve `/istek` komutlarini dinler, inline keyboard callback'lerini handle eder |
| `src/config.ts` | `.env` dosyasindan tum degiskenleri okur ve validate eder |
| `src/pipeline.ts` | Tum servisleri sirayla cagirir: AI siniflandirma → Seq lookup → duplicate check → issue draft → onay |
| `src/services/openai.ts` | OpenAI API ile mesaj siniflandirma, issue taslagi olusturma ve duplicate kontrolu |
| `src/services/seq.ts` | Seq REST API'ye HTTP istegi atip hata loglarini ceker |
| `src/services/github.ts` | Octokit ile GitHub issue olusturma, listeleme |
| `src/services/telegram.ts` | Telegram mesaj gonderme, duzenleme helper fonksiyonlari |
| `src/prompts/classification.ts` | AI'a gonderilecek intent siniflandirma system prompt'u |
| `src/prompts/issue-draft.ts` | AI'a gonderilecek issue taslagi system prompt'u |
| `src/db/repository.ts` | Prisma ile TelegramMessage CRUD islemleri |
| `src/types/index.ts` | ClassificationResult, IssueDraft, SeqLogEntry vb. tipler |

---

## Kurulum

### 1. Projeyi klonla ve bagimliliklari yukle

```bash
git clone <repo-url>
cd Hibot
npm install
```

### 2. Ortam degiskenlerini ayarla

```bash
cp .env.example .env
# .env dosyasini duzenle, tum degerleri doldur
```

### 3. Veritabanini olustur

```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Gelistirme modunda calistir

```bash
npx tsx src/index.ts
```

### 5. Production build

```bash
npm run build
node dist/index.js
```

---

## Konfigurasyon

### .env Dosyasi

```env
# ============================
# TELEGRAM
# ============================
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...       # BotFather'dan alinan token
ALLOWED_CHAT_IDS=-1001234567890            # Izin verilen grup ID'leri (virgul ile ayir)

# ============================
# OPENAI
# ============================
OPENAI_API_KEY=sk-...                      # OpenAI API anahtari
OPENAI_MODEL=gpt-4o-mini                  # Kullanilacak model

# ============================
# SEQ (Log Lookup)
# ============================
SEQ_SERVER_URL=http://10.10.0.30:8081     # Seq sunucu adresi
SEQ_API_KEY=                               # Seq API anahtari
SEQ_MAX_EVENTS=50                          # Maksimum cekilecek log sayisi

# ============================
# GITHUB
# ============================
GITHUB_TOKEN=ghp_...                       # GitHub Personal Access Token
GITHUB_OWNER=your-org                      # GitHub kullanici/org adi
GITHUB_REPO=hitravel-issues                # Issue acilacak repo
GITHUB_DEFAULT_LABELS=from-telegram        # Varsayilan etiketler (virgul ile ayir)

# ============================
# UYGULAMA
# ============================
DATABASE_URL=file:./data/hibot.db          # SQLite veritabani yolu
```

### config.ts Yapisi

```typescript
// Tum env degiskenleri burada parse edilir ve validate edilir.
// Eksik veya hatali deger varsa uygulama baslamadan hata verir.

interface Config {
  telegram: {
    botToken: string;
    allowedChatIds: number[];
  };
  openai: {
    apiKey: string;
    model: string;
  };
  seq: {
    serverUrl: string;
    apiKey: string;
    maxEvents: number;
  };
  github: {
    token: string;
    owner: string;
    repo: string;
    defaultLabels: string[];
  };
  databaseUrl: string;
}
```

---

## Veritabani Semasi

### TelegramMessage Tablosu

```prisma
model TelegramMessage {
  id                  String    @id @default(uuid())
  telegramMessageId   Int                              // Telegram mesaj ID
  chatId              BigInt                            // Telegram grup ID
  chatTitle           String?                           // Grup adi
  senderUserId        BigInt                            // Gonderen kullanici ID
  senderUsername       String?                           // Gonderen username
  messageText         String                            // Mesaj icerigi
  commandType         String                            // "bug" | "feature"
  telegramDate        DateTime                          // Mesajin Telegram'daki tarihi
  classifiedIntent    String?                           // AI siniflandirma sonucu
  confidence          Float?                            // AI guven skoru (0-1)
  extractedKeywords   String?                           // JSON: ["otel", "arama", "hata"]
  estimatedTimeRange  String?                           // JSON: {"from": "...", "to": "..."}
  seqLogsSnapshot     String?                           // JSON: Seq'ten cekilen loglar
  aiDraftJson         String?                           // JSON: AI'in olusturdugu issue taslagi
  status              String    @default("received")    // received|processing|awaiting_approval|completed|cancelled|failed
  errorMessage        String?                           // Hata durumunda aciklama
  retryCount          Int       @default(0)             // Tekrar deneme sayisi
  issueNumber         Int?                              // Olusturulan GitHub issue numarasi
  issueUrl            String?                           // GitHub issue URL'i
  duplicateOfIssue    String?                           // Duplicate tespit edilirse issue ref
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@unique([telegramMessageId, chatId])
}
```

### Status Gecisleri

```
received --> processing --> awaiting_approval --> completed
                |                  |
                v                  v
              failed           cancelled
```

| Status | Aciklama |
|--------|----------|
| `received` | Mesaj DB'ye kaydedildi |
| `processing` | AI siniflandirma + Seq lookup + issue draft isleniyor |
| `awaiting_approval` | Inline keyboard ile onay bekleniyor |
| `completed` | GitHub issue olusturuldu |
| `cancelled` | Kullanici iptal etti |
| `failed` | Pipeline'da hata olustu |

---

## Servisler

### 1. OpenAI Servisi (`services/openai.ts`)

Uc ana fonksiyon:

#### a) classifyMessage(messageText, commandType)

Musteri mesajini analiz eder.

**Girdi:**
```
"Otel aramasi calismiyor, 500 hatasi veriyor, dun aksam basladi"
```

**Cikti (JSON):**
```json
{
  "intent": "bug",
  "confidence": 0.95,
  "keywords": ["otel", "arama", "500", "hata"],
  "timeRange": {
    "from": "2026-04-02T18:00:00Z",
    "to": "2026-04-03T12:00:00Z"
  },
  "summary": "Otel arama fonksiyonu 500 hatasi donuyor"
}
```

#### b) checkDuplicate(newMessage, existingIssueTitles)

Mevcut acik issue'larla karsilastirir.

**Cikti:**
```json
{
  "isDuplicate": true,
  "similarIssueNumber": 45,
  "similarityReason": "Her iki issue da otel arama 500 hatasiyla ilgili"
}
```

#### c) generateIssueDraft(message, seqLogs, classification)

Teknik issue taslagi olusturur.

**Cikti:**
```json
{
  "title": "[Bug] Otel arama servisi 500 Internal Server Error donuyor",
  "body": "## Musteri Bildirimi\nOtel aramasi calismiyor...\n\n## Teknik Analiz\n...\n\n## Seq Loglari\n...",
  "priority": "high",
  "labels": ["bug", "otel-servisi", "priority-high"]
}
```

---

### 2. Seq Servisi (`services/seq.ts`)

Seq REST API'ye HTTP istegi atar.

#### searchLogs(keywords, timeRange)

**API Cagrisi:**
```
GET {SEQ_SERVER_URL}/api/events
  ?filter=@Message like '%otel%' or @Message like '%arama%'
  &fromDateUtc=2026-04-02T18:00:00Z
  &toDateUtc=2026-04-03T12:00:00Z
  &count=50
Headers:
  X-Seq-ApiKey: {SEQ_API_KEY}
```

**Cikti:**
```json
[
  {
    "timestamp": "2026-04-02T20:15:00Z",
    "level": "Error",
    "message": "Unhandled exception in HotelSearchService",
    "exception": "System.NullReferenceException: Object reference not set..."
  }
]
```

**Not:** Seq'e ulasilamazsa pipeline logsuz devam eder (graceful degradation).

---

### 3. GitHub Servisi (`services/github.ts`)

Octokit ile GitHub Issues API.

#### createIssue(draft)

```typescript
// Octokit ile issue olusturma
const response = await octokit.issues.create({
  owner: config.github.owner,
  repo: config.github.repo,
  title: draft.title,
  body: draft.body,
  labels: [...config.github.defaultLabels, ...draft.labels]
});
// return { number: response.data.number, url: response.data.html_url }
```

#### getOpenIssues()

Duplicate kontrolu icin acik issue'larin baslik listesini doner.

---

### 4. Telegram Servisi (`services/telegram.ts`)

grammy bot instance uzerinden mesaj gonderme helper'lari.

```typescript
// Taslak onay mesaji gonderme (inline keyboard ile)
sendDraftApproval(chatId, messageId, draft)

// Sonuc bildirimi
sendCompletionMessage(chatId, messageId, issueNumber, issueUrl)

// Hata bildirimi
sendErrorMessage(chatId, messageId, errorText)
```

---

## Bot Komutlari

### /bug

Hata bildirimi icin kullanilir.

```
/bug Otel aramasi calismiyor, 500 hatasi veriyor
```

**Islem:**
1. Mesaji parse et (komut + icerik)
2. Izin verilen grup mu kontrol et
3. Pipeline'i baslat (AI siniflandirma → Seq lookup → duplicate check → draft)
4. Onay keyboard'u goster

---

### /istek

Yeni ozellik talebi icin kullanilir.

```
/istek Oda tipine gore filtreleme ozelligi eklenmeli
```

**Islem:**
1. Mesaji parse et
2. Pipeline'i baslat (AI siniflandirma → duplicate check → draft)
3. Seq log lookup YAPILMAZ (hata degil, ozellik talebi)
4. Onay keyboard'u goster

---

### Diger Mesajlar

Bot izin verilen gruplardaki diger mesajlari **ignore eder**. Sadece `/bug` ve `/istek` komutlari islenir.

---

## Onay Mekanizmasi

### Taslak Gosterimi

Bot, pipeline tamamlaninca Telegram'da su formatta mesaj gonderir:

```
📋 Issue Taslagi

Baslik: [Bug] Otel arama servisi 500 hatasi
Oncelik: 🔴 High
Etiketler: bug, otel-servisi

Ozet: Otel arama sayfasinda 500 Internal Server Error
donuyor. Seq loglarinda NullReferenceException
tespit edildi...

[✅ Olustur]  [✏️ Duzenle]  [❌ Iptal]
```

### Buton Aksiyonlari

| Buton | Aksiyon |
|-------|---------|
| **Olustur** | GitHub'da issue olusturur, sonucu bildirir |
| **Duzenle** | Kullanicidan yeni mesaj bekler, AI taslagi gunceller, tekrar onay gosterir |
| **Iptal** | Islemi iptal eder, DB'de status = `cancelled` |

### Timeout

- 5 dakika icerisinde buton basilmazsa islem otomatik iptal edilir
- Kullaniciya "Islem zaman asimina ugradi" mesaji gonderilir

### Duplicate Uyarisi

Eger benzer acik issue tespit edilirse, onay mesajina ek bilgi eklenir:

```
⚠️ Benzer bir issue zaten mevcut: #45 - Otel arama hatasi
Yine de yeni issue olusturmak ister misiniz?

[✅ Yine de Olustur]  [🔗 Mevcut Issue'ya Git]  [❌ Iptal]
```

---

## Hata Yonetimi

| Senaryo | Davranis |
|---------|----------|
| **OpenAI API hatasi/timeout** | Kullaniciya "Mesajiniz islenemedi, lutfen tekrar deneyin" yaniti. DB'de `status=failed`. 30s timeout. |
| **Seq'e ulasilamadi** | Pipeline logsuz devam eder. Issue body'sine "Seq loglari alinamadi" notu eklenir. |
| **GitHub API hatasi** | Kullaniciya "Issue olusturulamadi" mesaji. DB'de `status=failed`. |
| **Duplicate mesaj** | `telegramMessageId + chatId` unique constraint ile engellenir. Ayni mesaj iki kez islenmez. |
| **Izinsiz grup** | Mesaj sessizce ignore edilir. |
| **Bos mesaj** | `/bug` veya `/istek` komutundan sonra mesaj yoksa "Lutfen aciklama yazin" uyarisi. |
| **Genel pipeline hatasi** | Tum hata DB'ye kaydedilir (`errorMessage` alani). `retryCount` arttirilir. |

---

## Docker ile Deploy

### Dockerfile

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./
RUN npx prisma migrate deploy
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### docker-compose.yml

```yaml
services:
  hibot:
    build: .
    env_file: .env
    volumes:
      - ./data:/app/data    # SQLite veritabani persist
    restart: unless-stopped
```

### Deploy Adimlari

```bash
# 1. .env dosyasini olustur ve doldur
cp .env.example .env
nano .env

# 2. Build ve calistir
docker-compose up -d --build

# 3. Loglari kontrol et
docker-compose logs -f hibot

# 4. Durdur
docker-compose down
```

---

## On Gereksinimler

Projeyi calistirmadan once asagidaki adimlari tamamla:

### 1. Telegram Bot Olusturma

1. Telegram'da `@BotFather`'a git
2. `/newbot` komutunu gonder
3. Bot adi gir (orn: `HiTravel Destek Bot`)
4. Username belirle (orn: `hitravel_support_bot`)
5. BotFather'in verdigi **token**'i kaydet
6. `/setprivacy` komutunu gonder → `Disable` sec (grup mesajlarini okumasi icin)
7. Botu Telegram grubuna ekle
8. Botu **admin** yap (mesajlari okuyabilmesi icin)
9. Grup ID'sini ogren: Botu gruba ekledikten sonra gruba mesaj yaz, sonra `https://api.telegram.org/bot<TOKEN>/getUpdates` adresinden `chat.id` degerini al

### 2. OpenAI API Key

1. https://platform.openai.com/api-keys adresine git
2. "Create new secret key" tikla
3. Key'i kopyala → `.env` > `OPENAI_API_KEY`

### 3. GitHub Personal Access Token

1. GitHub > Settings > Developer Settings > Personal Access Tokens > Fine-grained tokens
2. "Generate new token" tikla
3. Repository access: sadece issue acilacak repo'yu sec
4. Permissions: Issues → Read and Write
5. Token'i kopyala → `.env` > `GITHUB_TOKEN`

### 4. Seq API Key

1. Seq dashboard'una git (http://10.10.0.30:8081)
2. Settings > API Keys
3. Mevcut key'i kopyala veya yeni olustur
4. `.env` > `SEQ_API_KEY`'e kaydet

---

## Test Senaryolari

### Senaryo 1: Bug Bildirimi (Tam Akis)

```
Girdi:  /bug Otel aramasi yapilamiyor, 500 hatasi veriyor
Beklenen:
  1. Bot "Isleniyor..." mesaji gonderir
  2. AI siniflandirma: intent=bug, keywords=[otel, arama, 500]
  3. Seq'ten ilgili loglar cekilir
  4. Taslak inline keyboard ile gosterilir
  5. "Olustur" basilinca GitHub'da issue acilir
  6. "Talebiniz #123 ile olusturuldu" mesaji gelir
```

### Senaryo 2: Ozellik Talebi

```
Girdi:  /istek Oda tipine gore filtreleme ozelligi eklenmeli
Beklenen:
  1. AI siniflandirma: intent=feature
  2. Seq lookup YAPILMAZ
  3. Taslak gosterilir
  4. Onaylaninca GitHub'da feature-request etiketiyle issue acilir
```

### Senaryo 3: Duplicate Tespit

```
Girdi:  /bug Otel aramasi hata veriyor
Beklenen:
  1. GitHub'da benzer acik issue (#45) tespit edilir
  2. "Benzer issue mevcut: #45" uyarisi gosterilir
  3. "Yine de Olustur" veya "Mevcut Issue'ya Git" secenekleri sunulur
```

### Senaryo 4: Iptal

```
Girdi:  /bug Sayfa yavas aciliyor
Beklenen:
  1. Taslak gosterilir
  2. Kullanici "Iptal" butonuna basar
  3. DB'de status = cancelled
  4. "Islem iptal edildi" mesaji
```

### Senaryo 5: Timeout

```
Girdi:  /bug Bir hata var
Beklenen:
  1. Taslak gosterilir
  2. 5 dakika boyunca buton basilmaz
  3. Otomatik iptal + "Islem zaman asimina ugradi" mesaji
```

### Senaryo 6: Seq Erisim Hatasi

```
Girdi:  /bug Odeme sayfasi calismiyor
Beklenen:
  1. Seq'e ulasilamaz
  2. Pipeline logsuz devam eder
  3. Issue body'sine "Seq loglari alinamadi" notu eklenir
  4. Issue yine olusturulur
```
