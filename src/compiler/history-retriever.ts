import type { PromptEntry } from "../core/types.js";
import { PromptRepository } from "../storage/prompt-repository.js";

export function retrievePromptSnippets(repository: PromptRepository, query: string, limit = 3): string[] {
  return retrievePromptEntries(repository, query, limit)
    .map((row) => row.promptText)
    .filter((text, index, array) => array.indexOf(text) === index)
    .slice(0, limit);
}

export function retrievePromptEntries(repository: PromptRepository, query: string, limit = 3): PromptEntry[] {
  const results = new Map<string, { entry: PromptEntry; score: number }>();
  const normalizedQuery = normalizeSearchText(query);
  const queryTokens = extractSearchTokens(query);

  for (const candidate of buildQueryCandidates(query)) {
    for (const row of repository.search(candidate, limit)) {
      const score = scorePromptEntry(row.promptText, normalizedQuery, queryTokens, candidate);
      if (score <= 0) {
        continue;
      }

      const existing = results.get(row.id);
      if (!existing || score > existing.score) {
        results.set(row.id, { entry: row, score });
      }
    }
  }

  return [...results.values()]
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.entry.timestamp.localeCompare(left.entry.timestamp);
    })
    .map((item) => item.entry)
    .slice(0, limit);
}

const STOP_WORDS = new Set([
  "please",
  "just",
  "this",
  "that",
  "it",
  "optimize",
  "fix",
  "review",
  "check",
  "build",
  "create",
  "implement",
  "write",
  "draft",
  "优化",
  "修复",
  "检查",
  "审查",
  "构建",
  "实现",
  "写",
  "起草",
  "解释",
  "规划",
  "一下",
  "这个",
  "那个",
  "该",
  "此"
]);

function buildQueryCandidates(query: string): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();
  const trimmed = query.trim();

  pushCandidate(candidates, seen, trimmed);

  const normalized = trimmed
    .replace(/[，。；;,.!?！？]/g, " ")
    .replace(/\b(?:please|just|this|that|it)\b/gi, " ")
    .replace(/(?:一下|这个|那个|该|此)/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  pushCandidate(candidates, seen, normalized);
  pushCandidate(candidates, seen, normalized.replace(/\s+/g, ""));

  const tokens = normalized.match(/[\u4e00-\u9fffA-Za-z0-9_-]{2,}/g) ?? [];
  for (const token of tokens.sort((left, right) => right.length - left.length)) {
    if (STOP_WORDS.has(token.toLowerCase())) {
      continue;
    }
    pushCandidate(candidates, seen, token);
  }

  return candidates;
}

function pushCandidate(target: string[], seen: Set<string>, candidate: string): void {
  const value = candidate.trim();
  if (value.length < 2 || seen.has(value)) {
    return;
  }

  seen.add(value);
  target.push(value);
}

function scorePromptEntry(
  promptText: string,
  normalizedQuery: string,
  queryTokens: string[],
  candidate: string
): number {
  const normalizedPrompt = normalizeSearchText(promptText);
  const promptTokens = extractSearchTokens(promptText);
  let score = 0;

  if (normalizedQuery.length >= 4 && normalizedPrompt.includes(normalizedQuery)) {
    score += 100;
  }

  if (containsChinese(candidate)) {
    if (promptText.includes(candidate)) {
      score += 50 + candidate.length;
    }
  } else if (promptTokens.includes(candidate.toLowerCase())) {
    score += 45 + candidate.length;
  } else if (candidate.length >= 6 && normalizedPrompt.includes(candidate.toLowerCase())) {
    score += 20 + candidate.length;
  }

  const sharedTokens = queryTokens.filter((token) => promptIncludesToken(promptText, promptTokens, token));
  const longestShared = sharedTokens.reduce((max, token) => Math.max(max, token.length), 0);
  if (sharedTokens.length >= 2) {
    score += sharedTokens.length * 20 + longestShared;
  } else if (sharedTokens.length === 1 && (containsChinese(sharedTokens[0]) || longestShared >= 6 || queryTokens.length === 1)) {
    score += 18 + longestShared;
  }

  return score;
}

function promptIncludesToken(promptText: string, promptTokens: string[], token: string): boolean {
  if (containsChinese(token)) {
    return promptText.includes(token);
  }

  return promptTokens.includes(token);
}

function extractSearchTokens(text: string): string[] {
  const normalized = text
    .replace(/[，。；;,.!?！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized.match(/[\u4e00-\u9fffA-Za-z0-9_-]{2,}/g) ?? [];
  return [...new Set(tokens
    .map((token) => token.toLowerCase())
    .filter((token) => !STOP_WORDS.has(token)))];
}

function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[，。；;,.!?！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsChinese(text: string): boolean {
  return /[\u4e00-\u9fff]/.test(text);
}
