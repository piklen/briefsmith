import type { PromptEntry } from "../core/types.js";
import { PromptRepository } from "../storage/prompt-repository.js";

export function retrievePromptSnippets(repository: PromptRepository, query: string, limit = 3): string[] {
  return retrievePromptEntries(repository, query, limit)
    .map((row) => row.promptText)
    .filter((text, index, array) => array.indexOf(text) === index)
    .slice(0, limit);
}

export function retrievePromptEntries(repository: PromptRepository, query: string, limit = 3): PromptEntry[] {
  const results: PromptEntry[] = [];
  const seenIds = new Set<string>();

  for (const candidate of buildQueryCandidates(query)) {
    for (const row of repository.search(candidate, limit)) {
      if (seenIds.has(row.id)) {
        continue;
      }

      seenIds.add(row.id);
      results.push(row);

      if (results.length >= limit) {
        return results;
      }
    }
  }

  return results;
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
