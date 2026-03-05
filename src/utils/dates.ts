import type { ExpiryStatus } from '../types/onboarding';

export const parseISODate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

export const evaluateExpiryStatus = (value: string): ExpiryStatus => {
  const expiry = parseISODate(value);
  const now = new Date();
  const sixMonths = new Date(now);
  sixMonths.setMonth(sixMonths.getMonth() + 6);

  if (expiry < now) return 'VENCIDO';
  if (expiry <= sixMonths) return 'PROXIMO_A_VENCER';
  return 'OK';
};

export const humanizeExpiry = (status: ExpiryStatus): string => {
  if (status === 'OK') return 'OK';
  if (status === 'VENCIDO') return 'Vencido';
  return 'Proximo a vencer';
};
