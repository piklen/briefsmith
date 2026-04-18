import { PromptRepository } from "../storage/prompt-repository.js";

export function retrievePromptSnippets(repository: PromptRepository, query: string, limit = 3): string[] {
  return repository
    .search(query, limit)
    .map((row) => row.promptText)
    .filter((text, index, array) => array.indexOf(text) === index)
    .slice(0, limit);
}
