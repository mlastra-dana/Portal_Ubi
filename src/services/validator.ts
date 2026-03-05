import { apiClient } from './apiClient';
import type { DocumentType, PhotoKind, ValidationResponse } from '../types/onboarding';
import { clamp } from '../utils/format';
import { sleep } from '../utils/sleep';

const extRegex = /\.(pdf|png|jpg|jpeg)$/i;

const scoreToWarnings = (score: number): string[] => {
  if (score >= 85) return [];
  if (score >= 65) return ['Iluminacion mejorable'];
  return ['Imagen borrosa', 'Baja calidad de captura'];
};

const withDelay = async <T>(value: T): Promise<T> => {
  await sleep(600 + Math.random() * 800);
  return value;
};

const detectDocumentLabel = (name: string): string[] => {
  const lower = name.toLowerCase();
  const labels: string[] = [];
  if (lower.includes('rif')) labels.push('rif');
  if (lower.includes('cedula') || lower.includes('ci')) labels.push('cedula');
  if (lower.includes('acta') || lower.includes('registro') || lower.includes('mercantil')) labels.push('acta constitutiva');
  if (labels.length === 0) labels.push('documento general');
  return labels;
};

const mockDocument = async (type: DocumentType, file: File): Promise<ValidationResponse> => {
  const extensionOk = extRegex.test(file.name);
  const maxSize = 8 * 1024 * 1024;
  const sizeOk = file.size <= maxSize;
  const labels = detectDocumentLabel(file.name);
  const expectedLabelMap: Record<DocumentType, string> = {
    cedula: 'cedula',
    rif: 'rif',
    acta: 'acta constitutiva'
  };

  const kindMatch = labels.includes(expectedLabelMap[type]);
  const base = 58 + Math.floor(Math.random() * 40);
  const penalty = (extensionOk ? 0 : 30) + (sizeOk ? 0 : 25) + (kindMatch ? 0 : 15);
  const score = clamp(base - penalty, 0, 99);

  const extractedFields: Record<string, string> = {
    name: 'Comercio Demo C.A.',
    idNumber: type === 'cedula' ? 'V-19876543' : 'N/A',
    rif: type === 'rif' ? 'J-41234567-8' : 'N/A',
    fileName: file.name
  };

  const warnings = [...scoreToWarnings(score)];
  if (!extensionOk) warnings.push('Extension invalida. Solo PDF/JPG/PNG.');
  if (!sizeOk) warnings.push('Archivo supera 8MB.');
  if (!kindMatch) warnings.push('El documento no coincide con el tipo esperado.');

  return withDelay({
    ok: score >= 75,
    score,
    labels,
    extractedFields,
    warnings
  });
};

const mockPhoto = async (kind: PhotoKind, blob: Blob): Promise<ValidationResponse> => {
  const labelMap: Record<PhotoKind, string> = {
    fachada: 'fachada de comercio',
    interior: 'interior de comercio',
    inventario: 'inventario en exhibicion'
  };

  const randomizedLabels = [labelMap[kind]];
  if (Math.random() > 0.75) randomizedLabels[0] = 'escena no concluyente';

  const base = 60 + Math.floor(Math.random() * 35);
  const kindMatch = randomizedLabels[0] === labelMap[kind];
  const sizePenalty = blob.size < 40_000 ? 20 : 0;
  const matchPenalty = kindMatch ? 0 : 18;
  const score = clamp(base - sizePenalty - matchPenalty, 10, 99);

  const warnings = [...scoreToWarnings(score)];
  if (!kindMatch) warnings.push('La imagen parece no corresponder al tipo solicitado.');

  return withDelay({
    ok: score >= 78,
    score,
    labels: randomizedLabels,
    extractedFields: {
      cameraCapture: 'en-vivo',
      mimeType: blob.type || 'image/jpeg'
    },
    warnings
  });
};

const mockLiveness = async (payload: { hasSelfie: boolean; hasVideo: boolean; gestureDone: boolean }): Promise<ValidationResponse> => {
  const base = 62 + Math.floor(Math.random() * 33);
  const penalty = (payload.hasSelfie ? 0 : 40) + (payload.gestureDone ? 0 : 20);
  const score = clamp(base - penalty, 0, 99);

  const warnings = [...scoreToWarnings(score)];
  if (!payload.gestureDone) warnings.push('No se completo el gesto guiado.');
  if (!payload.hasVideo) warnings.push('Video corto no disponible; se evaluo solo selfie.');

  return withDelay({
    ok: score >= 75,
    score,
    labels: ['rostro humano', payload.gestureDone ? 'gesto completado' : 'gesto incompleto'],
    extractedFields: {
      faceCount: '1',
      captureMode: payload.hasVideo ? 'selfie+video' : 'solo-selfie'
    },
    warnings
  });
};

export const validationStatusFromResponse = (response: ValidationResponse): 'validado' | 'revisar' | 'rechazado' => {
  if (!response.ok || response.score < 55) return 'rechazado';
  if (response.score < 80 || response.warnings.length > 0) return 'revisar';
  return 'validado';
};

export const validateDocument = async (type: DocumentType, file: File): Promise<ValidationResponse> => {
  if (!apiClient.useMock) {
    try {
      return await apiClient.validateDocument({ type, fileName: file.name, size: file.size, mimeType: file.type });
    } catch {
      return mockDocument(type, file);
    }
  }
  return mockDocument(type, file);
};

export const validatePhoto = async (kind: PhotoKind, blob: Blob): Promise<ValidationResponse> => {
  if (!apiClient.useMock) {
    try {
      return await apiClient.validatePhoto({ kind, size: blob.size, mimeType: blob.type });
    } catch {
      return mockPhoto(kind, blob);
    }
  }
  return mockPhoto(kind, blob);
};

export const validateLiveness = async (payload: {
  hasSelfie: boolean;
  hasVideo: boolean;
  gestureDone: boolean;
}): Promise<ValidationResponse> => {
  if (!apiClient.useMock) {
    try {
      return await apiClient.validateLiveness(payload);
    } catch {
      return mockLiveness(payload);
    }
  }
  return mockLiveness(payload);
};
