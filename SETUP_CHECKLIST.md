# Dotis Setup & Deployment Checklist

Complete this checklist before deploying Dotis to production.

## Prerequisites ✅

- [x] Node.js 22+ installed locally
- [x] npm installed
- [x] Git installed (for version control)

## Telegram Bot Setup

- [ ] Go to [@BotFather](https://t.me/BotFather) on Telegram
- [ ] Send `/newbot` command
- [ ] Choose bot name (e.g., "Dotis Issue Bot")
- [ ] Choose bot username (e.g., `dotis_issue_bot`)
- [ ] Copy the **token** that BotFather provides
- [ ] Send `/setprivacy` → choose `Disable` (so bot can read group messages)
- [ ] Add bot to your test Telegram group
- [ ] Make bot an **admin** in that group (needed to read messages)
- [ ] Send a message to the group, then visit: `https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates`
- [ ] Find `chat.id` in the JSON response (your group ID)
- [ ] Paste the group ID into `ALLOWED_CHAT_IDS` in `.env`

## API Keys

### OpenAI API Key
- [ ] Go to https://platform.openai.com/api-keys
- [ ] Click "Create new secret key"
- [ ] Copy the key (starts with `sk-`)
- [ ] Paste into `.env` as `OPENAI_API_KEY`
- [ ] Set up usage limits / billing alerts in your OpenAI account

### GitHub Personal Access Token
- [ ] Go to GitHub → Settings → Developer Settings → Personal Access Tokens
- [ ] Click "Fine-grained tokens" (recommended)
- [ ] Choose "Generate new token"
- [ ] **Repository access**: Select only the repo where you want to create issues
- [ ] **Permissions**: Set `Issues` → `Read and Write`
- [ ] Generate and copy the token
- [ ] Paste into `.env` as `GITHUB_TOKEN`

### Seq API Key (Optional)
- [ ] Go to your Seq server dashboard (e.g., `http://your-seq-server:5341`)
- [ ] Navigate to Settings → API Keys
- [ ] Copy an existing key or create a new one
- [ ] Paste into `.env` as `SEQ_API_KEY`
- [ ] Set `SEQ_SERVER_URL` to your Seq server address

## Environment Configuration

- [ ] Copy `.env.example` to `.env`: `cp .env.example .env`
- [ ] Edit `.env` and fill in all required fields:
  - [ ] `TELEGRAM_BOT_TOKEN` (from @BotFather)
  - [ ] `ALLOWED_CHAT_IDS` (your group ID)
  - [ ] `OPENAI_API_KEY` (from OpenAI)
  - [ ] `OPENAI_MODEL` (default is fine: `gpt-4o-mini`)
  - [ ] `GITHUB_TOKEN` (from GitHub)
  - [ ] `GITHUB_OWNER` (your GitHub username or org)
  - [ ] `GITHUB_REPO` (repository for issues)
  - [ ] `GITHUB_DEFAULT_LABELS` (comma-separated, e.g., `bug,from-telegram`)
  - [ ] `SEQ_SERVER_URL` (optional, can be left empty)
  - [ ] `SEQ_API_KEY` (optional, can be left empty)
  - [ ] `DATABASE_URL` (default `file:./data/dotis.db` is usually fine)
  - [ ] `NODE_ENV` (set to `production` for production)
  - [ ] `APPROVAL_TIMEOUT_MS` (default 300000 = 5 minutes)

- [ ] Verify `.env` is in `.gitignore` (never commit it!)

## Local Testing

- [ ] Run `npm install` to install dependencies
- [ ] Run `npx prisma migrate dev` to set up the database
- [ ] Run `npm run build` to compile TypeScript (verify no errors)
- [ ] Run `npm run dev` to start the bot locally
- [ ] Check console for: `✅ Database connected` and `✅ Bot @<bot_name> started`

### Test the Bot
- [ ] In your Telegram test group, send: `/bug test message`
- [ ] Wait 10-15 seconds for the bot to respond
- [ ] Verify you see:
  - An inline keyboard with: `✅ Olustur`, `✏️ Duzenle`, `❌ Iptal` buttons
  - Issue draft preview with title, priority, labels
- [ ] Click `✅ Olustur` to create an issue
- [ ] Verify the issue appears on GitHub with the correct content
- [ ] Test the edit flow: send `/istek test feature` → click `✏️ Duzenle` → type new message → should regenerate draft
- [ ] Test the cancel: send `/bug another test` → click `❌ Iptal` → should show "Islem iptal edildi"
- [ ] Test timeout: send `/bug timeout test` → wait 5+ minutes without clicking anything → should auto-cancel

## Docker Setup (Optional but Recommended)

- [ ] Verify `Dockerfile` exists and is correct
- [ ] Verify `docker-compose.yml` exists and is correct
- [ ] Build the image: `docker-compose build` (verify no errors)
- [ ] Start the container: `docker-compose up -d`
- [ ] Check logs: `docker-compose logs -f dotis` (verify no errors)
- [ ] Test the bot (same as above)
- [ ] Stop: `docker-compose down`

## Production Deployment

### Before Going Live
- [ ] All tests pass locally and in Docker
- [ ] `.env` is fully configured with real credentials
- [ ] `.env` is **not** committed to git
- [ ] Database backup plan in place (if important)
- [ ] Bot is added to production Telegram group
- [ ] GitHub repo is ready to receive issues
- [ ] OpenAI account has sufficient credits/limits set
- [ ] Seq server is configured (if using logs)

### Deployment Options

#### Option A: VPS with Node.js
```bash
git clone <your-repo>
cd Dotis
cp .env.example .env
# Edit .env with production values
npm install
npm run build
npm start
```

Use systemd to keep the bot running:
```bash
[Unit]
Description=Dotis Telegram Bot
After=network.target

[Service]
User=<your-user>
WorkingDirectory=/path/to/Dotis
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

#### Option B: Docker (Recommended)
```bash
git clone <your-repo>
cd Dotis
cp .env.example .env
# Edit .env with production values
docker-compose up -d --build
docker-compose logs -f dotis
```

Use `restart: unless-stopped` in `docker-compose.yml` for automatic recovery.

#### Option C: Cloud Platform (AWS, DigitalOcean, etc.)
- [ ] Deploy the Docker image
- [ ] Mount a volume for persistent data (`./data`)
- [ ] Set environment variables via platform's secret manager (do not use .env in production)
- [ ] Configure health checks and auto-restart

## Post-Deployment

- [ ] Monitor logs for errors: `docker-compose logs -f` or `journalctl -u dotis -f`
- [ ] Test a few `/bug` and `/istek` commands
- [ ] Verify issues are created on GitHub
- [ ] Set up log rotation (if not Docker)
- [ ] Document any custom setup steps for your team
- [ ] Create a runbook for troubleshooting (see DOCS.md)

## Monitoring & Maintenance

### Daily
- [ ] Check for any bot errors in logs
- [ ] Verify OpenAI API usage is within budget

### Weekly
- [ ] Review created issues for quality
- [ ] Check GitHub API quota usage

### Monthly
- [ ] Review and prune old database records (optional)
- [ ] Update npm dependencies: `npm update`
- [ ] Update docker image: `docker-compose pull`

## Troubleshooting

### Bot not responding to commands
- [ ] Check bot token in `.env` is correct
- [ ] Verify bot has admin rights in the group
- [ ] Check allowed chat ID in `ALLOWED_CHAT_IDS`
- [ ] Check logs for errors

### OpenAI errors
- [ ] Verify API key is correct and has available quota
- [ ] Check network connectivity to `api.openai.com`
- [ ] Check OpenAI account for any issues/limits

### GitHub issue creation fails
- [ ] Verify GitHub token is correct
- [ ] Verify token has access to the target repo
- [ ] Verify `GITHUB_OWNER` and `GITHUB_REPO` are correct
- [ ] Check GitHub API rate limits

### Database errors
- [ ] Verify `DATABASE_URL` is correct
- [ ] Check disk space on the server
- [ ] Verify file permissions on `./data/` directory

For detailed documentation, see:
- `README.md` — User guide
- `DOCS.md` — Architecture & API docs
- `IMPLEMENTATION_SUMMARY.md` — Technical implementation details
