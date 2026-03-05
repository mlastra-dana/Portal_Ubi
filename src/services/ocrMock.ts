import { sleep } from '../utils/sleep';
import { evaluateExpiryStatus } from '../utils/dates';
import type { DocType, OcrResult } from '../types/onboarding';

const randomBetween = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const randomFutureDate = (): string => {
  const now = new Date();
  const months = randomBetween(-4, 24);
  const result = new Date(now);
  result.setMonth(result.getMonth() + months);
  const yyyy = result.getFullYear();
  const mm = `${result.getMonth() + 1}`.padStart(2, '0');
  const dd = `${result.getDate()}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const buildExtracted = (docType: DocType, fileName: string) => {
  const baseName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]/g, ' ');
  if (docType === 'cedula') {
    return {
      fullName: 'Maria Fernanda Perez',
      documentNumber: `V-${randomBetween(14000000, 28000000)}`,
      expiryDate: randomFutureDate(),
      sourceHint: baseName
    };
  }

  return {
    fullName: 'Comercio Natural Demo',
    documentNumber: `J-${randomBetween(10000000, 99000000)}-${randomBetween(0, 9)}`,
    expiryDate: randomFutureDate(),
    sourceHint: baseName
  };
};

export const simulateOcr = async (file: File, docType: DocType): Promise<OcrResult> => {
  await sleep(1100 + Math.random() * 900);

  const extracted = buildExtracted(docType, file.name);
  const confidence = randomBetween(82, 98);
  const expiryStatus = evaluateExpiryStatus(extracted.expiryDate);

  return {
    docType,
    extracted: {
      fullName: extracted.fullName,
      documentNumber: extracted.documentNumber,
      expiryDate: extracted.expiryDate
    },
    confidence,
    expiryStatus
  };
};
