/* Stage 2 phone normalization — single source of truth for backend.
   UI in src/lib/domain.ts mirrors this; keep the two in sync. */

export function normalizePhone(raw: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length > 10) {
    // +91, 0-prefix, spaces/dashes: keep last 10 for IN mobiles.
    // Non-IN numbers longer than 10 keep full digits to avoid collisions.
    const last10 = digits.slice(-10);
    if (digits.length === 12 && digits.startsWith("91")) return last10;
    if (digits.length === 11 && digits.startsWith("0")) return last10;
    if (digits.length > 10 && digits.length <= 12) return last10;
    return digits;
  }
  return digits;
}

export function formatPhoneIN(normalized: string): string {
  const d = normalizePhone(normalized);
  if (d.length === 10) return `+91 ${d.slice(0, 5)} ${d.slice(5)}`;
  if (!d) return "";
  return `+91 ${d}`;
}

export function isValidPhoneIN(raw: string): boolean {
  return /^[6-9]\d{9}$/.test(normalizePhone(raw));
}
