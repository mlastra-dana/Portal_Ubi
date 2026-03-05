import { useId } from 'react';
import type { DocType, OcrResult } from '../types/onboarding';
import { OcrResultCard } from './OcrResultCard';

export function DocumentUploader({
  label,
  docType,
  file,
  processing,
  result,
  onFile
}: {
  label: string;
  docType: DocType;
  file?: File;
  processing: boolean;
  result?: OcrResult;
  onFile: (file?: File, docType?: DocType) => void;
}) {
  const inputId = useId();

  return (
    <div className="space-y-3 rounded-xl border border-ubii-border bg-white p-6 shadow-soft">
      <label className="block text-sm font-semibold text-ubii-black">{label}</label>
      <div className="rounded-lg border border-ubii-border bg-ubii-light p-3">
        <label htmlFor={inputId} className="inline-flex cursor-pointer items-center rounded-lg border border-ubii-blue bg-ubii-blue px-3 py-2 text-sm font-semibold text-white">
          Seleccionar archivo
        </label>
        <input
          id={inputId}
          type="file"
          accept=".pdf,image/png,image/jpeg"
          onChange={(event) => onFile(event.target.files?.[0], docType)}
          className="sr-only"
        />
        <p className="mt-2 text-xs text-gray-600">Formatos permitidos: PDF, JPG, PNG.</p>
      </div>
      {file ? <p className="text-xs text-gray-600">{file.name}</p> : null}
      <OcrResultCard processing={processing} result={result} />
    </div>
  );
}
