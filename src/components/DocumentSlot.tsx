import { useEffect, useId, useMemo, useState } from 'react';
import { validateDocumentWithLambda } from '../services/documentValidatorClient';
import type { DocKind, UploadedDocumentResult } from '../types/recaudos';
import { AlertBanner } from './AlertBanner';

type Props = {
  label: string;
  required?: boolean;
  multiple?: boolean;
  docKind: DocKind;
  description?: string;
  onChange?: (results: UploadedDocumentResult[]) => void;
  className?: string;
  showExtractedDetails?: boolean;
};

const ACCEPT = '.pdf,image/png,image/jpeg,image/jpg';

const emptyFields = { nombres: null, apellidos: null, numeroId: null, fechaVencimiento: null };

const DOC_NUMBER_CONFIDENCE_WARNING = 'No se pudo extraer el número de documento con confianza.';

const normalizeForMatch = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const hasDocNumberConfidenceIssue = (warnings: string[]): boolean => {
  const target = normalizeForMatch(DOC_NUMBER_CONFIDENCE_WARNING);
  return warnings.some((warning) => normalizeForMatch(warning).includes(target));
};

const stripNameLabels = (value?: string): string => {
  if (!value) return '';
  return value
    .replace(/\b(APELLIDOS?|NOMBRES?)\b\s*[:\-]?\s*/gi, ' ')
    .replace(/\b(EDO|CIVIL|CASAD[AO]|SOLTER[AO]|VIUD[AO]|DIVORCIAD[AO]|UNION|LIBRE)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const getValidationAlertType = (status?: 'VALIDO' | 'REVISAR', message?: string): 'success' | 'warning' | 'error' | null => {
  if (status === 'VALIDO') return 'success';
  if (status !== 'REVISAR') return null;
  if ((message ?? '').toLowerCase().includes('no coincide')) return 'error';
  return 'warning';
};

const formatSlotValidationMessage = (status?: 'VALIDO' | 'REVISAR', backendMessage?: string): string => {
  if (status === 'VALIDO') return 'Documento válido.';
  if (status === 'REVISAR' && (backendMessage ?? '').toLowerCase().includes('no coincide')) {
    return 'Este documento no corresponde al requisito solicitado.';
  }
  return backendMessage?.trim() || 'No se pudo validar el documento para este requisito.';
};

const toFriendlyWarning = (warning: string): string => {
  const text = warning.trim();
  const lower = text.toLowerCase();

  if (lower.includes('no se pudieron extraer apellidos')) {
    return 'No pudimos leer los apellidos con claridad. Puedes escribirlos manualmente o subir una foto más nítida.';
  }
  if (lower.includes('no se pudieron extraer nombres')) {
    return 'No pudimos leer los nombres con claridad. Puedes escribirlos manualmente o subir una foto más nítida.';
  }
  if (lower.includes('no se pudo extraer número de identificación')) {
    return 'No pudimos leer el número de identificación con claridad. Intenta con mejor luz y sin reflejos.';
  }
  if (lower.includes('ocr con baja confianza')) {
    return 'La imagen no se ve con suficiente nitidez. Intenta nuevamente con mejor iluminación.';
  }
  return text;
};

const buildValidationSummary = (
  docKind: DocKind,
  fieldValues: { nombres?: string; apellidos?: string; razonSocial?: string; numeroId?: string },
): string => {
  const lines: string[] = [];

  const nombres = (fieldValues.nombres ?? '').trim();
  const apellidos = (fieldValues.apellidos ?? '').trim();
  const razonSocial = (fieldValues.razonSocial ?? '').trim();
  const numeroId = (fieldValues.numeroId ?? '').trim();

  const nombreCompleto = [nombres, apellidos].filter(Boolean).join(' ').trim();

  if (docKind === 'CEDULA' || docKind === 'CEDULA_REPRESENTANTE') {
    if (nombres) lines.push(`Nombres: ${nombres}`);
    if (apellidos) lines.push(`Apellidos: ${apellidos}`);
    if (!nombres && !apellidos && nombreCompleto) lines.push(`Nombre: ${nombreCompleto}`);
  }

  if (docKind === 'RIF' && razonSocial) {
    lines.push(`Razón social: ${razonSocial}`);
  }

  if (numeroId) {
    lines.push(`Número: ${numeroId}`);
  }

  if (lines.length === 0) {
    lines.push('No se detectaron datos relevantes para mostrar.');
  }

  return lines.join('\n').trim();
};

export function DocumentSlot({
  label,
  required = false,
  multiple = false,
  docKind,
  description,
  onChange,
  className = '',
  showExtractedDetails = true
}: Props) {
  const [results, setResults] = useState<UploadedDocumentResult[]>([]);
  const inputId = useId();
  const canUploadMore = multiple || results.length === 0;

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
      progress: 5,
      processing: true,
      rawText: '',
      ocrDisplayText: '',
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
      setItem({ progress: 20 });
      const backend = await validateDocumentWithLambda(file, docKind);
      setItem({ progress: 90 });

      const numeroId = (
        backend.fields.numeroIdentificacion || ''
      ).trim();

      const razonSocial = (
        backend.fields.razonSocial || ''
      ).trim();

      const nombresRaw = (
        backend.fields.nombres || ''
      ).trim();
      const apellidosRaw = (
        backend.fields.apellidos || ''
      ).trim();
      const nombres = stripNameLabels(nombresRaw);
      const apellidos = stripNameLabels(apellidosRaw);

      const numberRequired = docKind === 'CEDULA' || docKind === 'CEDULA_REPRESENTANTE' || docKind === 'RIF';
      const docNumberIssue = numberRequired && (
        backend.fieldStatus.numeroIdentificacion === 'not_detected' ||
        (!numeroId || hasDocNumberConfidenceIssue(backend.warnings))
      );

      const validationStatus: 'VALIDO' | 'REVISAR' = backend.isValidForSlot && !docNumberIssue ? 'VALIDO' : 'REVISAR';
      const validationMessage = docNumberIssue ? DOC_NUMBER_CONFIDENCE_WARNING : backend.slotValidationReason;

      const parseWarnings = [...backend.warnings];
      if (docNumberIssue && !hasDocNumberConfidenceIssue(parseWarnings)) {
        parseWarnings.unshift(DOC_NUMBER_CONFIDENCE_WARNING);
      }
      const friendlyWarnings = Array.from(new Set(parseWarnings.map(toFriendlyWarning)));

      setItem({
        processing: false,
        progress: 100,
        rawText: '',
        ocrDisplayText: buildValidationSummary(
          docKind,
          {
            nombres,
            apellidos,
            razonSocial,
            numeroId
          }
        ),
        confidence: Math.round((backend.confidence.ocrAverage ?? 0) * 100),
        fields: {
          nombres: (docKind === 'RIF' ? (razonSocial || nombresRaw) : nombres) || null,
          apellidos: (docKind === 'RIF' ? null : apellidos) || null,
          numeroId: numeroId || null,
          fechaVencimiento: backend.fields.fechaVencimiento || null
        },
        validationStatus,
        validationMessage,
        parseWarning: (backend.expiryAlert && !parseWarnings.length)
          ? 'Documento próximo a vencer.'
          : friendlyWarnings.length > 0
            ? friendlyWarnings.join(' | ')
            : undefined
      });
    } catch (error) {
      setItem({
        processing: false,
        progress: 100,
        error: error instanceof Error ? error.message : 'No se pudo validar el documento.'
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
    <section className={`space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft ${className}`}>
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
          {cardState === 'VALIDADO'
            ? 'Válido'
            : cardState === 'REVISAR'
              ? 'No corresponde'
              : 'Por validar'}
        </span>
      </div>

      {description ? <p className="text-sm text-gray-600">{description}</p> : null}

      {canUploadMore ? (
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
      ) : (
        <AlertBanner type="info">Documento ya adjuntado. Si deseas reemplazarlo, elimina el archivo actual.</AlertBanner>
      )}

      {results.length === 0 ? <p className="text-sm text-gray-600">Aún no hay documentos validados para este requisito.</p> : null}

      {results.map((result) => {
        const validationAlertType = getValidationAlertType(result.validationStatus, result.validationMessage);
        const slotValidationMessage = formatSlotValidationMessage(result.validationStatus, result.validationMessage);

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
                  Validando documento...
                </p>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>Validación</span>
                    <span>{Math.round(result.progress)}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-ubii-light">
                    <div className="h-full rounded-full bg-ubii-blue" style={{ width: `${Math.max(5, result.progress)}%` }} />
                  </div>
                </div>
              </div>
            ) : null}

            {result.error ? <AlertBanner type="error">{result.error}</AlertBanner> : null}

            {!result.processing && !result.error ? (
              <div className="space-y-2 text-sm text-ubii-black">
                {validationAlertType ? <AlertBanner type={validationAlertType}>{slotValidationMessage}</AlertBanner> : null}
                {result.parseWarning ? <AlertBanner type="warning">{result.parseWarning}</AlertBanner> : null}

                {showExtractedDetails ? (
                  <details className="rounded-lg border border-ubii-border bg-white p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-ubii-blue">Ver datos extraídos del documento</summary>
                    <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-700">{result.ocrDisplayText || 'Sin datos detectados.'}</pre>
                  </details>
                ) : null}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
  );
}
