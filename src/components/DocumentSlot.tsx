import { useEffect, useId, useMemo, useState } from 'react';
import { ocrFile } from '../services/ocr/ocrEngine';
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

const supportsExpiryWarning = (docKind: DocKind): boolean => docKind === 'CEDULA' || docKind === 'CEDULA_REPRESENTANTE' || docKind === 'RIF';
const requiresOcr = (docKind: DocKind): boolean => docKind === 'CEDULA' || docKind === 'CEDULA_REPRESENTANTE' || docKind === 'RIF';
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
  const upper = rawText.toUpperCase();
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

const validateActaRegistro = (file: File): { status: 'VALIDO' | 'REVISAR'; message: string } => {
  const lowerName = file.name.toLowerCase();
  const looksLikeActaRegistro =
    lowerName.includes('acta') ||
    lowerName.includes('constitutiva') ||
    lowerName.includes('registro mercantil') ||
    lowerName.includes('mercantil') ||
    lowerName.includes('registro');

  if (looksLikeActaRegistro) {
    return {
      status: 'VALIDO',
      message: 'Documento válido como Acta constitutiva / Registro mercantil.'
    };
  }

  return {
    status: 'REVISAR',
    message: 'No se pudo validar el tipo de documento como Acta constitutiva / Registro mercantil.'
  };
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
        const { rawText, confidence } = await ocrFile(file, (progress) => setItem({ progress }));
        const fields = extractFields(rawText);
        const validation = validateOcrDocKind(docKind, rawText, fields);

        let parseWarning: string | undefined;
        if (fields.fechaVencimiento && !parseDateStrict(fields.fechaVencimiento)) {
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
      } else {
        const validation = validateActaRegistro(file);
        setItem({
          processing: false,
          progress: 100,
          rawText: '',
          confidence: null,
          fields: emptyFields,
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

        return (
          <article key={result.id} className="space-y-3 rounded-xl border border-ubii-border bg-ubii-light p-4">
            <p className="text-sm font-semibold text-ubii-black">{result.file.name}</p>

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
              <div className="space-y-2">
                <p className="text-sm text-ubii-black">{showOcr ? 'Procesando OCR...' : 'Validando documento...'}</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                  <div className="h-full bg-ubii-blue" style={{ width: `${result.progress}%` }} />
                </div>
              </div>
            ) : null}

            {result.error ? <AlertBanner type="error">{result.error}</AlertBanner> : null}

            {!result.processing && !result.error && showOcr ? (
              <div className="space-y-2 text-sm text-ubii-black">
                {result.validationStatus === 'REVISAR' ? <AlertBanner type="warning">{result.validationMessage}</AlertBanner> : null}
                {result.validationStatus === 'VALIDO' ? <AlertBanner type="success">{result.validationMessage}</AlertBanner> : null}
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

            {!result.processing && !result.error && !showOcr ? (
              <div className="space-y-2 text-sm text-ubii-black">
                {result.validationStatus === 'VALIDO' ? <AlertBanner type="success">{result.validationMessage}</AlertBanner> : null}
                {result.validationStatus === 'REVISAR' ? <AlertBanner type="warning">{result.validationMessage}</AlertBanner> : null}
                <p className="text-xs text-gray-700">Este documento no usa OCR en la demo.</p>
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
