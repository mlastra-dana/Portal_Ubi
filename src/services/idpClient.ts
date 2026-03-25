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
    .replace(/\b(DIRECTOR|TITULAR|FIRMA|AUTORIZADA|NA)\b/gi, ' ')
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

const toBase64 = async (file: File): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const payload = result.includes(',') ? result.split(',')[1] : result;
      resolve(payload);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo para IDP.'));
    reader.readAsDataURL(file);
  });

const splitFullName = (fullName: string): { nombres: string | null; apellidos: string | null } => {
  const clean = cleanNamePart(fullName);
  if (!clean) return { nombres: null, apellidos: null };
  const parts = clean.split(' ');
  if (parts.length === 1) return { nombres: parts[0], apellidos: null };
  if (parts.length === 2) return { nombres: parts[0], apellidos: parts[1] };
  return {
    nombres: parts.slice(0, Math.ceil(parts.length / 2)).join(' '),
    apellidos: parts.slice(Math.ceil(parts.length / 2)).join(' ')
  };
};

const pickString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export const idpEnabled = (): boolean => Boolean(IDP_URL);

export async function extractIdentityWithIdp(result: UploadedDocumentResult): Promise<IdpExtractedIdentity | null> {
  if (!IDP_URL) return null;
  if (!result?.file) return null;

  const imageBase64 = await toBase64(result.file);
  const mime = result.file.type || 'image/jpeg';

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(IDP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frontImageBase64: imageBase64,
        frontImageMime: mime,
        backImageBase64: imageBase64,
        backImageMime: mime,
        documentTypeHint: 'CEDULA_VE',
        rawText: result.rawText ?? ''
      }),
      signal: controller.signal
    });

    if (!response.ok) return null;
    const payload = await response.json();

    const fields = payload?.fields ?? payload ?? {};
    const nombresRaw = pickString(fields.givenNames || fields.nombres || fields.firstName);
    const apellidosRaw = pickString(fields.surnames || fields.apellidos || fields.lastName);
    const fullNameRaw = pickString(fields.fullName || fields.name);
    const cedulaRaw = pickString(fields.documentNumber || fields.cedula || fields.numeroId || fields.idNumber);

    const fallbackSplit = fullNameRaw ? splitFullName(fullNameRaw) : { nombres: null, apellidos: null };
    const nombres = cleanNamePart(nombresRaw || fallbackSplit.nombres || '');
    const apellidos = cleanNamePart(apellidosRaw || fallbackSplit.apellidos || '');
    const cedula = normalizeId(cedulaRaw);

    return {
      nombres: nombres || null,
      apellidos: apellidos || null,
      cedula
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

