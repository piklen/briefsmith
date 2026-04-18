import type { CliContext } from "../../core/types.js";
import { writeProjectPolicy } from "../../config/project-policy.js";

export async function stopPromptChecks(cwd: string): Promise<void> {
  await writeProjectPolicy(cwd, { enabled: false, mode: "off" });
}

export async function startPromptChecks(cwd: string): Promise<void> {
  await writeProjectPolicy(cwd, { enabled: true, mode: "suggest" });
}

export async function runPolicyCommand(command: "start" | "stop", context: CliContext): Promise<number> {
  if (command === "start") {
    await startPromptChecks(context.cwd);
    context.stdout("prompt checks enabled for this project");
    return 0;
  }

  await stopPromptChecks(context.cwd);
  context.stdout("prompt checks disabled for this project");
  return 0;
}
