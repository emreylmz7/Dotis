import { Bot, InlineKeyboard } from 'grammy';
import { config, dotisConfig } from './config.js';
import * as repository from './db/repository.js';
import { createIssue } from './services/github.js';
import type { CommandType } from './types/index.js';

export const bot = new Bot(config.telegram.botToken);

// Pending issue flows waiting for user selections
interface PendingIssue {
  message: string;
  commandType: CommandType;
  projectId?: string;
  assigneeId?: string;
  chatId: bigint;
  senderUserId: bigint;
  senderUsername: string | null;
  telegramDate: Date;
  messageId: number;
  chatTitle: string | null;
  dbId: string;
}

const pendingIssues = new Map<string, PendingIssue>();

function isAllowedChat(chatId: bigint): boolean {
  return config.telegram.allowedChatIds.includes(chatId);
}

// =====================
// COMMANDS
// =====================

bot.command(['task', 'bug', 'istek'], async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  const raw = (ctx.match ?? '').trim();
  if (!raw) {
    await ctx.reply(
      '⚠️ Kullanım:\n<code>/task mesajınız</code>\n<code>/bug mesajınız</code>\n<code>/istek mesajınız</code>\n\nÖrnek:\n<code>/task Login hatası düzeltilecek</code>',
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Determine command type
  const cmd = ctx.msg.text?.split(' ')[0] ?? '/task';
  let commandType: CommandType = 'bug';
  if (cmd === '/bug') commandType = 'bug';
  else if (cmd === '/istek') commandType = 'feature';

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

  const pendingKey = dbRecord.id;
  pendingIssues.set(pendingKey, {
    message: raw,
    commandType,
    chatId,
    senderUserId: BigInt(ctx.from?.id ?? 0),
    senderUsername: ctx.from?.username ?? null,
    telegramDate: new Date((ctx.message?.date ?? 0) * 1000),
    messageId: ctx.message?.message_id ?? 0,
    chatTitle: ctx.chat.title ?? null,
    dbId: dbRecord.id,
  });

  // Show project selection
  await sendProjectSelection(ctx, pendingKey, raw);
});

// =====================
// CALLBACK HANDLERS
// =====================

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('p:')) {
    // Project selected → show assignee selection
    const [, pendingKey, projectId] = data.split(':');
    const pending = pendingIssues.get(pendingKey!);
    if (!pending) {
      await ctx.answerCallbackQuery({ text: '⚠️ Zaman aşımı, tekrar deneyin.' });
      return;
    }

    pending.projectId = projectId;
    await sendAssigneeSelection(ctx, pendingKey!);
    await ctx.answerCallbackQuery();
  } else if (data.startsWith('a:')) {
    // Assignee selected → create issue
    const [, pendingKey, assigneeId] = data.split(':');
    const pending = pendingIssues.get(pendingKey!);
    if (!pending) {
      await ctx.answerCallbackQuery({ text: '⚠️ Zaman aşımı, tekrar deneyin.' });
      return;
    }

    pending.assigneeId = assigneeId === 'none' ? undefined : assigneeId;
    pendingIssues.delete(pendingKey!);

    await createIssueFromPending(ctx, pending);
    await ctx.answerCallbackQuery();
  }
});

// =====================
// UI BUILDERS
// =====================

async function sendProjectSelection(ctx: any, pendingKey: string, message: string) {
  const keyboard = new InlineKeyboard();
  dotisConfig.projects.forEach((p, i) => {
    keyboard.text(p.name, `p:${pendingKey}:${p.id}`);
    if (i % 2 === 1) keyboard.row();
  });

  const text = `📝 <b>${escapeHtml(message)}</b>\n\n📁 Proje seçin:`;
  const opts: Record<string, unknown> = { parse_mode: 'HTML', reply_markup: keyboard };
  if (ctx.message?.message_id) opts.reply_to_message_id = ctx.message.message_id;
  await ctx.reply(text, opts as any);
}

async function sendAssigneeSelection(ctx: any, pendingKey: string) {
  const pending = pendingIssues.get(pendingKey)!;
  const project = dotisConfig.projects.find((p) => p.id === pending.projectId)!;

  const keyboard = new InlineKeyboard();
  dotisConfig.teamMembers.forEach((m, i) => {
    keyboard.text(m.name, `a:${pendingKey}:${m.id}`);
    if (i % 2 === 1) keyboard.row();
  });
  keyboard.row().text('Kimseyi Atama', `a:${pendingKey}:none`);

  const text =
    `📝 <b>${escapeHtml(pending.message)}</b>\n` +
    `📁 ${project.name}\n\n` +
    `👤 Kime atansın?`;

  await ctx.editMessageText(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

// =====================
// ISSUE CREATION
// =====================

async function createIssueFromPending(ctx: any, pending: PendingIssue) {
  const project = dotisConfig.projects.find((p) => p.id === pending.projectId)!;

  const assignee = pending.assigneeId
    ? dotisConfig.teamMembers.find((m) => m.id === pending.assigneeId)
    : undefined;

  let titlePrefix = '[Task]';
  if (pending.commandType === 'bug') titlePrefix = '[Hata]';
  else if (pending.commandType === 'feature') titlePrefix = '[Özellik]';

  // Update DB
  const extra: Record<string, string> = { projectId: project.id, projectName: project.name };
  if (assignee) {
    extra.assigneeGithubUsername = assignee.githubUsername;
    extra.assigneeName = assignee.name;
  }
  await repository.updateStatus(pending.dbId, 'processing', extra as any);

  try {
    const issue = await createIssue(
      {
        title: `${titlePrefix} ${pending.message}`,
        body: pending.message,
        priority: 'medium',
        labels: [],
      },
      project,
      assignee?.githubUsername
    );

    await repository.markCompleted(pending.dbId, issue.number, issue.url);

    let reply = `✅ <b>Issue #${issue.number}</b>\n\n`;
    reply += `📁 ${project.name}\n`;
    if (assignee) reply += `👤 ${assignee.name}\n`;
    reply += `📝 ${escapeHtml(pending.message)}\n`;
    reply += `\n<a href="${issue.url}">GitHub'da Görüntüle</a>`;

    await ctx.editMessageText(reply, { parse_mode: 'HTML' });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await repository.markFailed(pending.dbId, errorMsg);
    await ctx.editMessageText(`❌ Issue oluşturulamadı: ${errorMsg}`);
  }
}

// =====================
// UTILS
// =====================

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// =====================
// GLOBAL ERROR HANDLER
// =====================

bot.catch((err) => {
  console.error('grammy hatası:', err);
});
