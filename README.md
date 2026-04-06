# Dotis

Telegram'dan GitHub issue oluşturmak için basit bir bot. Yazılım ekipleri için tasarlandı.

## Nasıl Çalışır

```
/task HiTravelUI: Login hatası @emreylmz77
→ ✅ Issue #5 oluşturuldu! (GitHub link)
```

Tek komut, direkt issue. AI yok, onay yok, bekleme yok.

## Komutlar

| Komut | Açıklama | Örnek |
|-------|----------|-------|
| `/task` | Genel task | `/task HiTravelUI: Refactor gerekli @ahmet` |
| `/bug` | Hata bildirimi | `/bug HiTravelCoApi: API timeout veriyor @emreylmz77` |
| `/istek` | Özellik talebi | `/istek HiMobile: Dark mode eklensin` |

### Format

```
/komut ProjeAdı: mesaj @telegramKullanıcıAdı
```

- **ProjeAdı** — `dotis.config.json`'daki proje adı
- **mesaj** — Issue başlığı ve açıklaması
- **@kullanıcı** — Sorumlu kişi (opsiyonel, yazmazsan kendine atanır)

## Kurulum

### Gereksinimler
- Docker
- Telegram bot token ([@BotFather](https://t.me/BotFather))
- GitHub Personal Access Token

### 1. Clone

```bash
git clone https://github.com/emreylmz7/Dotis.git
cd Dotis
```

### 2. Proje ve Ekip Ayarları

`dotis.config.json` dosyasını düzenle:

```json
{
  "projects": [
    {
      "id": "hitravelui",
      "name": "HiTravelUI",
      "owner": "DotlantisDev",
      "repo": "HiTravelUI",
      "defaultLabels": ["from-telegram"]
    }
  ],
  "teamMembers": [
    {
      "id": "emre",
      "name": "Emre",
      "telegramUsername": "emreylmz77",
      "githubUsername": "emreylmz7"
    }
  ]
}
```

### 3. Environment Variables

```bash
cp .env.example .env
```

`.env` dosyasını düzenle:

```env
TELEGRAM_BOT_TOKEN=botfather_token
ALLOWED_CHAT_IDS=-1001234567890
GITHUB_TOKEN=ghp_xxx
DATABASE_URL=file:./data/dotis.db
```

### 4. Başlat

```bash
docker compose up -d --build
```

Logları kontrol et:

```bash
docker compose logs -f dotis
```

## CI/CD

`main` branch'e push yapınca GitHub Actions otomatik VPS'e deploy eder.

### GitHub Secrets Gerekli

| Secret | Açıklama |
|--------|----------|
| `VPS_HOST` | VPS IP adresi |
| `VPS_USER` | SSH kullanıcısı |
| `VPS_SSH_KEY` | SSH private key |

## Proje/Kişi Güncelleme

`dotis.config.json`'ı düzenle → push et → otomatik deploy.

**Yeni proje ekle:**
```json
{
  "id": "himobile",
  "name": "HiMobile",
  "owner": "DotlantisDev",
  "repo": "HiMobile",
  "defaultLabels": ["from-telegram"]
}
```

**Yeni kişi ekle:**
```json
{
  "id": "ahmet",
  "name": "Ahmet",
  "telegramUsername": "ahmet_dev",
  "githubUsername": "ahmet-github"
}
```

## Proje Yapısı

```
src/
├── index.ts           # Entry point
├── bot.ts             # Telegram komut handler'ları
├── config.ts          # Env + dotis.config.json okuma
├── db/
│   ├── client.ts      # Prisma client
│   └── repository.ts  # DB CRUD
├── services/
│   └── github.ts      # GitHub issue oluşturma
└── types/
    └── index.ts       # TypeScript tipleri

dotis.config.json      # Proje ve ekip tanımları
```

## Teknolojiler

- **Runtime:** Node.js 22 + TypeScript
- **Bot:** grammy (long polling)
- **GitHub:** @octokit/rest
- **DB:** Prisma + SQLite
- **Deploy:** Docker + GitHub Actions

## Lisans

MIT
