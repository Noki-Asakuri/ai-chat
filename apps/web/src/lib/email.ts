function repeatChar(char: string, count: number): string {
  if (count <= 0) return "";
  return char.repeat(count);
}

function maskMiddle(value: string, visiblePrefixCount: number, visibleSuffixCount: number): string {
  if (value.length === 0) return "";

  const safePrefixCount = Math.max(0, Math.min(visiblePrefixCount, value.length));
  const safeSuffixCount = Math.max(0, Math.min(visibleSuffixCount, value.length - safePrefixCount));

  const maskedCount = value.length - safePrefixCount - safeSuffixCount;
  if (maskedCount <= 0) {
    return repeatChar("*", value.length);
  }

  const prefix = value.slice(0, safePrefixCount);
  const suffix = value.slice(value.length - safeSuffixCount);
  return `${prefix}${repeatChar("*", maskedCount)}${suffix}`;
}

/**
 * Censors an email by masking the local part while keeping the domain visible.
 *
 * Examples:
 * - "john.doe@gmail.com" => "jo******e@gmail.com"
 * - "a@b.com" => "*@b.com" (best effort)
 */
export function censorEmail(email: string): string {
  const trimmed = email.trim();
  if (trimmed.length === 0) return "";

  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0 || atIndex === trimmed.length - 1) {
    return maskMiddle(trimmed, 0, 0);
  }

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);

  const maskedLocal = maskMiddle(local, 2, 1);

  return `${maskedLocal}@${domain}`;
}