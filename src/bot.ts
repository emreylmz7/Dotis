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
  commandType?: CommandType;
  projectId?: string;
  assigneeId?: string;
  message?: string;
  chatId: bigint;
  senderUserId: bigint;
  senderUsername: string | null;
  chatTitle: string | null;
}

const pendingIssues = new Map<string, PendingIssue>();

// Users waiting to type a message: "chatId:userId" → pendingKey
const waitingForMessage = new Map<string, string>();

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
// /yeni or "Yeni Issue" button - Start issue creation flow
// =====================

function startIssueFlow(ctx: any, chatId: bigint) {
  const pendingKey = `${ctx.from?.id}_${Date.now()}`;
  pendingIssues.set(pendingKey, {
    chatId,
    senderUserId: BigInt(ctx.from?.id ?? 0),
    senderUsername: ctx.from?.username ?? null,
    chatTitle: ctx.chat.title ?? null,
  });
  return pendingKey;
}

bot.command('yeni', async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  const pendingKey = startIssueFlow(ctx, chatId);
  const keyboard = new InlineKeyboard()
    .text('📋 Task', `t:${pendingKey}:task`)
    .text('🐛 Bug', `t:${pendingKey}:bug`)
    .text('💡 İstek', `t:${pendingKey}:feature`);

  await ctx.reply('🏷️ Issue türünü seçin:', { reply_markup: keyboard });
});

bot.hears('📝 Yeni Issue', async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  const pendingKey = startIssueFlow(ctx, chatId);
  const keyboard = new InlineKeyboard()
    .text('📋 Task', `t:${pendingKey}:task`)
    .text('🐛 Bug', `t:${pendingKey}:bug`)
    .text('💡 İstek', `t:${pendingKey}:feature`);

  await ctx.reply('🏷️ Issue türünü seçin:', { reply_markup: keyboard });
});

// =====================
// CALLBACK HANDLERS
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

    const typeLabel = getTypeLabel(type!);
    await ctx.editMessageText(`🏷️ ${typeLabel}\n\n📁 Proje seçin:`, { parse_mode: 'HTML', reply_markup: keyboard });
    await ctx.answerCallbackQuery();

  } else if (data.startsWith('p:')) {
    // Project selected → show assignees
    const [, pendingKey, projectId] = data.split(':');
    const pending = pendingIssues.get(pendingKey!);
    if (!pending) return void await ctx.answerCallbackQuery({ text: '⚠️ Zaman aşımı.' });

    pending.projectId = projectId!;
    const project = dotisConfig.projects.find((p) => p.id === projectId)!;
    const typeLabel = getTypeLabel(pending.commandType === 'feature' ? 'feature' : pending.commandType === 'bug' ? 'bug' : 'task');

    const keyboard = new InlineKeyboard();
    dotisConfig.teamMembers.forEach((m, i) => {
      keyboard.text(m.name, `a:${pendingKey}:${m.id}`);
      if (i % 2 === 1) keyboard.row();
    });
    keyboard.row().text('Kimseyi Atama', `a:${pendingKey}:none`);

    await ctx.editMessageText(
      `🏷️ ${typeLabel}\n📁 ${project.name}\n\n👤 Kime atansın?`,
      { parse_mode: 'HTML', reply_markup: keyboard }
    );
    await ctx.answerCallbackQuery();

  } else if (data.startsWith('a:')) {
    // Assignee selected → ask for message
    const [, pendingKey, assigneeId] = data.split(':');
    const pending = pendingIssues.get(pendingKey!);
    if (!pending) return void await ctx.answerCallbackQuery({ text: '⚠️ Zaman aşımı.' });

    pending.assigneeId = assigneeId === 'none' ? '' : assigneeId!;

    const project = dotisConfig.projects.find((p) => p.id === pending.projectId)!;
    const assignee = pending.assigneeId ? dotisConfig.teamMembers.find((m) => m.id === pending.assigneeId) : undefined;

    const typeLabel = getTypeLabel(pending.commandType === 'feature' ? 'feature' : pending.commandType === 'bug' ? 'bug' : 'task');

    let summary = `🏷️ ${typeLabel}\n📁 ${project.name}\n`;
    if (assignee) summary += `👤 ${assignee.name}\n`;
    summary += `\n✏️ Şimdi issue mesajınızı yazın:`;

    await ctx.editMessageText(summary, { parse_mode: 'HTML' });
    await ctx.answerCallbackQuery();

    // Wait for user's next text message
    const userKey = `${pending.chatId}:${pending.senderUserId}`;
    waitingForMessage.set(userKey, pendingKey!);
  }
});

// =====================
// Catch typed message
// =====================

bot.on('message:text', async (ctx) => {
  const chatId = BigInt(ctx.chat.id);
  if (!isAllowedChat(chatId)) return;

  const userKey = `${chatId}:${ctx.from.id}`;
  const pendingKey = waitingForMessage.get(userKey);
  if (!pendingKey) return;

  const pending = pendingIssues.get(pendingKey);
  if (!pending) {
    waitingForMessage.delete(userKey);
    return;
  }

  waitingForMessage.delete(userKey);
  pendingIssues.delete(pendingKey);

  const message = ctx.message.text.trim();
  if (!message) return;

  pending.message = message;

  // Save to DB and create issue
  const dbRecord = await repository.createMessage({
    telegramMessageId: ctx.message.message_id,
    chatId,
    chatTitle: ctx.chat.title ?? null,
    senderUserId: BigInt(ctx.from.id),
    senderUsername: ctx.from.username ?? null,
    messageText: message,
    commandType: pending.commandType ?? 'bug',
    telegramDate: new Date(ctx.message.date * 1000),
  });

  const project = dotisConfig.projects.find((p) => p.id === pending.projectId)!;
  const assignee = pending.assigneeId ? dotisConfig.teamMembers.find((m) => m.id === pending.assigneeId) : undefined;

  let titlePrefix = '[Task]';
  if (pending.commandType === 'bug') titlePrefix = '[Hata]';
  else if (pending.commandType === 'feature') titlePrefix = '[Özellik]';

  const typeLabel = getTypeLabel(pending.commandType === 'feature' ? 'feature' : pending.commandType === 'bug' ? 'bug' : 'task');

  const extra: Record<string, string> = { projectId: project.id, projectName: project.name };
  if (assignee) {
    extra.assigneeGithubUsername = assignee.githubUsername;
    extra.assigneeName = assignee.name;
  }
  await repository.updateStatus(dbRecord.id, 'processing', extra as any);

  try {
    const issue = await createIssue(
      { title: `${titlePrefix} ${message}`, body: message, priority: 'medium', labels: [] },
      project,
      assignee?.githubUsername
    );

    await repository.markCompleted(dbRecord.id, issue.number, issue.url);

    let reply = `✅ <b>Issue #${issue.number}</b>\n\n`;
    reply += `🏷️ ${typeLabel}\n`;
    reply += `📁 ${project.name}\n`;
    if (assignee) reply += `👤 ${assignee.name}\n`;
    reply += `📝 ${escapeHtml(message)}\n`;
    reply += `\n<a href="${issue.url}">GitHub'da Görüntüle</a>`;

    await ctx.reply(reply, { parse_mode: 'HTML', reply_to_message_id: ctx.message.message_id });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    await repository.markFailed(dbRecord.id, errorMsg);
    await ctx.reply(`❌ Issue oluşturulamadı: ${errorMsg}`, { reply_to_message_id: ctx.message.message_id });
  }
});

// =====================
// UTILS
// =====================

function getTypeLabel(type: string): string {
  if (type === 'bug') return '🐛 Bug';
  if (type === 'feature') return '💡 İstek';
  return '📋 Task';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

bot.catch((err) => {
  console.error('grammy hatası:', err);
});
