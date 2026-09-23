const PROHIBITED =
  /\b(minors?|underage|under[\s-]?age|child|children|kid|kids|pre[\s-]?teens?|lolita|loli|jailbait|pedo|paedo|paedophile|pedophile|young[\s-]?teens?)\b|\b(1[0-7])\s*(yo|y\.o\.|years?\s*old)\b/i;

export function containsProhibitedContent(
  ...parts: Array<string | null | undefined | string[]>
): boolean {
  const text = parts
    .flatMap((part) => (Array.isArray(part) ? part : [part ?? ""]))
    .join(" \n ");
  return PROHIBITED.test(text);
}

export function assertAllowedCopy(
  ...parts: Array<string | null | undefined | string[]>
) {
  if (containsProhibitedContent(...parts)) {
    throw new Error("PROHIBITED_CONTENT");
  }
}
