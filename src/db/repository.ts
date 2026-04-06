import { prisma } from './client.js';
import type { IssueStatus, ClassificationResult, IssueDraft } from '../types/index.js';

export interface CreateMessageData {
  telegramMessageId: number;
  chatId: bigint;
  chatTitle: string | null;
  senderUserId: bigint;
  senderUsername: string | null;
  messageText: string;
  commandType: string;
  telegramDate: Date;
}

export async function createMessage(data: CreateMessageData) {
  return prisma.telegramMessage.create({ data });
}

export async function findById(id: string) {
  return prisma.telegramMessage.findUnique({ where: { id } });
}

export async function findByTelegramIds(telegramMessageId: number, chatId: bigint) {
  return prisma.telegramMessage.findUnique({
    where: { telegramMessageId_chatId: { telegramMessageId, chatId } },
  });
}

export async function updateStatus(
  id: string,
  status: IssueStatus,
  extra?: Partial<{
    classifiedIntent: string;
    confidence: number;
    extractedKeywords: string[];
    aiDraftJson: IssueDraft;
    projectId: string;
    projectName: string;
    assigneeGithubUsername: string;
    assigneeName: string;
  }>
) {
  const updateData: Record<string, unknown> = { status };

  if (extra?.classifiedIntent) updateData.classifiedIntent = extra.classifiedIntent;
  if (extra?.confidence !== undefined) updateData.confidence = extra.confidence;
  if (extra?.extractedKeywords) updateData.extractedKeywords = JSON.stringify(extra.extractedKeywords);
  if (extra?.aiDraftJson) updateData.aiDraftJson = JSON.stringify(extra.aiDraftJson);
  if (extra?.projectId) updateData.projectId = extra.projectId;
  if (extra?.projectName) updateData.projectName = extra.projectName;
  if (extra?.assigneeGithubUsername) updateData.assigneeGithubUsername = extra.assigneeGithubUsername;
  if (extra?.assigneeName) updateData.assigneeName = extra.assigneeName;

  return prisma.telegramMessage.update({
    where: { id },
    data: updateData,
  });
}

export async function markFailed(id: string, errorMessage: string) {
  return prisma.telegramMessage.update({
    where: { id },
    data: {
      status: 'failed',
      errorMessage,
      retryCount: { increment: 1 },
    },
  });
}

export async function markCompleted(id: string, issueNumber: number, issueUrl: string) {
  return prisma.telegramMessage.update({
    where: { id },
    data: { status: 'completed', issueNumber, issueUrl },
  });
}

export async function markCancelled(id: string) {
  return prisma.telegramMessage.update({
    where: { id },
    data: { status: 'cancelled' },
  });
}

export async function findAwaitingApprovalOlderThan(ms: number) {
  const threshold = new Date(Date.now() - ms);
  return prisma.telegramMessage.findMany({
    where: {
      status: 'awaiting_approval',
      createdAt: { lt: threshold },
    },
  });
}
