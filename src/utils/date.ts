const DATE_PATTERNS = [
  /^(\d{2})[/-](\d{2})[/-](\d{4})$/,
  /^(\d{4})-(\d{2})-(\d{2})$/
];

const isValidDateParts = (year: number, month: number, day: number): boolean => {
  if (year < 1900 || year > 2200) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

export function parseDateStrict(value: string): Date | null {
  const input = value.trim();
  if (!input) return null;

  const dmy = DATE_PATTERNS[0].exec(input);
  if (dmy) {
    const day = Number(dmy[1]);
    const month = Number(dmy[2]);
    const year = Number(dmy[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  const ymd = DATE_PATTERNS[1].exec(input);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    if (!isValidDateParts(year, month, day)) return null;
    return new Date(Date.UTC(year, month - 1, day));
  }

  return null;
}

export function isExpired(date: Date): boolean {
  const now = new Date();
  const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return date.getTime() < todayUTC;
}
