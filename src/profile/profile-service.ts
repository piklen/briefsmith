import type { PromptEntry, UserProfile } from "../core/types.js";
import { ProfileRepository } from "../storage/profile-repository.js";

const TASK_PATTERNS = [
  { key: "fix", pattern: /\b(fix|bug|broken|修复|报错)\b/i },
  { key: "optimize", pattern: /\b(optimi[sz]e|performance|优化)\b/i },
  { key: "build", pattern: /\b(build|create|实现|构建)\b/i },
  { key: "review", pattern: /\b(review|audit|检查|审查)\b/i },
  { key: "explain", pattern: /\b(explain|why|原因|解释)\b/i },
  { key: "plan", pattern: /\b(plan|设计|方案)\b/i }
];

export class ProfileService {
  constructor(private readonly repository: ProfileRepository) {}

  showGlobalProfile(): UserProfile {
    return this.repository.load("global");
  }

  refreshGlobalProfile(prompts: PromptEntry[]): UserProfile {
    const current = this.repository.load("global");
    const inferredLanguage = inferPreferredLanguage(prompts);
    const taskTypes = inferTaskTypes(prompts);
    const averageLength = prompts.length === 0
      ? 0
      : Math.round(prompts.reduce((sum, prompt) => sum + prompt.promptText.length, 0) / prompts.length);

    const profile: UserProfile = {
      scope: "global",
      confirmed: current.confirmed,
      inferred: {
        ...current.inferred,
        preferred_language: inferredLanguage,
        frequent_task_types: taskTypes,
        average_prompt_length: averageLength
      },
      signals: {
        prompt_count: prompts.length,
        chinese_prompt_ratio: ratioOfChinese(prompts),
        top_task_types: taskTypes
      },
      updatedAt: new Date().toISOString()
    };

    return this.repository.save(profile);
  }
}

function inferPreferredLanguage(prompts: PromptEntry[]): string {
  const chineseRatio = ratioOfChinese(prompts);
  return chineseRatio >= 0.4 ? "zh-CN" : "en";
}

function ratioOfChinese(prompts: PromptEntry[]): number {
  if (prompts.length === 0) {
    return 0;
  }

  const chineseCount = prompts.filter((prompt) => /[\u4e00-\u9fff]/.test(prompt.promptText)).length;
  return Number((chineseCount / prompts.length).toFixed(2));
}

function inferTaskTypes(prompts: PromptEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const prompt of prompts) {
    for (const task of TASK_PATTERNS) {
      if (task.pattern.test(prompt.promptText)) {
        counts.set(task.key, (counts.get(task.key) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([name]) => name);
}
