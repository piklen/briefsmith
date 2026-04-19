export type ToolName = "claude" | "codex" | "opencode" | "gemini";

export type SlotName =
  | "target"
  | "problem_signal"
  | "success_criteria"
  | "constraints"
  | "verification"
  | "output_format";

export type SlotResolutionSource = "input" | "history" | "heuristic" | "default" | "session";

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

export interface RetrievedPromptSnippet {
  id?: string;
  text: string;
}

export interface CompileDecision {
  kind: "questions" | "compiled";
  text: string;
  missing: SlotName[];
  initialMissing: SlotName[];
  resolvedSlots: Partial<Record<SlotName, string>>;
  resolvedSlotSources: Partial<Record<SlotName, SlotResolutionSource>>;
  resolvedSlotHistoryIds: Partial<Record<SlotName, string>>;
  resolvedSlotConfidence: Partial<Record<SlotName, number>>;
  usedHistoryIds: string[];
  followUpQuestions: string[];
}

export interface CompileSessionRecord {
  id: string;
  projectPath: string;
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
