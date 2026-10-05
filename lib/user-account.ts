export const PHONE_COUNTRIES = [
  { code: "MX", dialCode: "+52", labelZh: "墨西哥", labelEs: "Mexico", minDigits: 10, maxDigits: 10 },
  { code: "CN", dialCode: "+86", labelZh: "中国", labelEs: "China", minDigits: 11, maxDigits: 11 },
  { code: "US", dialCode: "+1", labelZh: "美国", labelEs: "Estados Unidos", minDigits: 10, maxDigits: 10 },
  { code: "ES", dialCode: "+34", labelZh: "西班牙", labelEs: "Espana", minDigits: 9, maxDigits: 9 },
  { code: "CL", dialCode: "+56", labelZh: "智利", labelEs: "Chile", minDigits: 9, maxDigits: 9 },
  { code: "AR", dialCode: "+54", labelZh: "阿根廷", labelEs: "Argentina", minDigits: 10, maxDigits: 11 },
  { code: "BR", dialCode: "+55", labelZh: "巴西", labelEs: "Brasil", minDigits: 10, maxDigits: 11 },
] as const;

export type PhoneCountryCode = typeof PHONE_COUNTRIES[number]["code"];

function getPhoneCountry(countryCode?: string) {
  return PHONE_COUNTRIES.find((item) => item.code === countryCode) || PHONE_COUNTRIES[0];
}

function digitsOnly(input: string) {
  return String(input || "").replace(/\D/g, "");
}

function normalizeDigitsForCountry(input: string, countryCode?: string) {
  const country = getPhoneCountry(countryCode);
  const digits = digitsOnly(input);
  const dialDigits = digitsOnly(country.dialCode);

  if (!digits) {
    return { country, localDigits: "" };
  }

  if (input.trim().startsWith("+")) {
    if (digits.startsWith(dialDigits)) {
      return { country, localDigits: digits.slice(dialDigits.length) };
    }
    return { country, localDigits: digits };
  }

  if (digits.startsWith(dialDigits) && digits.length > dialDigits.length + 4) {
    return { country, localDigits: digits.slice(dialDigits.length) };
  }

  return { country, localDigits: digits };
}

export function normalizePhoneCountry(countryCode?: string): PhoneCountryCode {
  return getPhoneCountry(countryCode).code;
}

export function normalizePhone(input: string, countryCode: string = "MX") {
  const { country, localDigits } = normalizeDigitsForCountry(input, countryCode);
  if (!localDigits) return "";
  return `${country.dialCode}${localDigits}`;
}

export function isValidPhone(input: string, countryCode: string = "MX") {
  const { country, localDigits } = normalizeDigitsForCountry(input, countryCode);
  if (!localDigits) return false;
  return localDigits.length >= country.minDigits && localDigits.length <= country.maxDigits;
}

export function isValidMxPhone(input: string) {
  return isValidPhone(input, "MX");
}

export function normalizeLoginPhone(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const digits = digitsOnly(raw);
    return digits ? `+${digits}` : "";
  }

  const mxCandidate = normalizePhone(raw, "MX");
  if (isValidPhone(raw, "MX")) {
    return mxCandidate;
  }

  const digits = digitsOnly(raw);
  if (digits.length >= 6 && digits.length <= 15) {
    return `+${digits}`;
  }

  return "";
}

export function splitPhoneForCountry(phone: string, countryCode?: string) {
  const { localDigits } = normalizeDigitsForCountry(phone, countryCode);
  return localDigits;
}

export function isValidDisplayName(input: string) {
  const value = input.trim();
  if (!value) return false;
  if (value.length < 2 || value.length > 40) return false;
  return /^[\p{L}\p{M}\s.'-]+$/u.test(value);
}

export function isValidCompanyName(input: string) {
  const value = String(input || "").trim();
  if (!value) return true;
  return value.length >= 2 && value.length <= 80;
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
