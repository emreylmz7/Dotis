import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DotisConfig } from './types/index.js';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function loadDotisConfig(): DotisConfig {
  const configPath = resolve(process.cwd(), 'dotis.config.json');
  try {
    const raw = readFileSync(configPath, 'utf-8');
    const parsed = JSON.parse(raw) as DotisConfig;
    if (!parsed.projects?.length) throw new Error('dotis.config.json: en az 1 proje tanımlı olmalı');
    if (!parsed.teamMembers?.length) throw new Error('dotis.config.json: en az 1 ekip üyesi tanımlı olmalı');
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`dotis.config.json bulunamadı: ${configPath}`);
    }
    throw error;
  }
}

export const dotisConfig = loadDotisConfig();

export const config = {
  telegram: {
    botToken: required('TELEGRAM_BOT_TOKEN'),
    allowedChatIds: required('ALLOWED_CHAT_IDS')
      .split(',')
      .map((s) => BigInt(s.trim())),
  },
  github: {
    token: required('GITHUB_TOKEN'),
  },
  databaseUrl: required('DATABASE_URL'),
  approvalTimeoutMs: Number(optional('APPROVAL_TIMEOUT_MS', '300000')),
  nodeEnv: optional('NODE_ENV', 'development'),
} as const;
