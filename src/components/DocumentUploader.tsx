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
  return (
    <div className="space-y-3 rounded-2xl border border-slate-700 bg-slate-900/50 p-4 shadow-soft">
      <label className="block text-sm font-semibold text-slate-100">{label}</label>
      <input
        type="file"
        accept=".pdf,image/png,image/jpeg"
        onChange={(event) => onFile(event.target.files?.[0], docType)}
        className="block w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-white"
      />
      {file ? <p className="text-xs text-slate-300">{file.name}</p> : null}
      <OcrResultCard processing={processing} result={result} />
    </div>
  );
}
