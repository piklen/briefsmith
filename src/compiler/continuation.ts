const CONTINUATION_ONLY_PATTERN = /^(?:(?:please\s+)?(?:continue|keep going|go on)(?:\s+(?:optimizing|improving|refining|working(?:\s+on)?|fixing|building))?|(?:继续|接着|继续再)(?:\s*(?:优化|改进|完善|修复|处理|推进|做))?)(?:\s*(?:it|this|that|一下|下|吧))?[\s!,.?，。？]*$/i;

export function isContinuationOnlyRequest(rawInput: string): boolean {
  return CONTINUATION_ONLY_PATTERN.test(rawInput.trim());
}
