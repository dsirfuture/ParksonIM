export function normalizePhone(input: string) {
  const digits = input.replace(/\D/g, "");

  if (digits.length === 10) {
    return `+52${digits}`;
  }

  if (digits.length === 12 && digits.startsWith("52")) {
    return `+${digits}`;
  }

  if (digits.length === 13 && digits.startsWith("521")) {
    return `+${digits}`;
  }

  return "";
}

export function isValidMxPhone(input: string) {
  return normalizePhone(input).length > 0;
}

export function isValidDisplayName(input: string) {
  const value = input.trim();
  if (!value) return false;
  if (value.length < 2 || value.length > 40) return false;
  return /^[\p{L}\p{M}\s.'-]+$/u.test(value);
}

export function isValidEmail(input: string) {
  const value = input.trim();
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function getAvatarFallback(name: string) {
  const value = String(name || "").trim();
  return value ? value[0].toUpperCase() : "A";
}
