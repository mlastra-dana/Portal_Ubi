import { validateDocumentWithLambda } from './documentValidatorClient';
import type { UploadedDocumentResult } from '../types/recaudos';

type IdpExtractedIdentity = {
  nombres: string | null;
  apellidos: string | null;
  cedula: string | null;
};

const IDP_URL = (import.meta.env.VITE_IDP_LAMBDA_URL ?? '').trim();

const extractNamePartsFromPreview = (preview: string): { nombres: string; apellidos: string } => {
  if (!preview.trim()) return { nombres: '', apellidos: '' };

  const lines = preview
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  let nombres = '';
  let apellidos = '';

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!apellidos && /\bAPELL/i.test(line)) {
      const inline = line.replace(/.*\bAPELL\w*\s*[:\-]?\s*/i, '').trim();
      const next = lines[i + 1]?.trim() ?? '';
      apellidos = inline || next;
    }
    if (!nombres && /\bNOMB/i.test(line)) {
      const inline = line.replace(/.*\bNOMB\w*\s*[:\-]?\s*/i, '').trim();
      const next = lines[i + 1]?.trim() ?? '';
      nombres = inline || next;
    }
    if (nombres && apellidos) break;
  }

  return { nombres, apellidos };
};

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
    const fallbackFromPreview = extractNamePartsFromPreview(validated.ocrTextPreview || '');

    const nombres = cleanNamePart(validated.fields.nombres || validated.fields.givenNames || fallbackFromPreview.nombres || '');
    const apellidos = cleanNamePart(validated.fields.apellidos || validated.fields.surnames || fallbackFromPreview.apellidos || '');
    const cedula = normalizeId(
      validated.fields.numeroIdentificacion ||
      validated.fields.cedula ||
      validated.fields.documentNumber ||
      ''
    );

    return {
      nombres: nombres || null,
      apellidos: apellidos || null,
      cedula
    };
  } catch {
    return null;
  }
}
