import { Bot, InlineKeyboard, Keyboard } from 'grammy';
import { config, dotisConfig } from './config.js';
import * as repository from './db/repository.js';
import { createIssue } from './services/github.js';
import type { CommandType } from './types/index.js';

export const bot = new Bot(config.telegram.botToken);

// =====================
// STATE
// =====================

interface PendingIssue {
  message: string;
  commandType?: CommandType;
  projectId?: string;
  chatId: bigint;
  senderUserId: bigint;
  senderUsername: string | null;
  telegramDate: Date;
  messageId: number;
  chatTitle: string | null;
  dbId: string;
}

const pendingIssues = new Map<string, PendingIssue>();

// Users waiting to type a message (chatId:userId → true)
const waitingForMessage = new Map<string, boolean>();

function isAllowedChat(chatId: bigint): boolean {
  return config.telegram.allowedChatIds.includes(chatId);
}

// Persistent reply keyboard
const mainKeyboard = new Keyboard().text('📝 Yeni Issue').resized().persistent();

// =====================
// /start - Show persistent keyboard
// =====================

bot.command('start', async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  await ctx.reply(
    '👋 <b>Dotis Bot</b> hazır!\n\nAşağıdaki butonu kullanarak issue oluşturabilirsiniz.',
    { parse_mode: 'HTML', reply_markup: mainKeyboard }
  );
});

// =====================
// "Yeni Issue" button tap
// =====================

bot.hears('📝 Yeni Issue', async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  const userKey = `${chatId}:${ctx.from?.id}`;
  waitingForMessage.set(userKey, true);

  await ctx.reply('✏️ Issue mesajınızı yazın:', { reply_markup: mainKeyboard });
});

// =====================
// Catch typed message (after "Yeni Issue" tap)
// =====================

bot.on('message:text', async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  const userKey = `${chatId}:${ctx.from?.id}`;
  if (!waitingForMessage.get(userKey)) return;

  waitingForMessage.delete(userKey);

  const message = ctx.message.text.trim();
  if (!message) return;

  // Save to DB
  const dbRecord = await repository.createMessage({
    telegramMessageId: ctx.message.message_id,
    chatId,
    chatTitle: ctx.chat.title ?? null,
    senderUserId: BigInt(ctx.from.id),
    senderUsername: ctx.from.username ?? null,
    messageText: message,
    commandType: 'bug', // temporary
    telegramDate: new Date(ctx.message.date * 1000),
  });

  const pendingKey = dbRecord.id;
  pendingIssues.set(pendingKey, {
    message,
    chatId,
    senderUserId: BigInt(ctx.from.id),
    senderUsername: ctx.from.username ?? null,
    telegramDate: new Date(ctx.message.date * 1000),
    messageId: ctx.message.message_id,
    chatTitle: ctx.chat.title ?? null,
    dbId: dbRecord.id,
  });

  // Step 1: Type selection
  const keyboard = new InlineKeyboard()
    .text('📋 Task', `t:${pendingKey}:task`)
    .text('🐛 Bug', `t:${pendingKey}:bug`)
    .text('💡 İstek', `t:${pendingKey}:feature`);

  await ctx.reply(
    `📝 <b>${escapeHtml(message)}</b>\n\n🏷️ Tür seçin:`,
    { parse_mode: 'HTML', reply_markup: keyboard, reply_to_message_id: ctx.message.message_id }
  );
});

// =====================
// CALLBACK: Type → Project → Assignee
// =====================

bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (data.startsWith('t:')) {
    // Type selected → show projects
    const [, pendingKey, type] = data.split(':');
    const pending = pendingIssues.get(pendingKey!);
    if (!pending) return void await ctx.answerCallbackQuery({ text: '⚠️ Zaman aşımı.' });

    pending.commandType = type === 'bug' ? 'bug' : type === 'feature' ? 'feature' : 'bug';

    const keyboard = new InlineKeyboard();
    dotisConfig.projects.forEach((p, i) => {
      keyboard.text(p.name, `p:${pendingKey}:${p.id}`);
      if (i % 2 === 1) keyboard.row();
    });

    const typeLabel = type === 'bug' ? '🐛 Bug' : type === 'feature' ? '💡 İstek' : '📋 Task';
    await ctx.editMessageText(
      `📝 <b>${escapeHtml(pending.message)}</b>\n🏷️ ${typeLabel}\n\n📁 Proje seçin:`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();

  } else if (data.startsWith('p:')) {
    // Project selected → show assignees
    const [, pendingKey, projectId] = data.split(':');
    const pending = pendingIssues.get(pendingKey!);
    if (!pending) return void await ctx.answerCallbackQuery({ text: '⚠️ Zaman aşımı.' });

    pending.projectId = projectId;
    const project = dotisConfig.projects.find((p) => p.id === projectId)!;
    const typeLabel = pending.commandType === 'bug' ? '🐛 Bug' : pending.commandType === 'feature' ? '💡 İstek' : '📋 Task';

    const keyboard = new InlineKeyboard();
    dotisConfig.teamMembers.forEach((m, i) => {
      keyboard.text(m.name, `a:${pendingKey}:${m.id}`);
      if (i % 2 === 1) keyboard.row();
    });
    keyboard.row().text('Kimseyi Atama', `a:${pendingKey}:none`);

    await ctx.editMessageText(
      `📝 <b>${escapeHtml(pending.message)}</b>\n🏷️ ${typeLabel}\n📁 ${project.name}\n\n👤 Kime atansın?`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();

  } else if (data.startsWith('a:')) {
    // Assignee selected → create issue
    const [, pendingKey, assigneeId] = data.split(':');
    const pending = pendingIssues.get(pendingKey!);
    if (!pending) return void await ctx.answerCallbackQuery({ text: '⚠️ Zaman aşımı.' });

    pending.assigneeId = assigneeId === 'none' ? undefined : assigneeId;
    pendingIssues.delete(pendingKey!);

    await createIssueFromPending(ctx, pending);
    await ctx.answerCallbackQuery();
  }
});

// =====================
// ISSUE CREATION
// =====================

async function createIssueFromPending(ctx: any, pending: PendingIssue & { assigneeId?: string }) {
  const project = dotisConfig.projects.find((p) => p.id === pending.projectId)!;
  const assignee = pending.assigneeId
    ? dotisConfig.teamMembers.find((m) => m.id === pending.assigneeId)
    : undefined;

  let titlePrefix = '[Task]';
  if (pending.commandType === 'bug') titlePrefix = '[Hata]';
  else if (pending.commandType === 'feature') titlePrefix = '[Özellik]';

  const typeLabel = pending.commandType === 'bug' ? '🐛 Bug' : pending.commandType === 'feature' ? '💡 İstek' : '📋 Task';

  const extra: Record<string, string> = { projectId: project.id, projectName: project.name };
  if (assignee) {
    extra.assigneeGithubUsername = assignee.githubUsername;
    extra.assigneeName = assignee.name;
  }
  await repository.updateStatus(pending.dbId, 'processing', extra as any);

  try {
    const issue = await createIssue(
      { title: `${titlePrefix} ${pending.message}`, body: pending.message, priority: 'medium', labels: [] },
      project,
      assignee?.githubUsername
    );

    await repository.markCompleted(pending.dbId, issue.number, issue.url);

    let reply = `✅ <b>Issue #${issue.number}</b>\n\n`;
    reply += `🏷️ ${typeLabel}\n`;
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

bot.catch((err) => {
  console.error('grammy hatası:', err);
});
