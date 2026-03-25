const DATE_REGEX = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{4})\b/g;
const EXPIRY_LABELED_REGEX =
  /(FECHA\s+DE\s+VENCIMIENTO|F\s*VENCIMIENTO|VENCIMIENTO)\s*[:\-]?\s*(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{4})/i;

const NAME_LABEL_REGEX = /(NOMBRES?|APELLIDOS?|NOMBRE\s*Y\s*APELLIDO[S]?|RAZON\s+SOCIAL)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{4,})/i;
const NAME_FALLBACK_REGEX = /\b([A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){1,4})\b/g;
const ID_REGEX = /\b([VEJGP]\s*[-.]?\s*\d(?:[\d.\s-]{5,12}\d)?|\d(?:[\d.\s-]{5,12}\d))\b/i;
const ID_LABELED_REGEX = /(C[ÉE]DULA|CED|CI|RIF|IDENTIFICACI[ÓO]N)\s*[:\-]?\s*([VEJGP]?\s*[-.]?\s*\d(?:[\d.\s-]{5,12}\d)?)/i;
const NO_NAME_TOKENS =
  /(COMPROBANTE|NRO|N[°o]\.?|FECHA|SENIAT|REGISTRO|MERCANTIL|IDENTIFICACI[ÓO]N|CEDULA|C[ÉE]DULA|RIF|NACIONAL|REPUBLICA|BOLIVARIANA|VENEZUELA)/i;

const normalizeSpaces = (text: string): string => text.replace(/\s+/g, ' ').trim();
const cleanNameLabels = (value: string): string =>
  normalizeSpaces(
    value
      .replace(/\b(APELLIDOS?|NOMBRES?|NOMBRE\s*Y\s*APELLIDO[S]?|RAZ[ÓO]N\s+SOCIAL)\b/gi, ' ')
      .replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ\s]/g, ' ')
  );

const normalizeIdValue = (value: string): string | null => {
  const compact = value
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .toUpperCase()
    .replace(/[OQ]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');
  if (!compact) return null;

  if (/^[VEJGP]-?\d{6,10}(?:-\d)?$/.test(compact)) return compact.replace(/-/g, '');
  if (/^\d{6,10}$/.test(compact)) return compact;
  return null;
};

const parseDateToken = (token: string): Date | null => {
  const t = token.trim();
  const dmy = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(t);
  if (dmy) return new Date(Date.UTC(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1])));

  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t);
  if (ymd) return new Date(Date.UTC(Number(ymd[1]), Number(ymd[2]) - 1, Number(ymd[3])));

  const my = /^(\d{2})[/-](\d{4})$/.exec(t);
  if (my) {
    const month = Number(my[1]);
    const year = Number(my[2]);
    if (month < 1 || month > 12) return null;
    // Fin de mes para vencimiento MM/YYYY
    return new Date(Date.UTC(year, month, 0));
  }
  return null;
};

const dateToIso = (date: Date): string => {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toIsoIfDate = (raw: string): string | null => {
  const trimmed = raw.trim();
  const dmy = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(trimmed);
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`;
  const ymd = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  return null;
};

export function extractFields(rawText: string): { nombres: string | null; numeroId: string | null; fechaVencimiento: string | null } {
  const text = normalizeSpaces(rawText);
  if (!text) return { nombres: null, numeroId: null, fechaVencimiento: null };

  let nombres: string | null = null;
  const labeled = NAME_LABEL_REGEX.exec(text);
  if (labeled?.[2]) {
    const candidate = cleanNameLabels(labeled[2]);
    if (candidate.split(' ').length >= 2) nombres = candidate;
  }

  if (!nombres) {
    const matches = [...text.matchAll(NAME_FALLBACK_REGEX)].map((m) => cleanNameLabels(m[1]));
    const filtered = matches.filter((m) => m.split(' ').length >= 2 && !NO_NAME_TOKENS.test(m));
    if (filtered.length === 1) nombres = filtered[0];
  }

  if (!nombres) {
    const lineCandidates = rawText
      .split(/\r?\n+/)
      .map((line) => cleanNameLabels(line))
      .filter((line) => line.split(' ').length >= 2 && line.split(' ').length <= 5)
      .filter((line) => !NO_NAME_TOKENS.test(line));

    if (lineCandidates.length > 0) {
      const strongest = lineCandidates.sort((a, b) => b.length - a.length)[0];
      if (strongest.length >= 8) nombres = strongest;
    }
  }

  const labeledIdMatch = ID_LABELED_REGEX.exec(text);
  const idRaw = labeledIdMatch?.[2] ?? ID_REGEX.exec(text)?.[1] ?? null;
  const numeroId = idRaw ? normalizeIdValue(idRaw) : null;

  const expiryLabeled = EXPIRY_LABELED_REGEX.exec(text);
  let fechaCandidate: string | null = expiryLabeled?.[2] ?? null;

  const pickLatestDate = (tokens: string[]): string | null => {
    const parsed = tokens
      .map((token) => ({ token, date: parseDateToken(token) }))
      .filter((item) => item.date !== null) as Array<{ token: string; date: Date }>;
    if (parsed.length === 0) return null;
    parsed.sort((a, b) => b.date.getTime() - a.date.getTime());
    return dateToIso(parsed[0].date);
  };

  if (!fechaCandidate) {
    const lines = rawText.split(/\r?\n+/);
    const expiryLine = lines.find((line) => /(FECHA\s+DE\s+VENCIMIENTO|F\s*VENCIMIENTO|VENCIMIENTO)/i.test(line));
    if (expiryLine) {
      const tokens = [...expiryLine.matchAll(DATE_REGEX)].map((m) => m[1]);
      const latest = pickLatestDate(tokens);
      if (latest) fechaCandidate = latest;
    }
  }

  if (fechaCandidate) {
    const parsed = parseDateToken(fechaCandidate);
    if (parsed) fechaCandidate = dateToIso(parsed);
  }

  if (!fechaCandidate) {
    const dateMatches = [...text.matchAll(DATE_REGEX)].map((m) => m[1]);
    const latest = pickLatestDate(dateMatches);
    fechaCandidate = latest ?? null;
  }

  const fechaVencimiento = fechaCandidate ? toIsoIfDate(fechaCandidate) ?? fechaCandidate : null;

  return { nombres, numeroId, fechaVencimiento };
}
