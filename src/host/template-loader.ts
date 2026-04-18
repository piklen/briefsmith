import { readFile } from "node:fs/promises";

export async function readBundledTemplate(relativePath: string, from: string): Promise<string> {
  const candidates = [
    new URL(`../../../${relativePath}`, from),
    new URL(`../../../../${relativePath}`, from),
    new URL(`../../${relativePath}`, from)
  ];

  for (const candidate of candidates) {
    try {
      return await readFile(candidate, "utf8");
    } catch (error) {
      const typedError = error as NodeJS.ErrnoException;
      if (typedError.code !== "ENOENT") {
        throw error;
      }
    }
  }

  throw new Error(`Template not found: ${relativePath}`);
}
