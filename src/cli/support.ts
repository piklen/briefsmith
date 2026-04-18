import { homedir } from "node:os";
import type { CliContext } from "../core/types.js";

export function createCliContext(partial?: Partial<CliContext>): CliContext {
  return {
    cwd: partial?.cwd ?? process.cwd(),
    homeDir: partial?.homeDir ?? homedir(),
    stdout: partial?.stdout ?? ((line) => console.log(line)),
    stderr: partial?.stderr ?? ((line) => console.error(line))
  };
}
