const DATE_REGEX = /\b(\d{2}[/-]\d{2}[/-]\d{4}|\d{4}-\d{2}-\d{2})\b/g;

const NAME_LABEL_REGEX = /(NOMBRES?|APELLIDOS?|NOMBRE\s*Y\s*APELLIDO[S]?|RAZON\s+SOCIAL)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{4,})/i;
const NAME_FALLBACK_REGEX = /\b([A-ZÁÉÍÓÚÑ]{2,}(?:\s+[A-ZÁÉÍÓÚÑ]{2,}){1,4})\b/g;
const ID_REGEX = /\b([VEJGP]-?\d{6,10}(?:-\d)?|\d{6,10})\b/i;
const ID_LABELED_REGEX = /(C[ÉE]DULA|CED|CI|RIF|IDENTIFICACI[ÓO]N)\s*[:\-]?\s*([VEJGP]-?\d{6,10}(?:-\d)?)/i;

const normalizeSpaces = (text: string): string => text.replace(/\s+/g, ' ').trim();

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
    const candidate = normalizeSpaces(labeled[2]).replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, '').trim();
    if (candidate.split(' ').length >= 2) nombres = candidate;
  }

  if (!nombres) {
    const matches = [...text.matchAll(NAME_FALLBACK_REGEX)].map((m) => normalizeSpaces(m[1]));
    const filtered = matches.filter((m) => m.split(' ').length >= 2 && !/(REPUBLICA|BOLIVARIANA|VENEZUELA|CEDULA|IDENTIDAD|REGISTRO)/i.test(m));
    if (filtered.length === 1) nombres = filtered[0];
  }

  if (!nombres) {
    const lineCandidates = rawText
      .split(/\r?\n/)
      .map((line) => line.replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ\s]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter((line) => line.split(' ').length >= 2 && line.split(' ').length <= 5)
      .filter((line) => !/(REPUBLICA|BOLIVARIANA|VENEZUELA|CEDULA|IDENTIDAD|RIF|REGISTRO|MERCANTIL|NACIONAL)/i.test(line));

    if (lineCandidates.length > 0) {
      const strongest = lineCandidates.sort((a, b) => b.length - a.length)[0];
      if (strongest.length >= 8) nombres = strongest;
    }
  }

  const labeledIdMatch = ID_LABELED_REGEX.exec(text);
  const idMatch = labeledIdMatch?.[2] ? [null, labeledIdMatch[2]] : ID_REGEX.exec(text);
  const numeroId = idMatch && idMatch[1] ? idMatch[1].toUpperCase().replace(/\s+/g, '') : null;

  const dateMatches = [...text.matchAll(DATE_REGEX)].map((m) => m[1]);
  const fechaCandidate = dateMatches.length > 0 ? dateMatches[dateMatches.length - 1] : null;
  const fechaVencimiento = fechaCandidate ? toIsoIfDate(fechaCandidate) ?? fechaCandidate : null;

  return { nombres, numeroId, fechaVencimiento };
}
