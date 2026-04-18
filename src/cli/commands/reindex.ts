import type { CliContext } from "../../core/types.js";
import { runImportCommand } from "./import.js";

export async function runReindexCommand(context: CliContext): Promise<number> {
  return runImportCommand(context);
}
