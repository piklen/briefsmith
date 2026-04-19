#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import type { CliContext } from "../core/types.js";
import { CLI_NAME } from "./command-name.js";
import { createCliContext } from "./support.js";
import { runCompileCommand, runCompileSessionsCommand } from "./commands/compile.js";
import { runDoctorCommand } from "./commands/doctor.js";
import { runAdaptersCommand } from "./commands/adapters.js";
import { runFavoritesCommand } from "./commands/favorites.js";
import { runFindCommand } from "./commands/find.js";
import { runImportCommand } from "./commands/import.js";
import { runPolicyCommand, runPolicySubcommand } from "./commands/policy.js";
import { runPreflightCommand } from "./commands/preflight.js";
import { runProfileRefreshCommand, runProfileShowCommand } from "./commands/profile.js";
import { runReindexCommand } from "./commands/reindex.js";
import { runShowCommand } from "./commands/show.js";
import { runStarCommand } from "./commands/star.js";
import { runTagsCommand } from "./commands/tags.js";

const helpLines = [
  `${CLI_NAME} import`,
  `${CLI_NAME} reindex`,
  `${CLI_NAME} find <query>`,
  `${CLI_NAME} show <id>`,
  `${CLI_NAME} star <id>`,
  `${CLI_NAME} unstar <id>`,
  `${CLI_NAME} favorites list`,
  `${CLI_NAME} tags add <id> <tag>`,
  `${CLI_NAME} tags remove <id> <tag>`,
  `${CLI_NAME} tags list <id>`,
  `${CLI_NAME} compile "<raw input>" [--framework plain|gsd|superpowers|gstack]`,
  `${CLI_NAME} preflight "<raw input>" [--host cli|claude|codex|opencode] [--json] [--framework plain|gsd|superpowers|gstack]`,
  `${CLI_NAME} compile latest`,
  `${CLI_NAME} compile history`,
  `${CLI_NAME} compile show <id>`,
  `${CLI_NAME} profile show`,
  `${CLI_NAME} profile refresh`,
  `${CLI_NAME} policy show`,
  `${CLI_NAME} policy mode <off|suggest|auto-compile>`,
  `${CLI_NAME} policy threshold <cli|claude|codex|opencode> <value>`,
  `${CLI_NAME} policy threshold <cli|claude|codex|opencode> <target|success_criteria|constraints|output_format> <value>`,
  `${CLI_NAME} start`,
  `${CLI_NAME} stop`,
  `${CLI_NAME} doctor`,
  `${CLI_NAME} adapters list`,
  `${CLI_NAME} adapters install <claude|codex|opencode|all> [--scope project|global]`,
  `${CLI_NAME} adapters doctor [claude|codex] [--scope project|global]`
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
        context.stderr(`usage: ${CLI_NAME} show <id>`);
        return 1;
      }
      return runShowCommand(rest[0], context);
    case "star":
      if (!rest[0]) {
        context.stderr(`usage: ${CLI_NAME} star <id>`);
        return 1;
      }
      return runStarCommand(rest[0], true, context);
    case "unstar":
      if (!rest[0]) {
        context.stderr(`usage: ${CLI_NAME} unstar <id>`);
        return 1;
      }
      return runStarCommand(rest[0], false, context);
    case "favorites":
      return runFavoritesCommand(rest, context);
    case "tags":
      return runTagsCommand(rest, context);
    case "compile": {
      if (rest.length === 1 && (rest[0] === "latest" || rest[0] === "history")) {
        return runCompileSessionsCommand(rest, context);
      }
      if (rest[0] === "show" && rest[1]) {
        return runCompileSessionsCommand(rest, context);
      }
      const frameworkFlagIndex = rest.indexOf("--framework");
      const framework = frameworkFlagIndex >= 0 ? rest[frameworkFlagIndex + 1] ?? "plain" : "plain";
      const inputParts = frameworkFlagIndex >= 0 ? rest.slice(0, frameworkFlagIndex) : rest;
      if (inputParts.length === 0) {
        context.stderr(`usage: ${CLI_NAME} compile "<raw input>"`);
        return 1;
      }
      return runCompileCommand(inputParts.join(" "), context, framework as "plain" | "gsd" | "superpowers" | "gstack");
    }
    case "preflight":
      return runPreflightCommand(rest, context);
    case "profile":
      if (rest[0] === "show") {
        return runProfileShowCommand(context);
      }
      if (rest[0] === "refresh") {
        return runProfileRefreshCommand(context);
      }
      context.stderr(`usage: ${CLI_NAME} profile <show|refresh>`);
      return 1;
    case "policy":
      return runPolicySubcommand(rest, context);
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
