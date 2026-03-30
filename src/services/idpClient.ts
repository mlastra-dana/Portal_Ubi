import { validateDocumentWithLambda } from './documentValidatorClient';
import type { UploadedDocumentResult } from '../types/recaudos';

type IdpExtractedIdentity = {
  nombres: string | null;
  apellidos: string | null;
  cedula: string | null;
};

const IDP_URL = (import.meta.env.VITE_IDP_LAMBDA_URL ?? '').trim();

const cleanNamePart = (value: string): string =>
  value
    .replace(/\s+/g, ' ')
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ\s]/g, ' ')
    .replace(/\b(DIRECTOR|TITULAR|FIRMA|AUTORIZADA|NA|CASADA|CASADO|SOLTERA|SOLTERO|VIUDA|VIUDO|DIVORCIADA|DIVORCIADO|EDO|CIVIL|UNION|LIBRE)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeId = (value: string): string | null => {
  const compact = value
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/[OQ]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
  if (/^[VE]-?\d{6,10}$/.test(compact)) return compact.replace(/-/g, '');
  if (/^\d{6,10}$/.test(compact)) return `V${compact}`;
  return null;
};

export const idpEnabled = (): boolean => Boolean(IDP_URL);

export async function extractIdentityWithIdp(result: UploadedDocumentResult): Promise<IdpExtractedIdentity | null> {
  if (!IDP_URL) return null;
  if (!result?.file) return null;

  try {
    const validated = await validateDocumentWithLambda(result.file, 'CEDULA');

    const nombres = cleanNamePart(validated.fields.nombres || '');
    const apellidos = cleanNamePart(validated.fields.apellidos || '');
    const cedula = normalizeId(validated.fields.numeroIdentificacion || '');

    return {
      nombres: nombres || null,
      apellidos: apellidos || null,
      cedula
    };
  } catch {
    return null;
  }
}
