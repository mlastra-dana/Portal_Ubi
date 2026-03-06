const NOISE_WORDS =
  /\b(APELLIDOS?|NOMBRES?|EXPEDICION|VENCIMIENTO|COMPROBANTE|REPUBLICA|BOLIVARIANA|VENEZUELA|IDENTIDAD|CEDULA|RIF|SENIAT|FECHA|INSCRIPCION|DOMICILIO|FISCAL|ACTUALIZACION|FIRMA|AUTORIZADA|CONDICION|CONTRIBUYENTE|TASA)\b/gi;

const cleanText = (value: string): string =>
  value
    .replace(/[|~_^`'"*:;<>()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const cleanName = (value: string): string => cleanText(value).replace(NOISE_WORDS, '').replace(/\s+/g, ' ').trim();
const normalizeUpper = (value: string): string => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
const isLikelyNameText = (value: string): boolean => {
  const cleaned = cleanName(value);
  if (!cleaned) return false;
  if (/\d/.test(cleaned)) return false;
  const words = cleaned.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  const longWords = words.filter((word) => word.length >= 3).length;
  return longWords >= 1 && cleaned.replace(/\s+/g, '').length >= 6;
};

const looksLikePersonName = (value: string): boolean => {
  const words = value.split(' ').filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (value.length < 6) return false;
  if (/\d/.test(value)) return false;
  return true;
};

const normalizeId = (value: string): string | null => {
  const compact = value.toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
  if (/^[VE]-?\d{6,10}$/.test(compact)) return compact.replace(/-/g, '');
  if (/^[JGVEP]-?\d{8,10}$/.test(compact)) return compact.replace(/-/g, '');
  if (/^\d{6,10}$/.test(compact)) return compact;
  return null;
};

const cleanPersonValue = (value: string): string => {
  return cleanName(value)
    .replace(/\b(EA|ER|OD|DI|RR|ZN)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getValueAfterKeyword = (line: string, keywordRegex: RegExp): string => {
  const side = line.split('|')[0] ?? line;
  return cleanPersonValue(side.replace(keywordRegex, ' '));
};

export function extractCedulaAutofill(rawText: string): { nombres: string | null; apellidos: string | null; cedula: string | null } {
  const text = rawText || '';
  const upper = text.toUpperCase();
  const normalized = normalizeUpper(text);

  const cedulaMatch =
    /(V|E)\s*[-.]?\s*(\d(?:[\d.\s-]{5,12}\d))/.exec(upper) ??
    /(C[ÉE]DULA|IDENTIDAD)\s*[:\-]?\s*(\d(?:[\d.\s-]{5,12}\d))/.exec(upper);
  const cedulaRaw = cedulaMatch ? `${cedulaMatch[1] && cedulaMatch[1].length === 1 ? cedulaMatch[1] : 'V'}${cedulaMatch[2] ?? cedulaMatch[1]}` : null;
  const cedula = cedulaRaw ? normalizeId(cedulaRaw) : null;

  const lines = text.split(/\r?\n+/);
  const normalizedLines = normalized.split(/\r?\n+/);
  const apellidoIndex = normalizedLines.findIndex((line) => /ELLID/.test(line));
  const nombreIndex = normalizedLines.findIndex((line) => /NOMB|VOVER|VOWER|VOWERE|N0MB|NOM8/.test(line));

  const apellidoLine = apellidoIndex >= 0 ? lines[apellidoIndex] : '';
  const nombreLine = nombreIndex >= 0 ? lines[nombreIndex] : '';

  let apellidos = apellidoLine ? getValueAfterKeyword(apellidoLine, /A\w*P?E?L?L?I?D?\w*/i) : '';
  let nombres = nombreLine ? getValueAfterKeyword(nombreLine, /N\w*O?M?B?R?\w*|VOW?ER\w*|N0MB\w*|NOM8\w*/i) : '';

  // Caso típico en cédulas OCR: "APELLIDOS xxxx | NOMBRES yyyy"
  if (!nombres || !apellidos) {
    const labeledLines = lines.filter((line) => /APELL|NOMB|PELLID|NOMBR|VOVER|VOBER|NOM8|N0MB/i.test(line));
    for (const line of labeledLines) {
      const normalizedLine = normalizeUpper(line);
      const pipePartsRaw = line.split('|');
      const leftRaw = pipePartsRaw[0] ?? '';
      const rightRaw = pipePartsRaw[1] ?? '';
      const left = cleanName(leftRaw);
      const right = cleanName(rightRaw);

      if (!apellidos && /APELL|PELLID|ELLID/i.test(normalizedLine)) {
        const fromLeft = cleanName(leftRaw.replace(/.*APELL\w*/i, ''));
        if (isLikelyNameText(fromLeft)) apellidos = fromLeft;
        else if (isLikelyNameText(left)) apellidos = left;
      }

      if (!nombres && /NOMB|NOMBR|VOVER|VOBER|N0MB|NOM8/i.test(normalizedLine)) {
        const fromLeft = cleanName(leftRaw.replace(/.*(N\w{0,4}OMB\w*|VOW?ER\w*|N0MB\w*|NOM8\w*)/i, ''));
        if (isLikelyNameText(fromLeft)) nombres = fromLeft;
        else if (isLikelyNameText(left)) nombres = left;
      }

      if (!nombres && isLikelyNameText(right)) nombres = right;
      if (!apellidos && isLikelyNameText(left) && left.split(' ').length <= 3 && !/EXPEDICION|VENCIMIENTO/i.test(left)) apellidos = left;
    }
  }

  if (!looksLikePersonName(`${nombres} ${apellidos}`.trim())) {
    const lineCandidates = text
      .split(/\r?\n+/)
      .map((line) => cleanName(line))
      .filter((line) => looksLikePersonName(line))
      .sort((a, b) => b.length - a.length);

    if (lineCandidates.length > 0) {
      const parts = lineCandidates[0].split(' ');
      if (!nombres) nombres = parts.slice(0, Math.ceil(parts.length / 2)).join(' ');
      if (!apellidos) apellidos = parts.slice(Math.ceil(parts.length / 2)).join(' ');
    }
  }

  // Si OCR invierte el orden, corrige por pistas
  if (nombres && /HERNANDEZ|GONZALEZ|RODRIGUEZ|PEREZ|MILLAN/i.test(nombres) && apellidos && !/HERNANDEZ|GONZALEZ|RODRIGUEZ|PEREZ|MILLAN/i.test(apellidos)) {
    const swap = nombres;
    nombres = apellidos;
    apellidos = swap;
  }

  const cleanedNames = cleanPersonValue(nombres);
  const cleanedSurnames = cleanPersonValue(apellidos);

  return {
    nombres: cleanedNames || null,
    apellidos: cleanedSurnames || null,
    cedula
  };
}

export function extractRifAutofill(rawText: string): { razonSocial: string | null; rif: string | null } {
  const text = rawText || '';
  const upper = text.toUpperCase();
  const normalized = normalizeUpper(text);

  const rifMatch = /(J|G|V|E|P)\s*[-.]?\s*(\d(?:[\d.\s-]{7,12}\d))/.exec(upper);
  const rifRaw = rifMatch ? `${rifMatch[1]}${rifMatch[2]}` : null;
  const rif = rifRaw ? normalizeId(rifRaw) : null;

  const razonByLabel = /(RAZ[ÓO]N\s+SOCIAL)\s*[:\-]?\s*([A-ZÁÉÍÓÚÑ0-9\s.&,-]{6,160})/.exec(upper);
  let razonSocial = razonByLabel ? cleanName(razonByLabel[2]) : '';

  // Formato SENIAT frecuente: Jxxxxxxxxx <RAZON SOCIAL> FECHA DE INSCRIPCION
  if (!razonSocial && rif) {
    const rifNoSep = rif.replace(/[-.\s]/g, '');
    const normalizedNoSep = normalized.replace(/[-.\s]/g, ' ');
    const around = new RegExp(`${rifNoSep}\\s+([A-Z0-9\\s.&,-]{6,180}?)\\s+FECHA\\s+DE\\s+INSCRIPCION`, 'i').exec(
      normalizedNoSep
    );
    if (around?.[1]) razonSocial = cleanName(around[1]);
  }

  if (!razonSocial && rif) {
    const aroundRif = new RegExp(`${rif}\\s+([A-ZÁÉÍÓÚÑ0-9\\s.&,-]{6,120}?)(?:\\s+FECHA|\\s+INSCRIPCION|\\s+DOMICILIO|$)`, 'i').exec(
      upper.replace(/[.\-]/g, '')
    );
    if (aroundRif?.[1]) razonSocial = cleanName(aroundRif[1]);
  }

  if (!razonSocial) {
    const lineCandidates = text
      .split(/\r?\n+/)
      .map((line) => cleanName(line))
      .filter((line) => line.split(' ').length >= 2 && line.length >= 8)
      .filter((line) => !/COMPROBANTE|CONTRIBUYENTE|SENIAT|RIF|FECHA|DOMICILIO|ACTUALIZACION|CONDICION|EXPEDICION|VENCIMIENTO/i.test(line))
      .sort((a, b) => b.length - a.length);
    if (lineCandidates.length > 0) razonSocial = lineCandidates[0];
  }

  return {
    razonSocial: razonSocial || null,
    rif
  };
}
