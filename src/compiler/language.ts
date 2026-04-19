const CHINESE_PATTERN = /[\u4e00-\u9fff]/;
const LATIN_PATTERN = /[A-Za-z]/;

export function prefersChinese(rawInput: string, inferredDefaults: Record<string, unknown> = {}): boolean {
  if (CHINESE_PATTERN.test(rawInput)) {
    return true;
  }

  if (LATIN_PATTERN.test(rawInput)) {
    return false;
  }

  return inferredDefaults.preferred_language === "zh-CN";
}
