# Dotis - AI-Powered Telegram Issue Bot

Dotis automates the creation of GitHub issues from Telegram customer reports using AI classification and log analysis.

**Flow:** Customer sends `/bug` or `/istek` → AI classifies → logs fetched → issue drafted → user approves → GitHub issue created.

## Quick Start

### Prerequisites
- Node.js 22+
- Telegram bot token (from [@BotFather](https://t.me/BotFather))
- OpenAI API key
- GitHub Personal Access Token
- (Optional) Seq server for log lookup

### Setup

1. **Clone and install**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Initialize database**
   ```bash
   npx prisma migrate dev
   ```

4. **Start in development**
   ```bash
   npm run dev
   ```

## Scripts

- `npm run dev` — Start bot with hot reload
- `npm run build` — Compile TypeScript to `dist/`
- `npm start` — Run compiled bot
- `npm run db:migrate` — Create/update database schema
- `npm run db:generate` — Generate Prisma client

## Project Structure

```
src/
├── index.ts                 # Entry point
├── bot.ts                   # Telegram bot commands & callbacks
├── config.ts                # Environment variable validation
├── pipeline.ts              # AI workflow orchestrator
├── services/
│   ├── openai.ts           # Classification, duplicate check, drafting
│   ├── seq.ts              # Log lookup from Seq server
│   ├── github.ts           # GitHub issue creation
│   └── telegram.ts         # Message formatting & sending
├── prompts/
│   ├── classification.ts   # Intent classification prompt
│   └── issue-draft.ts      # Issue generation prompt
├── db/
│   ├── client.ts           # Prisma client singleton
│   └── repository.ts       # Database CRUD operations
└── types/
    └── index.ts            # Shared TypeScript types
```

## How It Works

### 1. Command Reception
User sends `/bug <message>` or `/istek <message>` in an allowed Telegram group.

### 2. Classification
OpenAI classifies intent (bug vs feature), extracts keywords, and estimates time range.

### 3. Log Lookup (bugs only)
Seq server searches for related error logs using extracted keywords and time range.

### 4. Duplicate Detection
Compares the issue summary to open GitHub issues to warn about duplicates.

### 5. Draft Generation
AI generates a professional GitHub issue with title, body, priority, and labels.

### 6. User Approval
Bot sends an inline keyboard:
- **✅ Olustur** — Create the issue
- **✏️ Duzenle** — Edit and regenerate
- **❌ Iptal** — Cancel

### 7. Issue Creation
On approval, the issue is created on GitHub and the user is notified with the issue number.

### 8. Timeout
After 5 minutes of inactivity, pending approvals are auto-cancelled.

## Status Machine

```
received → processing → awaiting_approval → completed
              ↓              ↓
            failed        cancelled
```

## Error Handling

- **OpenAI errors** → Mark failed, notify user
- **Seq unavailable** → Continue without logs (graceful degradation)
- **GitHub errors** → Mark failed, notify user
- **Duplicate Telegram updates** → Ignored via unique constraint

## Database

SQLite database with `TelegramMessage` table tracking:
- User message and metadata
- AI classification results
- Seq logs snapshot
- Draft issue JSON
- Processing status and errors

## Docker Deployment

```bash
docker-compose up -d --build
docker-compose logs -f dotis
```

The bot runs long polling (not webhooks) and persists the SQLite database to `./data/`.

## Configuration

See `.env.example` for all required environment variables:

- `TELEGRAM_BOT_TOKEN` — Bot token from BotFather
- `ALLOWED_CHAT_IDS` — Comma-separated Telegram group IDs (silent ignore others)
- `OPENAI_API_KEY` — OpenAI API key
- `OPENAI_MODEL` — Model to use (default: `gpt-4o-mini`)
- `SEQ_SERVER_URL` — Seq server URL (optional)
- `SEQ_API_KEY` — Seq authentication (optional)
- `GITHUB_TOKEN` — GitHub Personal Access Token
- `GITHUB_OWNER` — GitHub org/user
- `GITHUB_REPO` — Repository for issues
- `GITHUB_DEFAULT_LABELS` — Default issue labels
- `APPROVAL_TIMEOUT_MS` — Approval window (default: 5 minutes)

## License

MIT
