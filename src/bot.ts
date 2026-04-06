import { Bot } from 'grammy';
import { config, dotisConfig } from './config.js';
import * as repository from './db/repository.js';
import { createIssue } from './services/github.js';
import type { CommandType } from './types/index.js';

export const bot = new Bot(config.telegram.botToken);

function isAllowedChat(chatId: bigint): boolean {
  return config.telegram.allowedChatIds.includes(chatId);
}

/**
 * /task ProjeAdı: mesaj @kişi
 * /bug ProjeAdı: mesaj @kişi
 * /istek ProjeAdı: mesaj @kişi
 *
 * Örnekler:
 *   /task HiTravelUI: Login hatası @emre
 *   /bug HiTravelCoApi: API timeout veriyor @ahmet
 *   /istek HiTravelUI: Dark mode eklensin @emre
 */
bot.command(['task', 'bug', 'istek'], async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  const raw = (ctx.match ?? '').trim();
  if (!raw) {
    await ctx.reply(
      '⚠️ Kullanım:\n' +
        '<code>/task ProjeAdı: mesaj @kişi</code>\n\n' +
        '📋 Projeler: ' + dotisConfig.projects.map((p) => p.name).join(', ') + '\n' +
        '👥 Ekip: ' + dotisConfig.teamMembers.map((m) => `@${m.telegramUsername}`).join(', '),
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Parse: "ProjeAdı: mesaj @kişi"
  const parsed = parseTaskMessage(raw);
  if (!parsed) {
    await ctx.reply(
      '⚠️ Format hatalı.\n\nDoğru kullanım:\n<code>/task ProjeAdı: mesaj @kişi</code>\n\nÖrnek:\n<code>/task HiTravelUI: Login hatası @emre</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Find project
  const project = dotisConfig.projects.find(
    (p) => p.name.toLowerCase() === parsed.projectName.toLowerCase() || p.id === parsed.projectName.toLowerCase()
  );
  if (!project) {
    await ctx.reply(
      `❌ Proje bulunamadı: <b>${escapeHtml(parsed.projectName)}</b>\n\n📋 Mevcut projeler: ${dotisConfig.projects.map((p) => p.name).join(', ')}`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Find assignee by Telegram username
  let assignee = parsed.assigneeName
    ? dotisConfig.teamMembers.find(
        (m) => m.telegramUsername.toLowerCase() === parsed.assigneeName!.toLowerCase()
      )
    : undefined;

  // Default to sender's Telegram username if no assignee specified
  if (!assignee && ctx.from?.username) {
    assignee = dotisConfig.teamMembers.find(
      (m) => m.telegramUsername.toLowerCase() === ctx.from!.username!.toLowerCase()
    );
  }

  // Determine command type
  const cmd = ctx.msg.text?.split(' ')[0] ?? '/task';
  let commandType: CommandType = 'bug';
  let titlePrefix = '[Task]';
  if (cmd === '/bug') {
    commandType = 'bug';
    titlePrefix = '[Hata]';
  } else if (cmd === '/istek') {
    commandType = 'feature';
    titlePrefix = '[Özellik]';
  }

  // Save to DB
  const dbRecord = await repository.createMessage({
    telegramMessageId: ctx.message?.message_id ?? 0,
    chatId,
    chatTitle: ctx.chat.title ?? null,
    senderUserId: BigInt(ctx.from?.id ?? 0),
    senderUsername: ctx.from?.username ?? null,
    messageText: raw,
    commandType,
    telegramDate: new Date((ctx.message?.date ?? 0) * 1000),
  });

  const extra: Record<string, string> = { projectId: project.id, projectName: project.name };
  if (assignee) {
    extra.assigneeGithubUsername = assignee.githubUsername;
    extra.assigneeName = assignee.name;
  }
  await repository.updateStatus(dbRecord.id, 'processing', extra as any);

  // Create GitHub issue directly
  try {
    const issue = await createIssue(
      {
        title: `${titlePrefix} ${parsed.message}`,
        body: parsed.message,
        priority: 'medium',
        labels: [],
      },
      project,
      assignee?.githubUsername
    );

    await repository.markCompleted(dbRecord.id, issue.number, issue.url);

    let reply = `✅ <b>Issue #${issue.number}</b>\n\n`;
    reply += `📁 ${project.name}\n`;
    if (assignee) reply += `👤 ${assignee.name}\n`;
    reply += `\n<a href="${issue.url}">GitHub'da Görüntüle</a>`;

    const replyOpts: Record<string, unknown> = { parse_mode: 'HTML' };
    if (ctx.message?.message_id) replyOpts.reply_to_message_id = ctx.message.message_id;
    await ctx.reply(reply, replyOpts as any);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await repository.markFailed(dbRecord.id, errorMsg);
    const errOpts: Record<string, unknown> = {};
    if (ctx.message?.message_id) errOpts.reply_to_message_id = ctx.message.message_id;
    await ctx.reply(`❌ Issue oluşturulamadı: ${errorMsg}`, errOpts as any);
  }
});

// =====================
// PARSER
// =====================

interface ParsedTask {
  projectName: string;
  message: string;
  assigneeName: string | null;
}

function parseTaskMessage(raw: string): ParsedTask | null {
  // Format: "ProjeAdı: mesaj @kişi"
  const colonIndex = raw.indexOf(':');
  if (colonIndex === -1) return null;

  const projectName = raw.substring(0, colonIndex).trim();
  if (!projectName) return null;

  let rest = raw.substring(colonIndex + 1).trim();
  if (!rest) return null;

  // Extract @assignee from end
  let assigneeName: string | null = null;
  const atMatch = rest.match(/@(\w+)\s*$/);
  if (atMatch) {
    assigneeName = atMatch[1]!;
    rest = rest.substring(0, atMatch.index!).trim();
  }

  if (!rest) return null;

  return { projectName, message: rest, assigneeName };
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// =====================
// GLOBAL ERROR HANDLER
// =====================

bot.catch((err) => {
  console.error('grammy hatası:', err);
});
