import type { ApplicantInfo, DocumentType } from '../types/onboarding';
import { sleep } from '../utils/sleep';
import { clamp } from '../utils/format';

export type BusinessDataValidationResult = {
  documentDetected: 'RIF' | 'Cedula' | 'No concluyente';
  formatValid: boolean;
  consistencyOk: boolean;
  score: number;
};

export type DocumentAiResult = {
  documentTypeDetected: string;
  ocrExtractedFields: Record<string, string>;
  confidence: number;
  duplicateProbability: number;
  expiryStatus: 'vigente' | 'por vencer' | 'vencido';
};

const randomBetween = (min: number, max: number): number => Math.floor(Math.random() * (max - min + 1)) + min;

const detectDocType = (raw: string): BusinessDataValidationResult['documentDetected'] => {
  const input = raw.trim().toUpperCase();
  const rifRegex = /^[VJEGP]-?\d{7,9}-?\d$/;
  const cedulaRegex = /^(V|E)?-?\d{6,9}$/;
  if (rifRegex.test(input)) return 'RIF';
  if (cedulaRegex.test(input)) return 'Cedula';
  return 'No concluyente';
};

export const validateBusinessData = async (applicant: ApplicantInfo): Promise<BusinessDataValidationResult> => {
  await sleep(900 + Math.random() * 700);
  const detected = detectDocType(applicant.idOrRif);
  const formatValid = detected !== 'No concluyente';
  const consistencyOk = applicant.businessName.trim().length > 2 && applicant.email.includes('@') && applicant.phone.length >= 9;

  let score = 55;
  if (formatValid) score += 25;
  if (consistencyOk) score += 15;
  if (applicant.type === 'juridica' && detected === 'RIF') score += 5;
  if (applicant.type === 'natural' && detected === 'Cedula') score += 5;

  return {
    documentDetected: detected,
    formatValid,
    consistencyOk,
    score: clamp(score + randomBetween(-5, 5), 40, 99)
  };
};

const inferredType = (fileName: string, expected: DocumentType): string => {
  const lower = fileName.toLowerCase();
  if (lower.includes('rif')) return 'RIF';
  if (lower.includes('cedula') || lower.includes('ci')) return 'Cedula';
  if (lower.includes('acta') || lower.includes('mercantil') || lower.includes('registro')) return 'Acta constitutiva';
  if (expected === 'rif') return 'RIF';
  if (expected === 'cedula') return 'Cedula';
  return 'Acta constitutiva';
};

export const simulateDocumentValidation = async (
  expectedType: DocumentType,
  file: File,
  applicantName: string,
  idOrRif: string
): Promise<DocumentAiResult> => {
  await sleep(1200 + Math.random() * 1100);

  const documentTypeDetected = inferredType(file.name, expectedType);
  const confidence = clamp(randomBetween(78, 97) - (file.size > 7 * 1024 * 1024 ? 12 : 0), 50, 99);
  const duplicateProbability = clamp(randomBetween(0, 18) + (Math.random() > 0.9 ? 25 : 0), 0, 99);
  const expiryStatus: DocumentAiResult['expiryStatus'] = Math.random() > 0.9 ? 'por vencer' : 'vigente';

  return {
    documentTypeDetected,
    ocrExtractedFields: {
      name: applicantName || 'N/A',
      idNumber: idOrRif || 'N/A',
      fileName: file.name,
      fileSize: `${Math.round(file.size / 1024)} KB`
    },
    confidence,
    duplicateProbability,
    expiryStatus
  };
};
