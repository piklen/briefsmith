#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import type { CliContext } from "../core/types.js";
import { createCliContext } from "./support.js";
import { runCompileCommand } from "./commands/compile.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runAdaptersCommand } from "./commands/adapters.js";
import { runFavoritesCommand } from "./commands/favorites.js";
import { runFindCommand } from "./commands/find.js";
import { runImportCommand } from "./commands/import.js";
import { runPolicyCommand } from "./commands/policy.js";
import { runProfileRefreshCommand, runProfileShowCommand } from "./commands/profile.js";
import { runReindexCommand } from "./commands/reindex.js";
import { runShowCommand } from "./commands/show.js";
import { runStarCommand } from "./commands/star.js";
import { runTagsCommand } from "./commands/tags.js";

const helpLines = [
  "prompt import",
  "prompt reindex",
  "prompt find <query>",
  "prompt show <id>",
  "prompt star <id>",
  "prompt unstar <id>",
  "prompt favorites list",
  "prompt tags add <id> <tag>",
  "prompt tags remove <id> <tag>",
  "prompt tags list <id>",
  'prompt compile "<raw input>" [--framework plain|gsd|superpowers|gstack]',
  "prompt profile show",
  "prompt profile refresh",
  "prompt start",
  "prompt stop",
  "prompt doctor"
  ,"prompt adapters list"
  ,"prompt adapters install <claude|codex> [--scope project|global]"
  ,"prompt adapters doctor [claude|codex] [--scope project|global]"
];

export async function runCli(args: string[], partialContext?: Partial<CliContext>): Promise<number> {
  const context = createCliContext(partialContext);
  const [command, ...rest] = args;

  if (!command) {
    for (const line of helpLines) {
      context.stdout(line);
    }
    return 0;
  }

  switch (command) {
    case "import":
      return runImportCommand(context);
    case "reindex":
      return runReindexCommand(context);
    case "find":
      return runFindCommand(rest.join(" "), context);
    case "show":
      if (!rest[0]) {
        context.stderr("usage: prompt show <id>");
        return 1;
      }
      return runShowCommand(rest[0], context);
    case "star":
      if (!rest[0]) {
        context.stderr("usage: prompt star <id>");
        return 1;
      }
      return runStarCommand(rest[0], true, context);
    case "unstar":
      if (!rest[0]) {
        context.stderr("usage: prompt unstar <id>");
        return 1;
      }
      return runStarCommand(rest[0], false, context);
    case "favorites":
      return runFavoritesCommand(rest, context);
    case "tags":
      return runTagsCommand(rest, context);
    case "compile": {
      const frameworkFlagIndex = rest.indexOf("--framework");
      const framework = frameworkFlagIndex >= 0 ? rest[frameworkFlagIndex + 1] ?? "plain" : "plain";
      const inputParts = frameworkFlagIndex >= 0 ? rest.slice(0, frameworkFlagIndex) : rest;
      if (inputParts.length === 0) {
        context.stderr('usage: prompt compile "<raw input>"');
        return 1;
      }
      return runCompileCommand(inputParts.join(" "), context, framework as "plain" | "gsd" | "superpowers" | "gstack");
    }
    case "profile":
      if (rest[0] === "show") {
        return runProfileShowCommand(context);
      }
      if (rest[0] === "refresh") {
        return runProfileRefreshCommand(context);
      }
      context.stderr("usage: prompt profile <show|refresh>");
      return 1;
    case "start":
    case "stop":
      return runPolicyCommand(command, context);
    case "doctor":
      return runDoctorCommand(context);
    case "adapters":
      return runAdaptersCommand(rest, context);
    default:
      context.stderr(`Unknown command: ${command}`);
      return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
