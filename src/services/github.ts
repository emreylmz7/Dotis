import { Octokit } from '@octokit/rest';
import { config } from '../config.js';
import type { IssueDraft, CreatedIssue, Project } from '../types/index.js';

const octokit = new Octokit({ auth: config.github.token });

export async function createIssue(
  draft: IssueDraft,
  project: Project,
  assigneeGithubUsername?: string
): Promise<CreatedIssue> {
  const response = await octokit.rest.issues.create({
    owner: project.owner,
    repo: project.repo,
    title: draft.title,
    body: draft.body,
    labels: [...project.defaultLabels, ...draft.labels],
    assignees: assigneeGithubUsername ? [assigneeGithubUsername] : [],
  });

  return {
    number: response.data.number,
    url: response.data.html_url,
  };
}
