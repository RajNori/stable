/** Display formatting only. Submission still uses normalizeAustralianMobile. */
export function formatAustralianMobileInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  const national = digits.startsWith("61") ? `0${digits.slice(2)}` : digits;
  const clipped = national.slice(0, 10);
  const parts = [
    clipped.slice(0, 4),
    clipped.slice(4, 7),
    clipped.slice(7, 10),
  ].filter((part) => part.length > 0);
  return parts.join(" ");
}
