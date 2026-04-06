export type CommandType = 'bug' | 'feature';
export type IssueStatus =
  | 'received'
  | 'processing'
  | 'awaiting_approval'
  | 'completed'
  | 'cancelled'
  | 'failed';

export interface Project {
  id: string;
  name: string;
  owner: string;
  repo: string;
  defaultLabels: string[];
}

export interface TeamMember {
  id: string;
  name: string;
  telegramUsername: string;
  githubUsername: string;
}

export interface DotisConfig {
  projects: Project[];
  teamMembers: TeamMember[];
}

export interface ClassificationResult {
  intent: CommandType;
  confidence: number;
  keywords: string[];
  summary: string;
}

export interface IssueDraft {
  title: string;
  body: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  labels: string[];
}

export interface PipelineContext {
  dbId: string;
  chatId: bigint;
  messageId: number;
  userId: bigint;
  username: string | undefined;
  text: string;
  commandType: CommandType;
  projectId: string;
  assigneeId: string;
  classification: ClassificationResult | null;
  draft: IssueDraft | null;
}

export interface CreatedIssue {
  number: number;
  url: string;
}
