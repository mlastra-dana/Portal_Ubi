import { useEffect, useId, useMemo, useState } from 'react';
import { ocrFile, ocrFileFast } from '../services/ocr/ocrEngine';
import { extractFields } from '../services/ocr/fieldExtraction';
import type { DocKind, UploadedDocumentResult } from '../types/recaudos';
import { isExpired, parseDateStrict } from '../utils/date';
import { AlertBanner } from './AlertBanner';

type Props = {
  label: string;
  required?: boolean;
  multiple?: boolean;
  docKind: DocKind;
  description?: string;
  onChange?: (results: UploadedDocumentResult[]) => void;
};

const ACCEPT = '.pdf,image/png,image/jpeg,image/jpg';

const emptyFields = { nombres: null, numeroId: null, fechaVencimiento: null };
const normalizeText = (value: string): string =>
  value
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const supportsExpiryWarning = (docKind: DocKind): boolean => docKind === 'CEDULA' || docKind === 'CEDULA_REPRESENTANTE' || docKind === 'RIF';
const requiresOcr = (docKind: DocKind): boolean =>
  docKind === 'CEDULA' || docKind === 'CEDULA_REPRESENTANTE' || docKind === 'RIF' || docKind === 'ACTA_REGISTRO';
const isExpiringSoon = (date: Date, months = 6): boolean => {
  const now = new Date();
  const limit = new Date(now);
  limit.setMonth(limit.getMonth() + months);
  return date.getTime() >= now.getTime() && date.getTime() <= limit.getTime();
};
const getTimeRemainingLabel = (date: Date): string => {
  const now = new Date();
  if (date.getTime() <= now.getTime()) return '0 días';

  const years = date.getFullYear() - now.getFullYear();
  const months = date.getMonth() - now.getMonth() + years * 12;
  const anchor = new Date(now);
  anchor.setMonth(anchor.getMonth() + Math.max(months, 0));
  const msDiff = date.getTime() - anchor.getTime();
  const days = Math.max(0, Math.floor(msDiff / (1000 * 60 * 60 * 24)));

  if (months > 0 && days > 0) return `${months} mes(es) y ${days} día(s)`;
  if (months > 0) return `${months} mes(es)`;
  return `${Math.max(1, days)} día(s)`;
};

const validateOcrDocKind = (
  docKind: DocKind,
  rawText: string,
  fields: { numeroId: string | null }
): { status: 'VALIDO' | 'REVISAR'; message: string } => {
  const upper = normalizeText(rawText);
  const normalizedId = (fields.numeroId ?? '').toUpperCase();

  if (docKind === 'RIF') {
    const hasRifKeyword = /RIF|REGISTRO UNICO DE INFORMACION FISCAL|SENIAT/.test(upper);
    const hasRifFormat = /^[JGVEP]\d{8,10}$/.test(normalizedId) || /^[JGVEP]-\d{7,9}-?\d?$/.test(normalizedId);
    if (hasRifKeyword || hasRifFormat) return { status: 'VALIDO', message: 'Documento validado como RIF.' };
    return { status: 'REVISAR', message: 'El archivo no parece un RIF.' };
  }

  if (docKind === 'CEDULA' || docKind === 'CEDULA_REPRESENTANTE') {
    const hasCedulaKeyword = /CEDULA|C[ÉE]DULA DE IDENTIDAD|IDENTIDAD/.test(upper);
    const hasCedulaFormat = /^[VE]\d{6,10}$/.test(normalizedId) || /^[VE]-\d{6,10}$/.test(normalizedId);
    if (hasCedulaKeyword || hasCedulaFormat) return { status: 'VALIDO', message: 'Documento validado como Cédula.' };
    return { status: 'REVISAR', message: 'El archivo no parece una Cédula.' };
  }

  return { status: 'REVISAR', message: 'Tipo de documento no reconocido.' };
};

const validateActaRegistro = (file: File, rawText: string): { status: 'VALIDO' | 'REVISAR'; message: string } => {
  const normalizedName = normalizeText(file.name);
  const normalizedRaw = normalizeText(rawText);
  const mismatchKeywords = ['NACIMIENTO', 'CEDULA', 'CÉDULA', 'PASAPORTE', 'RIF', 'DEFUNCION', 'MATRIMONIO'];
  const contentKeywords = ['REGISTRO MERCANTIL', 'ACTA CONSTITUTIVA', 'REGISTRO DE COMERCIO', 'DOCUMENTO CONSTITUTIVO', 'ESTATUTOS'];

  const hasStrongMatchFromName =
    normalizedName.includes('REGISTRO MERCANTIL') ||
    normalizedName.includes('ACTA CONSTITUTIVA') ||
    (normalizedName.includes('REGISTRO') && normalizedName.includes('MERCANTIL')) ||
    (normalizedName.includes('ACTA') && normalizedName.includes('CONSTITUTIVA'));
  const hasStrongMatchFromText = contentKeywords.some((token) => normalizedRaw.includes(token));
  const hasClearMismatch = mismatchKeywords.some((token) => normalizedName.includes(token) || normalizedRaw.includes(token));

  if ((hasStrongMatchFromName || hasStrongMatchFromText) && !hasClearMismatch) {
    return {
      status: 'VALIDO',
      message: 'Documento válido como Acta constitutiva / Registro mercantil.'
    };
  }

  return {
    status: 'REVISAR',
    message: 'Este documento no corresponde a Registro mercantil / Acta constitutiva.'
  };
};

const getValidationAlertType = (status?: 'VALIDO' | 'REVISAR', message?: string): 'success' | 'warning' | 'error' | null => {
  if (status === 'VALIDO') return 'success';
  if (status !== 'REVISAR') return null;
  const normalized = normalizeText(message ?? '');
  if (normalized.includes('NO CORRESPONDE') || normalized.includes('NO PARECE')) return 'error';
  return 'warning';
};

export function DocumentSlot({ label, required = false, multiple = false, docKind, description, onChange }: Props) {
  const [results, setResults] = useState<UploadedDocumentResult[]>([]);
  const inputId = useId();

  useEffect(() => {
    return () => {
      results.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [results]);

  const processFile = async (file: File) => {
    const id = `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(16).slice(2)}`;
    const initial: UploadedDocumentResult = {
      id,
      file,
      previewUrl: URL.createObjectURL(file),
      progress: 0,
      processing: true,
      rawText: '',
      confidence: null,
      fields: emptyFields
    };

    setResults((prev) => {
      const next = multiple ? [...prev, initial] : [initial];
      onChange?.(next);
      return next;
    });

    const setItem = (partial: Partial<UploadedDocumentResult>) => {
      setResults((prev) => {
        const next = prev.map((item) => (item.id === id ? { ...item, ...partial } : item));
        onChange?.(next);
        return next;
      });
    };

    try {
      if (requiresOcr(docKind)) {
        const { rawText, confidence } =
          docKind === 'ACTA_REGISTRO'
            ? await ocrFileFast(file, (progress) => setItem({ progress }))
            : await ocrFile(file, (progress) => setItem({ progress }));
        const fields = docKind === 'ACTA_REGISTRO' ? emptyFields : extractFields(rawText);
        const validation = docKind === 'ACTA_REGISTRO' ? validateActaRegistro(file, rawText) : validateOcrDocKind(docKind, rawText, fields);

        let parseWarning: string | undefined;
        if (docKind !== 'ACTA_REGISTRO' && fields.fechaVencimiento && !parseDateStrict(fields.fechaVencimiento)) {
          parseWarning = 'Se detecto una fecha, pero no pudo parsearse de forma estricta.';
        }

        setItem({
          processing: false,
          progress: 100,
          rawText: rawText.trim(),
          confidence: Math.round(confidence),
          fields,
          parseWarning,
          validationStatus: validation.status,
          validationMessage: validation.message
        });
      }
    } catch (error) {
      setItem({
        processing: false,
        progress: 100,
        error: error instanceof Error ? error.message : 'No se pudo procesar el OCR.'
      });
    }
  };

  const removeResult = (id: string) => {
    setResults((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      const next = prev.filter((item) => item.id !== id);
      onChange?.(next);
      return next;
    });
  };

  const cardState = useMemo(() => {
    if (results.length === 0) return 'PENDIENTE' as const;
    if (results.some((item) => item.processing)) return 'PENDIENTE' as const;
    if (results.some((item) => item.validationStatus === 'REVISAR')) return 'REVISAR' as const;
    return 'VALIDADO' as const;
  }, [results]);
  return (
    <section className="space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-ubii-black">
          {label} {required ? <span className="text-red-600">*</span> : null}
        </h3>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            cardState === 'VALIDADO'
              ? 'bg-emerald-100 text-emerald-700'
              : cardState === 'REVISAR'
                ? 'bg-amber-100 text-amber-800'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {cardState === 'VALIDADO' ? 'Validado' : cardState === 'REVISAR' ? 'Revisar' : 'Pendiente'}
        </span>
      </div>

      {description ? <p className="text-sm text-gray-600">{description}</p> : null}

      <div className="rounded-xl border border-dashed border-ubii-border bg-ubii-light p-5">
        <p className="text-center text-sm text-gray-600">Arrastra tu archivo o selecciónalo.</p>
        <div className="mt-3 flex justify-center">
          <label
            htmlFor={inputId}
            className="inline-flex cursor-pointer items-center rounded-lg border border-ubii-border bg-white px-4 py-2 text-sm font-semibold text-ubii-black"
          >
          {multiple ? 'Seleccionar archivos' : 'Seleccionar archivo'}
          </label>
        </div>
        <input
          id={inputId}
          type="file"
          accept={ACCEPT}
          multiple={multiple}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            files.forEach((file) => void processFile(file));
          }}
          className="sr-only"
        />
        <p className="mt-3 text-center text-xs text-gray-600">PDF, JPG, PNG. Máx. 10MB.</p>
      </div>

      {results.length === 0 ? <p className="text-sm text-gray-600">Aún no hay validaciones ejecutadas.</p> : null}

      {results.map((result) => {
        const parsedExpiry = parseDateStrict(result.fields.fechaVencimiento ?? '');
        const hasExpiry = supportsExpiryWarning(docKind) && Boolean(parsedExpiry);
        const showExpiredWarning = hasExpiry && parsedExpiry ? isExpired(parsedExpiry) : false;
        const showSoonWarning = hasExpiry && parsedExpiry ? !showExpiredWarning && isExpiringSoon(parsedExpiry, 6) : false;
        const showOcr = requiresOcr(docKind);
        const docLabel = docKind === 'RIF' ? 'RIF' : 'Cédula';
        const validationAlertType = getValidationAlertType(result.validationStatus, result.validationMessage);

        return (
          <article key={result.id} className="space-y-3 rounded-xl border border-ubii-border bg-ubii-light p-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-ubii-blue/30 bg-white px-3 py-2">
              <p className="truncate text-sm font-semibold text-ubii-black">Archivo: {result.file.name}</p>
              <button
                type="button"
                onClick={() => removeResult(result.id)}
                className="rounded-full border border-ubii-border bg-white px-2 py-0.5 text-xs font-bold text-gray-700"
                aria-label={`Eliminar ${result.file.name}`}
                title="Eliminar adjunto"
              >
                x
              </button>
            </div>

            {result.previewUrl ? (
              <div className="overflow-hidden rounded-xl border border-ubii-border bg-white">
                {result.file.type.includes('pdf') || /\.pdf$/i.test(result.file.name) ? (
                  <iframe title={`Vista previa ${result.file.name}`} src={result.previewUrl} className="h-56 w-full" />
                ) : result.file.type.startsWith('image/') ? (
                  <img src={result.previewUrl} alt={`Vista previa ${result.file.name}`} className="h-56 w-full object-contain" />
                ) : null}
              </div>
            ) : null}

            {result.processing ? (
              <div className="space-y-3 rounded-lg border border-ubii-blue/30 bg-white p-3">
                <p className="flex items-center gap-2 text-sm font-semibold text-ubii-black">
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-ubii-blue border-t-transparent" />
                  {showOcr ? 'Validando documento...' : 'Validando documento...'}
                </p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Carga</span>
                    <span>100%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ubii-light">
                    <div className="h-full w-full rounded-full bg-ubii-blue" />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{showOcr ? 'Validación OCR' : 'Validación'}</span>
                    <span>{Math.round(result.progress)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ubii-light">
                    <div className="h-full rounded-full bg-ubii-blue" style={{ width: `${Math.max(5, result.progress)}%` }} />
                  </div>
                </div>
              </div>
            ) : null}

            {result.error ? <AlertBanner type="error">{result.error}</AlertBanner> : null}

            {!result.processing && !result.error && showOcr ? (
              <div className="space-y-2 text-sm text-ubii-black">
                {validationAlertType && result.validationMessage ? <AlertBanner type={validationAlertType}>{result.validationMessage}</AlertBanner> : null}
                {showExpiredWarning ? <AlertBanner type="warning">{docLabel} vencido</AlertBanner> : null}
                {showSoonWarning && parsedExpiry ? (
                  <AlertBanner type="warning">{`${docLabel} próximo a vencerse (le quedan ${getTimeRemainingLabel(parsedExpiry)})`}</AlertBanner>
                ) : null}
                {result.parseWarning ? <AlertBanner type="warning">{result.parseWarning}</AlertBanner> : null}

                <details className="rounded-lg border border-ubii-border bg-white p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-ubii-blue">Ver texto OCR</summary>
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{result.rawText || 'Sin texto detectado.'}</pre>
                </details>
              </div>
            ) : null}

            {!result.processing && !result.error && !showOcr ? <div className="space-y-2 text-sm text-ubii-black" /> : null}
          </article>
        );
      })}
    </section>
  );
}
