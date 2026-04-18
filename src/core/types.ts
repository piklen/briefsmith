export type ToolName = "claude" | "codex" | "opencode" | "gemini";

export type SlotName =
  | "target"
  | "success_criteria"
  | "constraints"
  | "output_format";

export interface CliContext {
  cwd: string;
  homeDir: string;
  stdout: (line: string) => void;
  stderr: (line: string) => void;
}

export interface PromptEntry {
  id: string;
  tool: ToolName;
  projectPath: string;
  sessionId: string;
  timestamp: string;
  promptText: string;
  sourceFile: string;
  sourceOffset: number;
  fingerprint: string;
  isFavorite: boolean;
  tags: string[];
  importedAt: string;
}

export interface UserProfile {
  scope: string;
  confirmed: Record<string, unknown>;
  inferred: Record<string, unknown>;
  signals: Record<string, unknown>;
  updatedAt: string;
}

export interface MissingSlotResult {
  missing: SlotName[];
  needsFollowUp: boolean;
}

export interface CompilePromptInput {
  rawInput: string;
  inferredDefaults: Record<string, unknown>;
  followUpAnswers: Partial<Record<SlotName, string>>;
  retrievedPromptSnippets: string[];
}

export interface CompileDecision {
  kind: "questions" | "compiled";
  text: string;
  missing: SlotName[];
}

export interface CompileSessionRecord {
  id: string;
  rawInput: string;
  compiledPrompt: string;
  followUpQuestions: string[];
  resolvedSlots: Record<string, string>;
  targetFramework: string;
  targetHost: string;
  usedHistoryIds: string[];
  createdAt: string;
}

export interface DoctorCheck {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export interface ImportScanResult {
  tool: ToolName;
  prompts: PromptEntry[];
  warnings: string[];
  filesScanned: number;
}
