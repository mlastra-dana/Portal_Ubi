import type { DocKind } from '../types/recaudos';

type LambdaDocumentFields = {
  nombres?: string;
  apellidos?: string;
  numeroIdentificacion?: string;
  fechaVencimiento?: string;
  razonSocial?: string;
  documentType?: string;
  documentNumber?: string;
  givenNames?: string;
  surnames?: string;
  companyName?: string;
  cedula?: string;
  rif?: string;
};

type LambdaFieldStatus = {
  nombres?: 'detected' | 'not_detected' | 'not_applicable';
  apellidos?: 'detected' | 'not_detected' | 'not_applicable';
  numeroIdentificacion?: 'detected' | 'not_detected' | 'not_applicable';
  fechaVencimiento?: 'detected' | 'not_detected' | 'not_applicable';
  razonSocial?: 'detected' | 'not_detected' | 'not_applicable';
};

type LambdaConfidence = {
  documentNumber?: number;
  givenNames?: number;
  surnames?: number;
  companyName?: number;
  ocrAverage?: number;
};

type LambdaFlatResponse = {
  expectedDocumentType?: string;
  documentTypeDetected?: string;
  isValidForSlot?: boolean;
  slotValidationReason?: string;
  fileKindDetected?: string;
  isExtractionPerformed?: boolean;
  fields?: LambdaDocumentFields;
  legacyFields?: LambdaDocumentFields;
  fieldStatus?: LambdaFieldStatus;
  confidence?: LambdaConfidence;
  expiryAlert?: boolean;
  ocrTextPreview?: string;
  warnings?: string[];
  message?: string;
  error?: string;
};

type LambdaWrappedResponse = {
  statusCode?: number;
  headers?: Record<string, string>;
  body?: string | LambdaFlatResponse;
};

export type DocumentValidationResult = {
  expectedDocumentType: string;
  documentTypeDetected: string;
  isValidForSlot: boolean;
  slotValidationReason: string;
  fileKindDetected: string;
  isExtractionPerformed: boolean;
  fields: {
    nombres: string;
    apellidos: string;
    numeroIdentificacion: string;
    fechaVencimiento: string;
    razonSocial: string;
  };
  fieldStatus: Required<LambdaFieldStatus>;
  confidence: Required<Pick<LambdaConfidence, 'documentNumber' | 'givenNames' | 'surnames' | 'companyName' | 'ocrAverage'>>;
  expiryAlert: boolean;
  ocrTextPreview: string;
  warnings: string[];
};

const LAMBDA_URL = (import.meta.env.VITE_IDP_LAMBDA_URL ?? '').trim();

const mapExpectedType = (docKind: DocKind): string => {
  if (docKind === 'RIF') return 'RIF';
  if (docKind === 'ACTA' || docKind === 'REGISTRO' || docKind === 'ACTA_REGISTRO') return 'ACTA_CONSTITUTIVA';
  return 'CEDULA';
};

const toBase64FromArrayBuffer = async (file: File): Promise<string> => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
};

const toBase64FromFileReader = async (file: File): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const payload = result.includes(',') ? result.split(',')[1] : result;
      resolve(payload);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo para validación.'));
    reader.readAsDataURL(file);
  });

const toBase64 = async (file: File): Promise<string> => {
  try {
    // Safari iOS es más estable leyendo binario directo que DataURL en archivos grandes.
    return await toBase64FromArrayBuffer(file);
  } catch {
    return await toBase64FromFileReader(file);
  }
};

const unwrapLambdaPayload = (payload: unknown): LambdaFlatResponse => {
  if (!payload || typeof payload !== 'object') return {};

  const maybeWrapped = payload as LambdaWrappedResponse;
  if (maybeWrapped.body !== undefined) {
    if (typeof maybeWrapped.body === 'string') {
      try {
        const parsed = JSON.parse(maybeWrapped.body) as LambdaFlatResponse;
        return parsed;
      } catch {
        return {};
      }
    }
    if (maybeWrapped.body && typeof maybeWrapped.body === 'object') {
      return maybeWrapped.body as LambdaFlatResponse;
    }
  }

  return payload as LambdaFlatResponse;
};

const toSafeResult = (payload: LambdaFlatResponse, expectedDocumentType: string): DocumentValidationResult => {
  const fields = payload.fields ?? {};
  const legacy = payload.legacyFields ?? {};
  const resolvedDocType = payload.documentTypeDetected ?? 'DESCONOCIDO';
  const confidence = payload.confidence ?? {};

  const normalizedFields = {
    nombres: (fields.nombres ?? fields.givenNames ?? legacy.nombres ?? legacy.givenNames ?? '').trim(),
    apellidos: (fields.apellidos ?? fields.surnames ?? legacy.apellidos ?? legacy.surnames ?? '').trim(),
    numeroIdentificacion: (
      fields.numeroIdentificacion ??
      fields.cedula ??
      fields.rif ??
      fields.documentNumber ??
      legacy.numeroIdentificacion ??
      legacy.cedula ??
      legacy.rif ??
      legacy.documentNumber ??
      ''
    ).trim(),
    fechaVencimiento: (fields.fechaVencimiento ?? legacy.fechaVencimiento ?? '').trim(),
    razonSocial: (fields.razonSocial ?? fields.companyName ?? legacy.razonSocial ?? legacy.companyName ?? '').trim()
  };

  const fieldStatus: Required<LambdaFieldStatus> = {
    nombres: payload.fieldStatus?.nombres ?? (resolvedDocType === 'CEDULA' ? (normalizedFields.nombres ? 'detected' : 'not_detected') : 'not_applicable'),
    apellidos: payload.fieldStatus?.apellidos ?? (resolvedDocType === 'CEDULA' ? (normalizedFields.apellidos ? 'detected' : 'not_detected') : 'not_applicable'),
    numeroIdentificacion: payload.fieldStatus?.numeroIdentificacion ?? (
      resolvedDocType === 'CEDULA' || resolvedDocType === 'RIF'
        ? (normalizedFields.numeroIdentificacion ? 'detected' : 'not_detected')
        : 'not_applicable'
    ),
    fechaVencimiento: payload.fieldStatus?.fechaVencimiento ?? (
      resolvedDocType === 'CEDULA' || resolvedDocType === 'RIF'
        ? (normalizedFields.fechaVencimiento ? 'detected' : 'not_detected')
        : 'not_applicable'
    ),
    razonSocial: payload.fieldStatus?.razonSocial ?? (resolvedDocType === 'RIF' ? (normalizedFields.razonSocial ? 'detected' : 'not_detected') : 'not_applicable')
  };

  return {
    expectedDocumentType: payload.expectedDocumentType ?? expectedDocumentType,
    documentTypeDetected: resolvedDocType,
    isValidForSlot: Boolean(payload.isValidForSlot),
    slotValidationReason: payload.slotValidationReason ?? payload.message ?? 'Validación procesada.',
    fileKindDetected: payload.fileKindDetected ?? 'desconocido',
    isExtractionPerformed: Boolean(payload.isExtractionPerformed),
    fields: normalizedFields,
    fieldStatus,
    confidence: {
      documentNumber: confidence.documentNumber ?? 0.25,
      givenNames: confidence.givenNames ?? 0.25,
      surnames: confidence.surnames ?? 0.25,
      companyName: confidence.companyName ?? 0.25,
      ocrAverage: confidence.ocrAverage ?? 0.0
    },
    expiryAlert: Boolean(payload.expiryAlert),
    ocrTextPreview: payload.ocrTextPreview ?? '',
    warnings: Array.isArray(payload.warnings) ? payload.warnings : payload.error ? [payload.error] : []
  };
};

export const lambdaValidationEnabled = (): boolean => Boolean(LAMBDA_URL);

const isAbortLikeError = (error: unknown): boolean => {
  if (error instanceof DOMException && error.name === 'AbortError') return true;
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  return message.includes('aborted') || message.includes('aborterror');
};

export async function validateDocumentWithLambda(file: File, docKind: DocKind): Promise<DocumentValidationResult> {
  if (!LAMBDA_URL) {
    throw new Error('No está configurado VITE_IDP_LAMBDA_URL en el frontend.');
  }

  const expectedDocumentType = mapExpectedType(docKind);
  const fileBase64 = await toBase64(file);
  const contentType = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  const isPdf = contentType.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');

  const controller = new AbortController();
  // PDF puede tardar más por Textract asíncrono; imágenes suelen responder más rápido.
  const requestTimeoutMs = isPdf ? 240000 : 90000;
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(LAMBDA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileBase64,
        fileName: file.name,
        contentType,
        expectedDocumentType
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

    const flat = unwrapLambdaPayload(rawPayload);
    if (!response.ok) {
      const message = flat.error || flat.message || `Error HTTP ${response.status}`;
      throw new Error(message);
    }

    return toSafeResult(flat, expectedDocumentType);
  } catch (error) {
    if (isAbortLikeError(error)) {
      throw new Error(
        isPdf
          ? 'La validación del PDF tardó más de lo esperado. Intenta nuevamente; si persiste, reduce el peso del PDF o súbelo como imagen.'
          : 'La validación tardó más de lo esperado. Intenta nuevamente.'
      );
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
