import type { BusinessImageAnalysisResult, MismatchReason, RequestedBusinessCategory } from './types';

type LambdaImageValidationResponse = {
  requestedCategory?: RequestedBusinessCategory;
  validationResult?: 'VALIDADA' | 'REVISAR' | 'NO_COINCIDE' | 'NO COINCIDE';
  description?: string;
  categoryProbability?: number;
  aiGeneratedProbability?: number;
  mismatchReason?: MismatchReason;
  warnings?: string[];
  message?: string;
  error?: string;
};

type LambdaWrappedResponse = {
  statusCode?: number;
  body?: string | LambdaImageValidationResponse;
};

const LAMBDA_URL = (import.meta.env.VITE_IDP_LAMBDA_URL ?? '').trim();

const toBase64 = async (fileOrBlob: Blob | File): Promise<string> => {
  const bytes = new Uint8Array(await fileOrBlob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const unwrapLambdaPayload = (payload: unknown): LambdaImageValidationResponse => {
  if (!payload || typeof payload !== 'object') return {};
  const wrapped = payload as LambdaWrappedResponse;
  if (wrapped.body === undefined) return payload as LambdaImageValidationResponse;
  if (typeof wrapped.body === 'string') {
    try {
      return JSON.parse(wrapped.body) as LambdaImageValidationResponse;
    } catch {
      return {};
    }
  }
  return (wrapped.body ?? {}) as LambdaImageValidationResponse;
};

const normalizeValidationResult = (value?: string): BusinessImageAnalysisResult['validationResult'] => {
  if (value === 'VALIDADA') return 'VALIDADA';
  if (value === 'NO_COINCIDE' || value === 'NO COINCIDE') return 'NO COINCIDE';
  return 'REVISAR';
};

const isAbortLikeError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('aborted') || message.includes('aborterror');
};

export const analyzeBusinessImage = async (
  fileOrBlob: Blob | File,
  requestedCategory: RequestedBusinessCategory
): Promise<BusinessImageAnalysisResult> => {
  if (!LAMBDA_URL) {
    throw new Error('No está configurado VITE_IDP_LAMBDA_URL en el frontend.');
  }

  const contentType = fileOrBlob.type || 'image/jpeg';
  const fileName = fileOrBlob instanceof File ? fileOrBlob.name : `business-image-${Date.now()}.jpg`;
  const fileBase64 = await toBase64(fileOrBlob);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);

  try {
    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64,
        fileName,
        contentType,
        requestedCategory
      }),
      signal: controller.signal
    });

    const text = await response.text();
    let rawPayload: unknown = {};
    try {
      rawPayload = JSON.parse(text);
    } catch {
      rawPayload = {};
    }
    const payload = unwrapLambdaPayload(rawPayload);

    if (!response.ok) {
      const message = payload.error || payload.message || `Error HTTP ${response.status}`;
      throw new Error(message);
    }

    const validationResult = normalizeValidationResult(payload.validationResult);
    const categoryProbability = Number.isFinite(payload.categoryProbability) ? Number(payload.categoryProbability) : 0;
    const hasAiProbability = Number.isFinite(payload.aiGeneratedProbability);
    const aiGeneratedProbability = hasAiProbability ? Number(payload.aiGeneratedProbability) : undefined;
    const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
    const mismatchReason = payload.mismatchReason ?? null;

    return {
      description: payload.description ?? '',
      features: undefined,
      detectedCategory: validationResult === 'VALIDADA' ? requestedCategory : 'NO_CLASIFICADA',
      requestedCategory: payload.requestedCategory ?? requestedCategory,
      categoryMatch: validationResult === 'VALIDADA',
      categoryProbability,
      aiGeneratedProbability,
      validationResult,
      mismatchReason,
      warnings
    };
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new Error('La validación de imagen tardó más de lo esperado. Intenta nuevamente.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
