import type { Handler } from 'aws-lambda';

type LambdaEvent = {
  httpMethod?: string;
  requestContext?: {
    http?: {
      method?: string;
    };
  };
  body?: string | null;
  isBase64Encoded?: boolean;
};

type RequestPayload = {
  rawText?: string;
  documentTypeHint?: string;
  frontImageBase64?: string;
};

type IdpFields = {
  documentType: 'CEDULA' | 'RIF';
  givenNames: string;
  surnames: string;
  documentNumber: string;
  nombres: string;
  apellidos: string;
  cedula: string;
  rif: string;
};

const corsHeaders = {
  'content-type': 'application/json',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'OPTIONS,POST',
  'access-control-allow-headers': 'content-type,authorization'
};

const NOISE_WORDS = new Set([
  'CEDULA',
  'CÉDULA',
  'IDENTIDAD',
  'REPUBLICA',
  'BOLIVARIANA',
  'VENEZUELA',
  'FIRMA',
  'TITULAR',
  'DIRECTOR',
  'NACIONALIDAD',
  'VENEZOLANO',
  'EXPEDICION',
  'VENCIMIENTO',
  'FECHA',
  'NACIMIENTO',
  'CASADA',
  'SOLTERA',
  'CONTRIBUYENTE',
  'SENIAT'
]);

const TRAILING_GARBAGE = new Set(['NA', 'N', 'A', 'EA', 'ER', 'OD', 'DI', 'RR', 'ZN']);
const CONNECTORS = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'DA', 'DAS', 'DO', 'DOS']);

const APELLIDO_LABEL = /(APELL|APELID|PELLID|ELLID|AVEL)/i;
const NOMBRE_LABEL = /(NOMB|NOMBR|NOMER|NOME|N0MB|NOM8|VOVER|VOBER|VOWER)/i;
const CEDULA_RE = /\b([VE])\s*[-.]?\s*(\d(?:[\d.\s-]{5,12}\d))\b/i;
const RIF_RE = /\b([JGVEP])\s*[-.]?\s*(\d(?:[\d.\s-]{7,12}\d))\b/i;

const jsonResponse = (statusCode: number, payload: Record<string, unknown>) => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(payload)
});

const getMethod = (event: LambdaEvent): string =>
  (event.requestContext?.http?.method || event.httpMethod || '').toUpperCase();

const normalizeUpper = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

const cleanPersonText = (value: string): string => {
  let text = value
    .replace(/\b(NA\)|N\)|DIRECTOR|TITULAR|FIRMA|AUTORIZADA)\b.*$/i, ' ')
    .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const tokens = text
    .split(' ')
    .filter(Boolean)
    .filter((token) => !NOISE_WORDS.has(normalizeUpper(token)));

  while (tokens.length > 0) {
    const tail = tokens[tokens.length - 1];
    const upperTail = normalizeUpper(tail);
    if (TRAILING_GARBAGE.has(upperTail)) {
      tokens.pop();
      continue;
    }
    if (tail.length <= 2 && !CONNECTORS.has(upperTail)) {
      tokens.pop();
      continue;
    }
    break;
  }

  while (tokens.length > 0 && CONNECTORS.has(normalizeUpper(tokens[tokens.length - 1]))) {
    tokens.pop();
  }

  text = tokens.join(' ').trim();
  return text;
};

const scorePersonCandidate = (value: string): number => {
  const candidate = cleanPersonText(value);
  if (!candidate) return -1;
  const parts = candidate.split(' ');
  if (parts.length < 2 || parts.length > 6) return -1;
  if (parts.some((p) => /\d/.test(p))) return -1;
  const longWords = parts.filter((p) => p.length >= 3).length;
  return longWords * 3 + candidate.length;
};

const pickBestPersonCandidate = (candidates: string[]): string => {
  const scored = candidates
    .filter(Boolean)
    .map((candidate) => cleanPersonText(candidate))
    .map((candidate) => ({ candidate, score: scorePersonCandidate(candidate) }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => (a.score === b.score ? b.candidate.length - a.candidate.length : b.score - a.score));
  return scored[0]?.candidate ?? '';
};

const stripNameLabel = (line: string, labelKind: 'surname' | 'name'): string => {
  const pattern =
    labelKind === 'surname'
      ? /\b(APELLIDOS?|APELIDOS?|PELLID|ELLID|AVEL)\b/i
      : /\b(N\w{0,4}OMB\w*|NOMER\w*|NOME\w*|VOW?ER\w*|N0MB\w*|NOM8\w*)\b/i;
  const match = line.match(pattern);
  if (!match || match.index === undefined) return line.trim();
  const tail = line.slice(match.index + match[0].length);
  return tail.replace(/^\s*[:\-]?\s*/, '').trim();
};

const isLikelyDdMmYyyy = (digits: string): boolean => {
  if (!/^\d{8}$/.test(digits)) return false;
  const dd = Number(digits.slice(0, 2));
  const mm = Number(digits.slice(2, 4));
  const yyyy = Number(digits.slice(4));
  return dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12 && yyyy >= 1900 && yyyy <= 2099;
};

const normalizeDocNumber = (raw: string, expected: 'CEDULA' | 'RIF'): string | null => {
  const compact = raw
    .toUpperCase()
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/-/g, '')
    .replace(/[OQ]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');

  if (expected === 'CEDULA') {
    if (/^[VE]\d{6,10}$/.test(compact)) {
      if (isLikelyDdMmYyyy(compact.slice(1))) return null;
      return compact;
    }
    if (/^\d{6,10}$/.test(compact)) {
      if (isLikelyDdMmYyyy(compact)) return null;
      return `V${compact}`;
    }

    const rough = raw
      .toUpperCase()
      .replace(/[OQ]/g, '0')
      .replace(/[IL]/g, '1')
      .replace(/S/g, '5')
      .replace(/B/g, '8');
    const prefix = (rough.match(/[VE]/)?.[0] ?? 'V');
    const chunks = rough.match(/\d+/g) ?? [];
    for (let end = chunks.length; end > 0; end -= 1) {
      const digits = chunks.slice(0, end).join('');
      if (!/^\d{6,10}$/.test(digits)) continue;
      if (isLikelyDdMmYyyy(digits)) continue;
      return `${prefix}${digits}`;
    }
    return null;
  }

  if (/^[JGVEP]\d{8,10}$/.test(compact)) return compact;
  return null;
};

const detectDocumentType = (text: string, hint = ''): 'CEDULA' | 'RIF' => {
  const normalizedText = normalizeUpper(text);
  const normalizedHint = normalizeUpper(hint);
  if (normalizedHint.includes('RIF')) return 'RIF';
  if (normalizedHint.includes('CEDULA')) return 'CEDULA';
  if (
    normalizedText.includes('RIF') ||
    normalizedText.includes('SENIAT') ||
    normalizedText.includes('CONTRIBUYENTE')
  ) {
    return 'RIF';
  }
  return 'CEDULA';
};

const extractIdentityFromCedula = (lines: string[], joined: string): IdpFields => {
  let names = '';
  let surnames = '';

  lines.forEach((line, index) => {
    const normalized = normalizeUpper(line);
    const leftPart = line.includes('|') ? line.split('|')[0] : line;
    const rightPart = line.includes('|') ? line.split('|')[1] : '';
    const nextLine = lines[index + 1] ?? '';

    if (!surnames && APELLIDO_LABEL.test(normalized)) {
      surnames = pickBestPersonCandidate([
        stripNameLabel(leftPart, 'surname'),
        rightPart,
        nextLine,
        leftPart
      ]);
    }

    if (!names && NOMBRE_LABEL.test(normalized)) {
      names = pickBestPersonCandidate([
        stripNameLabel(leftPart, 'name'),
        rightPart,
        nextLine,
        leftPart
      ]);
    }
  });

  let documentNumber: string | null = null;
  const cedulaMatch = joined.match(CEDULA_RE);
  if (cedulaMatch) {
    documentNumber = normalizeDocNumber(`${cedulaMatch[1]}${cedulaMatch[2]}`, 'CEDULA');
  }
  if (!documentNumber) {
    const lineHit = joined.match(/\b([VE])\s*[.:-]?\s*(\d[\d.\s-]{5,12}\d)\b/i);
    if (lineHit?.[1] && lineHit?.[2]) {
      documentNumber = normalizeDocNumber(`${lineHit[1]}${lineHit[2]}`, 'CEDULA');
    }
  }
  if (!documentNumber) {
    const fallback = joined.match(/\b\d{6,10}\b/);
    if (fallback) documentNumber = normalizeDocNumber(fallback[0], 'CEDULA');
  }
  if (!documentNumber) {
    const fallbackGrouped = joined.match(/\b\d(?:[\d.\s-]{5,16}\d)\b/);
    if (fallbackGrouped) documentNumber = normalizeDocNumber(fallbackGrouped[0], 'CEDULA');
  }

  return {
    documentType: 'CEDULA',
    givenNames: names,
    surnames,
    documentNumber: documentNumber ?? '',
    nombres: names,
    apellidos: surnames,
    cedula: documentNumber ?? '',
    rif: ''
  };
};

const extractIdentityFromRif = (lines: string[], joined: string): IdpFields => {
  let rif: string | null = null;
  const rifMatch = joined.match(RIF_RE);
  if (rifMatch) {
    rif = normalizeDocNumber(`${rifMatch[1]}${rifMatch[2]}`, 'RIF');
  }

  let razonSocial = '';
  lines.forEach((line, index) => {
    if (razonSocial) return;
    const normalized = normalizeUpper(line);
    if (normalized.includes('RAZON SOCIAL') || normalized.includes('RAZÓN SOCIAL')) {
      const cleaned = line.replace(/.*RAZ[ÓO]N\s+SOCIAL\s*[:\-]?/i, '').trim();
      if (cleaned) {
        razonSocial = cleanPersonText(cleaned);
      } else if (lines[index + 1]) {
        razonSocial = cleanPersonText(lines[index + 1]);
      }
    }
  });

  if (!razonSocial) {
    const candidates = lines
      .map((line) => cleanPersonText(line))
      .filter((cleaned) => {
        const upper = normalizeUpper(cleaned);
        return (
          cleaned.length > 0 &&
          cleaned.split(' ').length >= 2 &&
          !['SENIAT', 'RIF', 'FECHA', 'DOMICILIO', 'CONTRIBUYENTE'].some((keyword) => upper.includes(keyword))
        );
      });
    razonSocial = pickBestPersonCandidate(candidates);
  }

  return {
    documentType: 'RIF',
    givenNames: razonSocial,
    surnames: '',
    documentNumber: rif ?? '',
    nombres: razonSocial,
    apellidos: '',
    cedula: '',
    rif: rif ?? ''
  };
};

const parsePayload = (event: LambdaEvent): RequestPayload => {
  const rawBody = event.body ?? '{}';
  const decoded = event.isBase64Encoded ? Buffer.from(rawBody, 'base64').toString('utf-8') : rawBody;
  return JSON.parse(decoded) as RequestPayload;
};

export const handler: Handler<LambdaEvent> = async (event) => {
  const method = getMethod(event);
  if (method === 'OPTIONS') return jsonResponse(200, { ok: true });
  if (method !== 'POST') return jsonResponse(405, { message: 'Metodo no permitido. Usa POST.' });

  try {
    const payload = parsePayload(event);
    const rawText = String(payload.rawText ?? '');
    const docType = detectDocumentType(rawText, String(payload.documentTypeHint ?? ''));
    const lines = rawText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const joined = lines.join('\n');

    const fields = docType === 'RIF' ? extractIdentityFromRif(lines, joined) : extractIdentityFromCedula(lines, joined);
    const warnings: string[] = [];

    if (!rawText.trim()) {
      warnings.push('rawText vacío: este endpoint procesa texto OCR enviado por el frontend.');
    }
    if (!fields.givenNames) warnings.push('No se pudieron extraer nombres con confianza.');
    if (docType === 'CEDULA' && !fields.surnames) warnings.push('No se pudieron extraer apellidos con confianza.');
    if (!fields.documentNumber) warnings.push('No se pudo extraer numero de documento con confianza.');
    if (payload.frontImageBase64 && !rawText.trim()) {
      warnings.push('Se recibió imagen base64 pero esta versión no ejecuta OCR en backend.');
    }

    const confidence = {
      givenNames: fields.givenNames ? 0.85 : 0.25,
      surnames: fields.surnames ? 0.85 : 0.25,
      documentNumber: fields.documentNumber ? 0.9 : 0.25,
      ocrAverage: rawText.trim() ? 0.8 : 0
    };

    return jsonResponse(200, {
      fields,
      confidence,
      warnings,
      documentTypeDetected: docType
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error no controlado';
    console.error('idp_identity_error', { message });
    return jsonResponse(500, { message: 'Error procesando documento' });
  }
};
