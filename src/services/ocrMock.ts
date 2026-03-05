import { evaluateExpiryStatus } from '../utils/dates';
import { sleep } from '../utils/sleep';
import type { DocType, OcrResult } from '../types/onboarding';

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const hashString = (input: string): number => {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return Math.abs(hash >>> 0);
};

const hashArrayBuffer = (buffer: ArrayBuffer): number => {
  const bytes = new Uint8Array(buffer);
  let hash = 5381;
  for (let i = 0; i < bytes.length; i += 1) {
    hash = (hash * 33) ^ bytes[i];
  }
  return Math.abs(hash >>> 0);
};

const toTitleCase = (value: string): string =>
  value
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const inferDetectedType = (fileName: string): DocType | 'desconocido' => {
  const lower = fileName.toLowerCase();
  if (/(^|[^a-z])(rif|j-|g-|r-)/.test(lower)) return 'rif';
  if (/(^|[^a-z])(cedula|c[eé]dula|dni|v-|e-)/.test(lower)) return 'cedula';
  return 'desconocido';
};

const extractName = (fileName: string, fallbackSeed: number): string => {
  const base = fileName
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b(cedula|c[eé]dula|rif|doc|documento|scan|img|foto|anverso|reverso)\b/gi, ' ')
    .replace(/[0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (base.length >= 4) return toTitleCase(base);

  const names = ['Maria Fernanda Perez', 'Carlos Eduardo Ramos', 'Ana Gabriela Soto', 'Jose Manuel Silva', 'Luisa Caraballo'];
  return names[fallbackSeed % names.length];
};

const buildDocumentNumber = (docType: DocType, fileName: string, seed: number): string => {
  const cedulaMatch = fileName.match(/\b([VE])[-\s]?(\d{6,9})\b/i) ?? fileName.match(/\b(\d{6,9})\b/);
  if (docType === 'cedula') {
    if (cedulaMatch) {
      const prefix = cedulaMatch[1] ? cedulaMatch[1].toUpperCase() : 'V';
      const number = cedulaMatch[2] ?? cedulaMatch[1];
      return `${prefix}-${number}`;
    }
    return `V-${String(10_000_000 + (seed % 89_999_999))}`;
  }

  const rifMatch = fileName.match(/\b([JGVEP])[-\s]?(\d{7,9})[-\s]?(\d)\b/i);
  if (rifMatch) return `${rifMatch[1].toUpperCase()}-${rifMatch[2]}-${rifMatch[3]}`;
  const base = String(10_000_000 + (seed % 89_999_999));
  return `J-${base}-${seed % 10}`;
};

const isValidDocumentNumber = (docType: DocType, number: string): boolean => {
  if (docType === 'cedula') return /^[VE]-\d{6,9}$/i.test(number);
  return /^[JGVEP]-\d{7,9}-\d$/i.test(number);
};

const buildExpiryDate = (seed: number): string => {
  const now = new Date();
  const monthOffset = (seed % 30) - 6;
  const date = new Date(now);
  date.setMonth(date.getMonth() + monthOffset);
  const yyyy = date.getFullYear();
  const mm = `${date.getMonth() + 1}`.padStart(2, '0');
  const dd = `${Math.min(28, date.getDate())}`.padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const simulateOcr = async (file: File, docType: DocType): Promise<OcrResult> => {
  await sleep(900 + Math.random() * 700);

  const signatureBuffer = await file.slice(0, 32_768).arrayBuffer();
  const seed = hashString(`${file.name}|${file.size}|${file.lastModified}`) ^ hashArrayBuffer(signatureBuffer);
  const detectedType = inferDetectedType(file.name);
  const extractedNumber = buildDocumentNumber(docType, file.name, seed);
  const formatValid = isValidDocumentNumber(docType, extractedNumber);
  const extractedName = extractName(file.name, seed);
  const expiryDate = buildExpiryDate(seed);
  const expiryStatus = evaluateExpiryStatus(expiryDate);

  let confidence = 94;
  if (detectedType !== 'desconocido' && detectedType !== docType) confidence -= 14;
  if (!formatValid) confidence -= 18;
  if (file.size < 40_000) confidence -= 8;
  if (!/\.(pdf|png|jpe?g)$/i.test(file.name)) confidence -= 10;
  confidence = clamp(confidence + ((seed % 9) - 4), 60, 99);

  const warnings: string[] = [];
  if (detectedType !== 'desconocido' && detectedType !== docType) warnings.push(`El archivo parece ${detectedType.toUpperCase()} y no ${docType.toUpperCase()}.`);
  if (!formatValid) warnings.push('El numero extraido no cumple el formato esperado.');
  if (file.size < 40_000) warnings.push('Documento con baja resolucion o peso reducido.');
  if (expiryStatus === 'VENCIDO') warnings.push('Documento vencido (warning, no bloqueante).');
  if (expiryStatus === 'PROXIMO_A_VENCER') warnings.push('Documento proximo a vencer (warning, no bloqueante).');

  return {
    docType,
    detectedType,
    extracted: {
      fullName: extractedName,
      documentNumber: extractedNumber,
      expiryDate
    },
    confidence,
    expiryStatus,
    formatValid,
    consistency: formatValid && (detectedType === docType || detectedType === 'desconocido') ? 'OK' : 'REVISAR',
    warnings
  };
};
