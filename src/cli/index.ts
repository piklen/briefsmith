#!/usr/bin/env node

import { realpathSync } from "node:fs";
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

interface HelpItem {
  command: string;
  description: string;
}

interface HelpSection {
  title: string;
  items: HelpItem[];
}

const helpSections: HelpSection[] = [
  {
    title: "Core Preflight",
    items: [
      {
        command: `${CLI_NAME} preflight "<raw input>" [--host cli|claude|codex|opencode] [--json] [--framework plain|gsd|superpowers|gstack]`,
        description: "main entrypoint: ask, compile, or skip before agent execution"
      },
      {
        command: `${CLI_NAME} compile "<raw input>" [--framework plain|gsd|superpowers|gstack]`,
        description: "force-generate a stronger task brief from raw input"
      },
      { command: `${CLI_NAME} compile latest`, description: "show the most recent compile result" },
      { command: `${CLI_NAME} compile history`, description: "list recent compile sessions" },
      { command: `${CLI_NAME} compile show <id>`, description: "show one compile session in detail" }
    ]
  },
  {
    title: "Host Integration",
    items: [
      { command: `${CLI_NAME} adapters list`, description: "list supported host adapters and install scopes" },
      {
        command: `${CLI_NAME} adapters install <claude|codex|opencode|all> [--scope project|global]`,
        description: "install Briefsmith into one or more coding hosts"
      },
      {
        command: `${CLI_NAME} adapters doctor [claude|codex|opencode] [--scope project|global]`,
        description: "verify whether adapter files were installed correctly"
      }
    ]
  },
  {
    title: "Policy Control",
    items: [
      { command: `${CLI_NAME} policy show`, description: "show the current project policy" },
      { command: `${CLI_NAME} policy mode <off|suggest|auto-compile>`, description: "change how this project handles vague requests" },
      {
        command: `${CLI_NAME} policy threshold <cli|claude|codex|opencode> <value>`,
        description: "set the default confidence threshold for one host"
      },
      {
        command: `${CLI_NAME} policy threshold <cli|claude|codex|opencode> <target|success_criteria|constraints|output_format> <value>`,
        description: "set the confidence threshold for one host slot"
      },
      { command: `${CLI_NAME} start`, description: "enable prompt checks for the current project" },
      { command: `${CLI_NAME} stop`, description: "disable prompt checks for the current project" }
    ]
  },
  {
    title: "Supporting Context",
    items: [
      { command: `${CLI_NAME} import`, description: "scan local AI histories so preflight has better signal" },
      { command: `${CLI_NAME} reindex`, description: "refresh imported history after local sessions change" },
      { command: `${CLI_NAME} find <query>`, description: "search stored prompts for reusable context" },
      { command: `${CLI_NAME} show <id>`, description: "show one stored prompt in full detail" },
      { command: `${CLI_NAME} star <id>`, description: "mark a prompt as a favorite" },
      { command: `${CLI_NAME} unstar <id>`, description: "remove a prompt from favorites" },
      { command: `${CLI_NAME} favorites list`, description: "list all favorited prompts" },
      { command: `${CLI_NAME} tags add <id> <tag>`, description: "attach a tag to a stored prompt" },
      { command: `${CLI_NAME} tags remove <id> <tag>`, description: "remove a tag from a stored prompt" },
      { command: `${CLI_NAME} tags list <id>`, description: "list tags attached to a stored prompt" },
      { command: `${CLI_NAME} profile show`, description: "show the current inferred user profile" },
      { command: `${CLI_NAME} profile refresh`, description: "rebuild inferred preferences used by preflight" }
    ]
  },
  {
    title: "Diagnostics",
    items: [
      { command: `${CLI_NAME} doctor`, description: "check runtime health, data files, and source paths" }
    ]
  }
];

function printHelp(context: CliContext): number {
  const commandWidth = Math.max(...helpSections.flatMap((section) => section.items.map((item) => item.command.length)));
  const tipWidth = commandWidth + 2;
  const preflightExample = `${CLI_NAME} preflight "optimize this import flow" --host codex --json`;

  context.stdout("Briefsmith CLI");
  context.stdout("Preflight human requests before your coding agent guesses what they mean.");
  context.stdout("Main flow: ask, compile, or skip.");
  context.stdout("");

  for (const section of helpSections) {
    context.stdout(section.title);
    for (const item of section.items) {
      context.stdout(`  ${item.command.padEnd(commandWidth)}  # ${item.description}`);
    }
    context.stdout("");
  }

  context.stdout("Tips");
  context.stdout(
    `  ${preflightExample.padEnd(tipWidth)}  # main entrypoint for host-side decisioning`
  );
  context.stdout(`  ${`${CLI_NAME} import`.padEnd(tipWidth)}  # optional: load local history so preflight has more signal`);
  context.stdout(`  ${CLI_NAME} help`.padEnd(tipWidth) + "  # show this help output");
  context.stdout(`  ${CLI_NAME} --help`.padEnd(tipWidth) + "  # same as above");
  return 0;
}

export function isCliEntrypoint(argv1: string | undefined, importMetaUrl: string): boolean {
  if (!argv1) {
    return false;
  }

  const entryPath = fileURLToPath(importMetaUrl);
  try {
    return realpathSync(argv1) === realpathSync(entryPath);
  } catch {
    return argv1 === entryPath;
  }
}

export async function runCli(args: string[], partialContext?: Partial<CliContext>): Promise<number> {
  const context = createCliContext(partialContext);
  const [command, ...rest] = args;

  if (!command || command === "--help" || command === "-h" || command === "help") {
    return printHelp(context);
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
      context.stderr(`Run \`${CLI_NAME} --help\` to see available commands.`);
      return 1;
  }
}

if (isCliEntrypoint(process.argv[1], import.meta.url)) {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}
